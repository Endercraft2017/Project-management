import { randomUUID } from "node:crypto";
import { ensureControlSchema, getControlPool } from "./store";
import { getTenantContext } from "../tenancy/context";
export type JobKind =
  | "notes_due"
  | "daily_reminder"
  | "weekly_summary_email"
  | "summary_generate";
export interface DurableJob {
  id: string;
  tenantId: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  leaseOwner: string;
}
let ready: Promise<void> | undefined;
export async function ensureJobSchema(): Promise<void> {
  if (!ready)
    ready = (async () => {
      await ensureControlSchema();
      await getControlPool().query(`CREATE TABLE IF NOT EXISTS ez_control.jobs (
      id UUID PRIMARY KEY,tenant_id UUID NOT NULL REFERENCES ez_control.tenants(id),kind TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,payload JSONB NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','RUNNING','DONE','FAILED')),
      attempts INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 5),
      available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),lease_owner UUID,lease_until TIMESTAMPTZ,
      last_error_code TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),finished_at TIMESTAMPTZ,
      UNIQUE(tenant_id,kind,idempotency_key));
      CREATE INDEX IF NOT EXISTS jobs_claim_idx ON ez_control.jobs(status,available_at,lease_until);
      CREATE TABLE IF NOT EXISTS ez_control.worker_heartbeats(id UUID PRIMARY KEY,last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
    })().catch((error) => {
      ready = undefined;
      throw error;
    });
  await ready;
}
export async function enqueueJob(
  kind: JobKind,
  payload: Record<string, unknown>,
  key: string,
  maxAttempts = 3,
): Promise<string> {
  const tenant = getTenantContext();
  let serialized: string;
  try {
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      Object.getPrototypeOf(payload) !== Object.prototype
    )
      throw new Error();
    serialized = JSON.stringify(payload);
    if (typeof serialized !== "string") throw new Error();
  } catch {
    throw new Error("Invalid job envelope");
  }
  if (
    ![
      "notes_due",
      "daily_reminder",
      "weekly_summary_email",
      "summary_generate",
    ].includes(kind) ||
    !key ||
    key.length > 180 ||
    Buffer.byteLength(serialized) > 16384 ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 5
  )
    throw new Error("Invalid job envelope");
  await ensureJobSchema();
  const result = await getControlPool().query(
    `INSERT INTO ez_control.jobs(id,tenant_id,kind,idempotency_key,payload,max_attempts)
    SELECT $1,$2,$3,$4,$5::jsonb,$6 FROM ez_control.tenants WHERE id=$2 AND status='ACTIVE'
    ON CONFLICT(tenant_id,kind,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id`,
    [
      randomUUID(),
      tenant.id,
      kind,
      key,
      serialized,
      ["summary_generate", "weekly_summary_email"].includes(kind)
        ? 1
        : maxAttempts,
    ],
  );
  if (!result.rows[0]) throw new Error("Active tenant required for jobs");
  return result.rows[0].id;
}
/** Liveness while scanning (no job lease is held in this phase). */
export async function touchWorker(workerId: string): Promise<void> {
  await ensureJobSchema();
  await getControlPool().query(
    `INSERT INTO ez_control.worker_heartbeats(id,last_seen_at) VALUES($1,NOW())
     ON CONFLICT(id) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at`,
    [workerId],
  );
}
export async function claimJob(workerId: string): Promise<DurableJob | null> {
  await ensureJobSchema();
  const c = await getControlPool().connect();
  try {
    await c.query("BEGIN");
    await c.query(
      `INSERT INTO ez_control.worker_heartbeats(id) VALUES($1) ON CONFLICT(id) DO UPDATE SET last_seen_at=NOW()`,
      [workerId],
    );
    await c.query(
      `UPDATE ez_control.jobs SET status='FAILED',last_error_code='LEASE_EXHAUSTED',finished_at=NOW() WHERE status='RUNNING' AND lease_until<NOW() AND attempts>=max_attempts`,
    );
    const result = await c.query(
      `WITH candidate AS (
      SELECT j.id FROM ez_control.jobs j JOIN ez_control.tenants t ON t.id=j.tenant_id AND t.status='ACTIVE'
      WHERE ((j.status='QUEUED' AND j.available_at<=NOW()) OR (j.status='RUNNING' AND j.lease_until<NOW()))
      AND j.attempts<j.max_attempts ORDER BY j.available_at,j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1)
      UPDATE ez_control.jobs j SET status='RUNNING',attempts=attempts+1,lease_owner=$1,lease_until=NOW()+INTERVAL '90 seconds'
      FROM candidate WHERE j.id=candidate.id RETURNING j.*`,
      [workerId],
    );
    await c.query("COMMIT");
    const r = result.rows[0];
    return r
      ? {
          id: r.id,
          tenantId: r.tenant_id,
          kind: r.kind,
          payload: r.payload,
          attempts: r.attempts,
          maxAttempts: r.max_attempts,
          leaseOwner: r.lease_owner,
        }
      : null;
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}
export async function renewJob(job: DurableJob): Promise<boolean> {
  const r = await getControlPool().query(
    `WITH renewed AS (
      UPDATE ez_control.jobs SET lease_until=NOW()+INTERVAL '90 seconds'
      WHERE id=$1 AND status='RUNNING' AND lease_owner=$2 AND lease_until>NOW()
      RETURNING lease_owner
    )
    INSERT INTO ez_control.worker_heartbeats(id,last_seen_at)
    SELECT lease_owner,NOW() FROM renewed
    ON CONFLICT(id) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at RETURNING id`,
    [job.id, job.leaseOwner],
  );
  return r.rowCount === 1;
}
export async function completeJob(job: DurableJob): Promise<boolean> {
  const r = await getControlPool().query(
    `UPDATE ez_control.jobs SET status='DONE',finished_at=NOW(),lease_until=NULL
    WHERE id=$1 AND status='RUNNING' AND lease_owner=$2 AND lease_until>NOW() RETURNING id`,
    [job.id, job.leaseOwner],
  );
  return r.rowCount === 1;
}
export async function failJob(
  job: DurableJob,
  errorCode: string,
): Promise<void> {
  const safe = /^[A-Z0-9_]{1,80}$/.test(errorCode) ? errorCode : "JOB_FAILED";
  await getControlPool().query(
    `UPDATE ez_control.jobs SET status=CASE WHEN attempts>=max_attempts THEN 'FAILED' ELSE 'QUEUED' END,
    available_at=NOW()+make_interval(secs=>LEAST(300,attempts*30)),lease_until=NULL,lease_owner=NULL,last_error_code=$3,
    finished_at=CASE WHEN attempts>=max_attempts THEN NOW() ELSE NULL END
    WHERE id=$1 AND status='RUNNING' AND lease_owner=$2 AND lease_until>NOW()`,
    [job.id, job.leaseOwner, safe],
  );
}
export async function workerIsReady(): Promise<boolean> {
  await ensureJobSchema();
  const r = await getControlPool().query(
    `SELECT EXISTS(SELECT 1 FROM ez_control.worker_heartbeats WHERE last_seen_at>NOW()-INTERVAL '2 minutes') AS ready`,
  );
  return r.rows[0].ready;
}

/** A clean shutdown stops advertising readiness immediately; crashes expire by TTL. */
export async function forgetWorker(workerId: string): Promise<void> {
  await ensureJobSchema();
  await getControlPool().query(
    "DELETE FROM ez_control.worker_heartbeats WHERE id=$1",
    [workerId],
  );
}
