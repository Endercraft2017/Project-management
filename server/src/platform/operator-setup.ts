import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hashPassword, newPasswordSchema } from '../auth/password';
import { ensureControlSchema } from './store';
import { getControlPool } from './pool';

const setupCodeSchema = z.string().regex(/^[a-f0-9]{64}$/);
const identitySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(100), setupCode: setupCodeSchema,
}).strict();
export const operatorActivationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  setupCode: setupCodeSchema, password: newPasswordSchema,
}).strict();
let initialization: Promise<void> | undefined;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

async function ensureSetupSchema(): Promise<void> {
  await ensureControlSchema();
  if (!initialization) initialization = (async () => {
    const client = await getControlPool().connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('ez_control.operator_setup_schema'))");
      await client.query(`CREATE TABLE IF NOT EXISTS ez_control.operator_setup_tokens(
        operator_id UUID PRIMARY KEY REFERENCES ez_control.operators(id),
        token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ)`);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  })().catch((error) => { initialization = undefined; throw error; });
  return initialization;
}

/** Administrative startup only: public requests can redeem, never provision. */
export async function provisionInitialOperator(input: {
  email: string; name: string; setupCode: string;
}): Promise<'created' | 'already-exists'> {
  const parsed = identitySchema.parse(input);
  await ensureSetupSchema();
  // No one knows this random password. Only activation can replace it.
  const passwordHash = await hashPassword(randomBytes(32).toString('hex'));
  const client = await getControlPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('ez_control.bootstrap_operator'))");
    const existing = await client.query('SELECT count(*) AS count FROM ez_control.operators');
    if (Number(existing.rows[0].count) !== 0) {
      await client.query('ROLLBACK'); return 'already-exists';
    }
    const id = randomUUID();
    await client.query(`INSERT INTO ez_control.operators(id,email,name,password_hash)
      VALUES($1,$2,$3,$4)`, [id, parsed.email, parsed.name, passwordHash]);
    await client.query(`INSERT INTO ez_control.operator_setup_tokens(operator_id,token_hash,expires_at)
      VALUES($1,$2,now()+interval '1 hour')`, [id, digest(parsed.setupCode)]);
    await client.query(`INSERT INTO ez_control.audit(id,operator_id,action)
      VALUES($1,$2,'operator.setup_provisioned')`, [randomUUID(), id]);
    await client.query('COMMIT'); return 'created';
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

/** Private administrative recovery of an expired, never-redeemed INITIAL setup. */
export async function reissueExpiredInitialOperatorSetup(input: {
  email: string; name: string; setupCode: string;
}): Promise<'reissued'> {
  const parsed = identitySchema.parse(input);
  await ensureSetupSchema();
  const client = await getControlPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('ez_control.bootstrap_operator'))");
    const count = await client.query('SELECT count(*) AS count FROM ez_control.operators');
    if (Number(count.rows[0].count) !== 1) throw new Error('Pending initial operator setup cannot be reissued');
    // Same lock order as redemption. Lock the operator too, so activation or a
    // credential change cannot race the pending-state verification.
    const existing = await client.query(`SELECT t.operator_id,t.token_hash,t.consumed_at,
      t.expires_at<=now() AS expired,o.session_version
      FROM ez_control.operator_setup_tokens t JOIN ez_control.operators o ON o.id=t.operator_id
      WHERE o.email=$1 FOR UPDATE OF t,o`, [parsed.email]);
    const token = existing.rows[0], nextHash = digest(parsed.setupCode);
    if (!token || token.consumed_at !== null || token.expired !== true ||
      token.session_version !== 0 || token.token_hash === nextHash) {
      throw new Error('Pending initial operator setup cannot be reissued');
    }
    await client.query(`UPDATE ez_control.operator_setup_tokens
      SET token_hash=$1,expires_at=now()+interval '1 hour' WHERE operator_id=$2`, [nextHash, token.operator_id]);
    await client.query(`INSERT INTO ez_control.audit(id,operator_id,action)
      VALUES($1,$2,'operator.setup_reissued')`, [randomUUID(), token.operator_id]);
    await client.query('COMMIT'); return 'reissued';
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

/** Explicit enablement and all fields required; partial config fails closed. */
export async function provisionInitialOperatorFromEnvironment(): Promise<'disabled' | 'created' | 'already-exists' | 'reissued'> {
  if (process.env.OPERATOR_BOOTSTRAP_ENABLED !== 'true') return 'disabled';
  const email = process.env.OPERATOR_SETUP_EMAIL, name = process.env.OPERATOR_SETUP_NAME;
  const setupCode = process.env.OPERATOR_SETUP_CODE;
  try {
    if (!email || !name || !setupCode) throw new Error('Initial operator setup configuration is incomplete');
    if (process.env.OPERATOR_SETUP_REISSUE_PENDING === 'true') {
      return await reissueExpiredInitialOperatorSetup({ email, name, setupCode });
    }
    return await provisionInitialOperator({ email, name, setupCode });
  } finally {
    delete process.env.OPERATOR_SETUP_EMAIL;
    delete process.env.OPERATOR_SETUP_NAME;
    delete process.env.OPERATOR_SETUP_CODE;
    delete process.env.OPERATOR_BOOTSTRAP_ENABLED;
    delete process.env.OPERATOR_SETUP_REISSUE_PENDING;
  }
}

/** One use, one hour, exact operator binding. New explicit login required. */
export async function activateInitialOperator(raw: unknown): Promise<void> {
  const parsed = operatorActivationSchema.parse(raw);
  await ensureSetupSchema();
  const passwordHash = await hashPassword(parsed.password);
  const client = await getControlPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT t.operator_id FROM ez_control.operator_setup_tokens t
      JOIN ez_control.operators o ON o.id=t.operator_id
      WHERE t.token_hash=$1 AND o.email=$2 AND t.consumed_at IS NULL AND t.expires_at>now()
      FOR UPDATE OF t,o`, [digest(parsed.setupCode), parsed.email]);
    if (result.rows.length !== 1) throw new Error('Invalid operator setup');
    const id = result.rows[0].operator_id;
    await client.query(`UPDATE ez_control.operators SET password_hash=$1,session_version=session_version+1 WHERE id=$2`, [passwordHash, id]);
    await client.query('UPDATE ez_control.operator_setup_tokens SET consumed_at=now() WHERE operator_id=$1', [id]);
    await client.query(`INSERT INTO ez_control.audit(id,operator_id,action)
      VALUES($1,$2,'operator.setup_completed')`, [randomUUID(), id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
