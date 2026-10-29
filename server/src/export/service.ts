import { randomUUID } from "node:crypto";
import { getControlPool } from "../platform/pool";
import { getTenantContext, validateSchemaName } from "../tenancy/context";

export const EXPORT_FORMAT = "ez-workspace-export/1";
export const EXPORT_MAX_ROWS = 10000;
export const EXPORT_MAX_BYTES = 20 * 1024 * 1024;
const EXPORT_MAX_DURATION_MS = 15000;
const activeExports = new Set<string>();

/** These identifiers and predicates are code-owned, never client input. */
const tables = [
  ["users", 'id,email,name,role,"isActive","createdAt","updatedAt"', "true"],
  [
    "projects",
    'id,name,description,"archivedAt","createdById","createdAt","updatedAt"',
    "true",
  ],
  [
    "sprints",
    'id,name,"startDate","endDate",status,goal,"isActive","createdById","projectId","createdAt","updatedAt"',
    "true",
  ],
  [
    "tasks",
    'id,"taskName","projectId","sprintId","parentTaskId",details,progress,"assignedToId","startDate",deadline,"nestingLevel","createdById","createdAt","updatedAt"',
    "true",
  ],
  ["daily_updates", 'id,date,content,"userId","createdAt","updatedAt"', "true"],
  [
    "team_invites",
    'id,email,role,status,"invitedById","expiresAt","acceptedAt","createdAt"',
    "true",
  ],
  [
    "weekly_summaries",
    'id,"weekStartDate","weekEndDate","generatedAt","emailSentAt","createdAt","updatedAt"',
    "true",
  ],
  [
    "member_weekly_summaries",
    'id,"weeklySummaryId","userId",summary,"impactLevel","createdAt"',
    "true",
  ],
  [
    "conversations",
    'id,type,name,description,"createdById","createdAt","updatedAt"',
    'id IN (SELECT "conversationId" FROM $SCHEMA.conversation_members WHERE "userId"=$1)',
  ],
  [
    "conversation_members",
    'id,"conversationId","userId","isAdmin","lastReadAt","joinedAt"',
    '"conversationId" IN (SELECT "conversationId" FROM $SCHEMA.conversation_members WHERE "userId"=$1)',
  ],
  [
    "messages",
    'id,"conversationId","senderId",CASE WHEN "isDeleted" THEN \'\' ELSE content END AS content,reactions,"parentMessageId","threadRepliesCount",mentions,"isEdited","isDeleted","createdAt","updatedAt"',
    '"conversationId" IN (SELECT "conversationId" FROM $SCHEMA.conversation_members WHERE "userId"=$1)',
  ],
  [
    "files",
    'id,filename,"mimeType",size,"uploadedById","conversationId","messageId","createdAt"',
    `("conversationId" IS NULL AND "messageId" IS NULL AND "uploadedById"=$1) OR
     ("conversationId" IN (SELECT "conversationId" FROM $SCHEMA.conversation_members WHERE "userId"=$1)
       AND ("messageId" IS NULL OR "messageId" IN (SELECT id FROM $SCHEMA.messages m WHERE m."conversationId"=files."conversationId" AND m."isDeleted"=false)))`,
  ],
  [
    "message_attachments",
    'id,"messageId","fileName","mimeType","fileSize","createdAt"',
    '"messageId" IN (SELECT id FROM $SCHEMA.messages WHERE "isDeleted"=false AND "conversationId" IN (SELECT "conversationId" FROM $SCHEMA.conversation_members WHERE "userId"=$1))',
  ],
] as const;

export const EXPORT_COVERAGE = {
  included: [
    "company directory",
    "projects, archived projects and tasks",
    "sprints",
    "daily updates",
    "invitation metadata",
    "weekly summaries without raw source data",
    "conversations the requesting administrator belongs to",
    "authorized attachment metadata",
  ],
  excluded: [
    "passwords and password hashes",
    "session and setup/invitation tokens",
    "provider credentials",
    "private notes and reminders",
    "notifications",
    "settings and sync logs",
    "conversations the requester does not belong to",
    "file contents, filesystem paths and signed/external attachment URLs",
    "raw AI source data",
    "operator and control-plane records",
  ],
  limitations:
    "This bounded workspace snapshot is not a full personal-data portability response, backup or restorable archive. Attachment contents require separately authorized retrieval. Deleted message content is omitted.",
};

export class ExportError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function exportWorkspace(actor: {
  id: string;
  sessionVersion: number;
}): Promise<{ json: string; filename: string }> {
  const tenant = getTenantContext(),
    schema = `"${validateSchemaName(tenant.schemaName)}"`;
  // One export per API process bounds aggregate memory across companies.
  if (activeExports.size)
    throw new ExportError(
      429,
      "EXPORT_BUSY",
      "An export is already running. Try again later.",
    );
  activeExports.add(tenant.id);
  const client = await getControlPool()
    .connect()
    .catch((error: unknown) => {
      activeExports.delete(tenant.id);
      throw error;
    });
  let transactionOpen = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout='10s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout='15s'");
    const company = await client.query(
      "SELECT id FROM ez_control.tenants WHERE id=$1 AND schema_name=$2 AND status='ACTIVE'",
      [tenant.id, tenant.schemaName],
    );
    const principal = await client.query(
      `SELECT id FROM ${schema}.users WHERE id=$1 AND role='ADMIN' AND "isActive"=true AND "sessionVersion"=$2`,
      [actor.id, actor.sessionVersion],
    );
    if (!company.rows.length || !principal.rows.length)
      throw new ExportError(
        403,
        "EXPORT_ACCESS_CHANGED",
        "Workspace export access is no longer available. Sign in again.",
      );
    const data: Record<string, unknown[]> = {};
    const startedAt = Date.now();
    let totalRows = 0,
      rowBytes = 0;
    for (const [table, columns, predicate] of tables) {
      if (Date.now() - startedAt > EXPORT_MAX_DURATION_MS)
        throw new ExportError(
          503,
          "EXPORT_TIMEOUT",
          "Workspace export took too long. Try again later or contact support.",
        );
      const filtered = predicate.replaceAll("$SCHEMA", schema);
      const values = filtered.includes("$1") ? [actor.id] : [];
      const source = `SELECT ${columns} FROM ${schema}."${table}" WHERE ${filtered} ORDER BY id LIMIT ${EXPORT_MAX_ROWS - totalRows + 1}`;
      // Count and measure the snapshot before transferring potentially large text
      // values to application memory. Both reads see the same repeatable snapshot.
      const size = await client.query(
        `SELECT count(*)::int AS count,coalesce(sum(octet_length(row_to_json(exported)::text)),0)::text AS bytes FROM (${source}) exported`,
        values,
      );
      totalRows += Number(size.rows[0].count);
      rowBytes += Number(size.rows[0].bytes);
      if (totalRows > EXPORT_MAX_ROWS || rowBytes > EXPORT_MAX_BYTES)
        throw new ExportError(
          413,
          "EXPORT_TOO_LARGE",
          "This workspace exceeds the export limit. Contact support for an assisted export.",
        );
      data[table] = (await client.query(source, values)).rows;
    }
    if (Date.now() - startedAt > EXPORT_MAX_DURATION_MS)
      throw new ExportError(
        503,
        "EXPORT_TIMEOUT",
        "Workspace export took too long. Try again later or contact support.",
      );
    const json = JSON.stringify({
      format: EXPORT_FORMAT,
      exportedAt: new Date().toISOString(),
      workspace: { id: tenant.id, code: tenant.code, name: tenant.name },
      requestedBy: actor.id,
      coverage: EXPORT_COVERAGE,
      totalRows,
      data,
    });
    const bytes = Buffer.byteLength(json);
    if (bytes > EXPORT_MAX_BYTES)
      throw new ExportError(
        413,
        "EXPORT_TOO_LARGE",
        "This workspace exceeds the export limit. Contact support for an assisted export.",
      );
    await client.query("COMMIT");
    transactionOpen = false;
    // Record only metadata, never exported content or authentication material.
    await client.query(
      "INSERT INTO ez_control.audit(id,tenant_id,action,detail) VALUES($1,$2,$3,$4)",
      [
        randomUUID(),
        tenant.id,
        "tenant.export_completed",
        JSON.stringify({
          userId: actor.id,
          totalRows,
          bytes,
          format: EXPORT_FORMAT,
        }),
      ],
    );
    return { json, filename: `E-Z-${tenant.code}-workspace.json` };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    activeExports.delete(tenant.id);
  }
}
