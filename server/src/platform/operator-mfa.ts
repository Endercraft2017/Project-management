import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';
import { getControlPool } from './pool';
import { ensureControlSchema, type Operator } from './store';

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
let initialized: Promise<void> | undefined;
export function mfaConfigured(): boolean {
  return /^[a-f0-9]{64}$/i.test(process.env.CONSOLE_MFA_ENCRYPTION_KEY || '');
}
function encryptionKey(): Buffer {
  if (!mfaConfigured()) throw fail(503, 'Operator MFA is unavailable; contact your platform operator');
  return Buffer.from(process.env.CONSOLE_MFA_ENCRYPTION_KEY!, 'hex');
}
export function encryptMfaSecret(operatorId: string, secret: string): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`ez.operator-mfa.v1:${operatorId}`));
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((value) => value.toString('base64url')).join('.');
}
export function decryptMfaSecret(operatorId: string, encoded: string): string {
  try {
    const parts = encoded.split('.').map((value) => Buffer.from(value, 'base64url'));
    if (parts.length !== 3 || parts[0].length !== 12 || parts[1].length !== 16) throw new Error('Invalid encoding');
    const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), parts[0]);
    cipher.setAAD(Buffer.from(`ez.operator-mfa.v1:${operatorId}`)); cipher.setAuthTag(parts[1]);
    return Buffer.concat([cipher.update(parts[2]), cipher.final()]).toString('utf8');
  } catch { throw fail(503, 'Operator MFA is unavailable; contact your platform operator'); }
}
export function makeTotp(secret: string, label = 'Operator'): TOTP {
  return new TOTP({ issuer: 'E-Z operator console', label, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
}
export function acceptedCounter(secret: string, token: string, lastCounter: number, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(token)) return null;
  const delta = makeTotp(secret).validate({ token, timestamp: now, window: 1 });
  if (delta === null) return null;
  const counter = Math.floor(now / 30000) + delta;
  return counter > lastCounter ? counter : null;
}
export const recoveryHash = (code: string) => createHash('sha256').update(code.replace(/-/g, '').toLowerCase()).digest('hex');

export async function ensureMfaSchema(): Promise<void> {
  if (!initialized) initialized = ensureControlSchema().then(() => getControlPool().query(`
    SELECT pg_advisory_xact_lock(817632942);
    CREATE TABLE IF NOT EXISTS ez_control.operator_mfa(
      operator_id UUID PRIMARY KEY REFERENCES ez_control.operators(id),
      secret_cipher TEXT,enabled BOOLEAN NOT NULL DEFAULT false,last_counter BIGINT NOT NULL DEFAULT -1,
      recovery_hashes JSONB NOT NULL DEFAULT '[]',pending_cipher TEXT,pending_expires TIMESTAMPTZ,pending_version INTEGER);
  `)).then(() => undefined).catch((error) => { initialized = undefined; throw error; });
  return initialized;
}
export async function operatorMfaEnabled(id: string): Promise<boolean> {
  await ensureMfaSchema();
  const result = await getControlPool().query('SELECT enabled FROM ez_control.operator_mfa WHERE operator_id=$1', [id]);
  return result.rows[0]?.enabled === true;
}
export async function beginMfaEnrollment(operator: Operator): Promise<{ secret: string; uri: string; expiresInSeconds: number }> {
  encryptionKey(); await ensureMfaSchema();
  const secret = new Secret({ size: 20 }).base32, cipher = encryptMfaSecret(operator.id, secret);
  const client = await getControlPool().connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT session_version FROM ez_control.operators WHERE id=$1 FOR UPDATE', [operator.id]);
    if (current.rows[0]?.session_version !== operator.sessionVersion) throw fail(409, 'Operator credentials changed; sign in again');
    const old = await client.query('SELECT enabled FROM ez_control.operator_mfa WHERE operator_id=$1 FOR UPDATE', [operator.id]);
    if (old.rows[0]?.enabled) throw fail(409, 'Operator MFA is already enabled');
    await client.query(`INSERT INTO ez_control.operator_mfa(operator_id,pending_cipher,pending_expires,pending_version)
      VALUES($1,$2,now()+interval '10 minutes',$3) ON CONFLICT(operator_id) DO UPDATE
      SET pending_cipher=$2,pending_expires=now()+interval '10 minutes',pending_version=$3`, [operator.id, cipher, operator.sessionVersion]);
    await client.query('COMMIT');
    return { secret, uri: makeTotp(secret, operator.email).toString(), expiresInSeconds: 600 };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
function operatorFromRow(row: Record<string, unknown>): Operator {
  return { id: String(row.id), email: String(row.email), name: String(row.name), sessionVersion: Number(row.session_version) };
}
async function record(client: { query: (sql: string, args: unknown[]) => Promise<unknown> }, id: string, action: string) {
  await client.query('INSERT INTO ez_control.audit(id,operator_id,action,detail) VALUES($1,$2,$3,$4)', [randomUUID(), id, action, '{}']);
}
export async function confirmMfaEnrollment(id: string, version: number, token: string): Promise<{ operator: Operator; recoveryCodes: string[] }> {
  await ensureMfaSchema(); const client = await getControlPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT o.id,o.email,o.name,o.session_version,m.* FROM ez_control.operators o
      JOIN ez_control.operator_mfa m ON m.operator_id=o.id WHERE o.id=$1 FOR UPDATE OF o,m`, [id]);
    const row = result.rows[0];
    if (!row || row.enabled || row.session_version !== version || row.pending_version !== version ||
      !row.pending_cipher || new Date(row.pending_expires).getTime() <= Date.now()) throw fail(400, 'Enrollment expired or invalid; start again');
    const secret = decryptMfaSecret(id, row.pending_cipher), counter = acceptedCounter(secret, token, -1);
    if (counter === null) throw fail(400, 'Authenticator code could not be verified');
    const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(16).toString('hex').match(/.{1,8}/g)!.join('-'));
    await client.query(`UPDATE ez_control.operator_mfa SET enabled=true,secret_cipher=pending_cipher,last_counter=$2,
      recovery_hashes=$3,pending_cipher=NULL,pending_expires=NULL,pending_version=NULL WHERE operator_id=$1`, [id, counter, JSON.stringify(recoveryCodes.map(recoveryHash))]);
    const changed = await client.query('UPDATE ez_control.operators SET session_version=session_version+1 WHERE id=$1 RETURNING id,email,name,session_version', [id]);
    await record(client, id, 'operator.mfa_enabled'); await client.query('COMMIT');
    return { operator: operatorFromRow(changed.rows[0]), recoveryCodes };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

/** Row locking makes TOTP counters and random recovery codes single-use across processes. */
export async function verifyOperatorMfa(id: string, version: number, token: string, disable = false): Promise<Operator> {
  await ensureMfaSchema(); encryptionKey(); const client = await getControlPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT o.id,o.email,o.name,o.session_version,m.* FROM ez_control.operators o
      JOIN ez_control.operator_mfa m ON m.operator_id=o.id WHERE o.id=$1 FOR UPDATE OF o,m`, [id]);
    const row = result.rows[0];
    if (!row || !row.enabled || row.session_version !== version) throw fail(401, 'Authenticator or recovery code could not be verified');
    const secret = decryptMfaSecret(id, row.secret_cipher);
    let counter: number | null = null, hashes: string[] = row.recovery_hashes;
    if (/^\d{6}$/.test(token)) counter = acceptedCounter(secret, token, Number(row.last_counter));
    else {
      if (!/^[a-f0-9-]{32,39}$/i.test(token) || token.replace(/-/g, '').length !== 32) throw fail(401, 'Authenticator or recovery code could not be verified');
      const hash = recoveryHash(token), index = hashes.findIndex((value) => timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(hash, 'hex')));
      if (index < 0) throw fail(401, 'Authenticator or recovery code could not be verified');
      hashes = hashes.filter((_, i) => i !== index); counter = Number(row.last_counter);
    }
    if (counter === null) throw fail(401, 'Authenticator or recovery code could not be verified');
    if (disable) {
      await client.query(`UPDATE ez_control.operator_mfa SET enabled=false,secret_cipher=NULL,last_counter=-1,recovery_hashes='[]',
        pending_cipher=NULL,pending_expires=NULL,pending_version=NULL WHERE operator_id=$1`, [id]);
      const changed = await client.query('UPDATE ez_control.operators SET session_version=session_version+1 WHERE id=$1 RETURNING id,email,name,session_version', [id]);
      await record(client, id, 'operator.mfa_disabled'); await client.query('COMMIT'); return operatorFromRow(changed.rows[0]);
    }
    await client.query('UPDATE ez_control.operator_mfa SET last_counter=$2,recovery_hashes=$3 WHERE operator_id=$1', [id, counter, JSON.stringify(hashes)]);
    await record(client, id, 'operator.mfa_verified'); await client.query('COMMIT'); return operatorFromRow(row);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
