import { randomUUID } from "node:crypto";
import { ensureControlSchema, getControlPool } from "./store";

export class UsageError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 403,
  ) {
    super(message);
    this.name = "UsageError";
  }
}
function validAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new UsageError(
      "Usage must be a non-negative safe integer",
      "INVALID_USAGE",
      400,
    );
}
export async function reserveStorage(
  tenantId: string,
  bytes: number,
): Promise<void> {
  validAmount(bytes);
  await ensureControlSchema();
  const result = await getControlPool().query(
    `UPDATE ez_control.tenants SET storage_bytes_used = storage_bytes_used + $2, updated_at = NOW()
     WHERE id = $1 AND status = 'ACTIVE' AND storage_bytes_used <= storage_limit_bytes - $2 RETURNING id`,
    [tenantId, bytes],
  );
  if (result.rowCount !== 1)
    throw new UsageError(
      "Storage unavailable or tenant allowance exceeded",
      "STORAGE_QUOTA_EXCEEDED",
      413,
    );
}
/** Release only the known size of an allocation this operation owns. */
export async function releaseStorage(
  tenantId: string,
  bytes: number,
): Promise<void> {
  validAmount(bytes);
  await ensureControlSchema();
  await getControlPool().query(
    `UPDATE ez_control.tenants SET storage_bytes_used = GREATEST(0, storage_bytes_used - $2), updated_at = NOW() WHERE id = $1`,
    [tenantId, bytes],
  );
}
export const reserveStorageBytes = reserveStorage;
export const releaseStorageBytes = releaseStorage;
export interface AIReservation {
  id: string;
  tenantId: string;
  reservedTokens: number;
}
let usageReady: Promise<void> | undefined;
export async function ensureUsageSchema(): Promise<void> {
  if (!usageReady)
    usageReady = (async () => {
      await ensureControlSchema();
      await getControlPool()
        .query(`CREATE TABLE IF NOT EXISTS ez_control.ai_reservations (
      id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES ez_control.tenants(id),
      reserved_tokens BIGINT NOT NULL CHECK (reserved_tokens >= 0), actual_tokens BIGINT CHECK (actual_tokens >= 0),
      status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','SETTLED','UNCERTAIN')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 minutes', settled_at TIMESTAMPTZ);
      CREATE INDEX IF NOT EXISTS ai_reservations_active_idx ON ez_control.ai_reservations (status, expires_at, tenant_id);`);
    })().catch((error) => {
      usageReady = undefined;
      throw error;
    });
  await usageReady;
}
function concurrencyLimit(): number {
  const n = Number(process.env.AI_MAX_CONCURRENT || 2);
  return Number.isSafeInteger(n) && n >= 1 && n <= 5 ? n : 2;
}
/** In-flight reservations consume quota. A crash never silently refunds a paid attempt. */
export async function reserveAIUsage(
  tenantId: string,
  tokens: number,
): Promise<AIReservation> {
  validAmount(tokens);
  if (tokens === 0)
    throw new UsageError(
      "AI reservation must be positive",
      "INVALID_USAGE",
      400,
    );
  await ensureUsageSchema();
  const c = await getControlPool().connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(183091, 1)");
    const active = await c.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE tenant_id=$1)::int AS tenant
      FROM ez_control.ai_reservations WHERE status='RESERVED' AND expires_at>NOW()`,
      [tenantId],
    );
    if (
      active.rows[0].total >= concurrencyLimit() ||
      active.rows[0].tenant >= 1
    )
      throw new UsageError(
        "AI generation is busy; retry after the current request finishes",
        "AI_BUSY",
        429,
      );
    const changed = await c.query(
      `UPDATE ez_control.tenants SET ai_tokens_used=ai_tokens_used+$2, updated_at=NOW()
      WHERE id=$1 AND status='ACTIVE' AND ai_token_limit>0 AND ai_tokens_used<=ai_token_limit-$2 RETURNING id`,
      [tenantId, tokens],
    );
    if (changed.rowCount !== 1)
      throw new UsageError(
        "AI is disabled or the tenant token allowance is exhausted",
        "AI_QUOTA_EXCEEDED",
        403,
      );
    const id = randomUUID();
    await c.query(
      "INSERT INTO ez_control.ai_reservations (id,tenant_id,reserved_tokens) VALUES ($1,$2,$3)",
      [id, tenantId, tokens],
    );
    await c.query("COMMIT");
    return { id, tenantId, reservedTokens: tokens };
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}
/** Undefined provider usage is uncertain: retain the full conservative charge. Settlement is idempotent. */
export async function settleAIUsage(
  reservation: AIReservation,
  actualTokens?: number,
): Promise<void> {
  if (actualTokens !== undefined) validAmount(actualTokens);
  await ensureUsageSchema();
  const c = await getControlPool().connect();
  try {
    await c.query("BEGIN");
    const row = await c.query(
      `UPDATE ez_control.ai_reservations SET status=$3,actual_tokens=$4,settled_at=NOW()
      WHERE id=$1 AND tenant_id=$2 AND status='RESERVED' RETURNING reserved_tokens`,
      [
        reservation.id,
        reservation.tenantId,
        actualTokens === undefined ? "UNCERTAIN" : "SETTLED",
        actualTokens ?? null,
      ],
    );
    if (row.rowCount === 1 && actualTokens !== undefined)
      await c.query(
        `UPDATE ez_control.tenants SET ai_tokens_used=GREATEST(0,ai_tokens_used+$2),updated_at=NOW() WHERE id=$1`,
        [
          reservation.tenantId,
          actualTokens - Number(row.rows[0].reserved_tokens),
        ],
      );
    await c.query("COMMIT");
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}
