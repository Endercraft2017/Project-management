# Bounded workspace export

`GET /api/export/workspace` creates a JSON attachment `E-Z-<company-code>-workspace.json`. It uses the normal company session and `X-EZ-Workspace` context, requires an active tenant administrator, and rechecks role/account state, session version and company status inside a read-only PostgreSQL **REPEATABLE READ** transaction. Query parameters cannot select a tenant/schema. The server uses validated tenant context and explicit column allowlists.

Format `ez-workspace-export/1` contains `exportedAt`, safe workspace identity, `requestedBy`, coverage/exclusion notes, aggregate `totalRows` and `data`. Dates are JSON strings; bigint attachment sizes are strings to preserve precision. Table arrays have deterministic ID ordering and share one snapshot.

## Coverage

Included: safe user directory; projects including archived projects; sprints/tasks; daily updates; invitation metadata without tokens; summaries without raw source data; conversations/messages/members **only where the requester is a member in the snapshot**. Attachment metadata covers the requester's generic files and files/Drive attachments in those conversations, excluding paths/URLs/provider file IDs. Deleted message content is blanked and its attached file metadata is omitted.

Excluded: all personal notes/reminders/notifications, conversations outside requester membership, file contents, signed/external attachment URLs, password hashes/session versions, session/invitation/setup tokens, provider credentials, settings/sync logs, raw AI source data and control-plane/operator records. Administrator status does not grant access to other people's private conversations, generic files or notes through export.

This is a **workspace snapshot**, not a complete personal-data portability response, database backup, file archive or supported restore format. Downloading metadata does not retrieve file bytes. Original message attachment URL JSON is deliberately omitted; authorized attachment metadata is provided separately. Free-form user text can still contain sensitive content that users entered themselves.

## Bounds and failures

- At most **10,000 aggregate rows** and **20 MiB final JSON**. Excess fails `413 EXPORT_TOO_LARGE`, without silently truncated success.
- Before fetching rows, SQL counts/measures a bounded candidate set in the same snapshot. Text beyond the byte budget is not transferred into application memory.
- Only **one export per API process** runs at a time; competing requests receive `429 EXPORT_BUSY`. An in-memory limiter allows two requests per administrator/company/hour. Limits reset on restart and are not distributed across replicas.
- Individual SQL statements have a 10-second timeout. Generation is checked against 15 seconds between statements and before serialization; an active statement can take its own timeout beyond that budget. No partial export is returned.
- Changed access: `403 EXPORT_ACCESS_CHANGED`; normal authentication/role failures apply to anonymous/member accounts. Query parameters: `400 INVALID_EXPORT_REQUEST`.
- All route responses use `Cache-Control: no-store, private` and `Referrer-Policy: no-referrer`. The browser downloads locally; E-Z creates no server-side export file or external bucket object.
- After generation, `tenant.export_completed` records only requester ID, format, row count and bytes. It proves generation, not confirmed browser delivery. Audit-storage failure prevents sending the export. Recipients must store downloaded copies privately.

## Verification

`scripts/workspace-export-smoke.ts` requires a loopback `TEST_DATABASE_URL` ending `_test`, creates a random sibling database, and removes only its owned database. It uses the built API/real cookies to test colliding identities across companies, anonymous/member denial, exclusions, fresh authorization, actual row/byte excess, audit metadata and request limits. No customer data or external provider is used.

```sh
npm run build --workspace=server
node --env-file=/path/to/private/local-test.env node_modules/tsx/dist/cli.mjs scripts/workspace-export-smoke.ts
```

Maintained Jest covers allowlists/rollback/cleanup. Never point the harness at production or a remote/customer database.
