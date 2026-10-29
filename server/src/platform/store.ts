import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { PoolClient } from 'pg';
import { TenantContext, TenantStatus, validateSchemaName } from '../tenancy/context';
import { getControlPool } from './pool';
import { tenantSchemaSql } from './tenant-schema';
export { getControlPool, closeControlPool } from './pool';

export interface Tenant extends TenantContext {
  seatLimit: number;
  ownerEmail: string; ownerName: string; storageLimitBytes: number; storageBytesUsed: number;
  aiTokenLimit: number; aiTokensUsed: number; createdAt: string; updatedAt: string;
}
export interface Operator { id: string; email: string; name: string; sessionVersion: number; }
export const tenantLifecycleEvents = new EventEmitter();
let initialization: Promise<void> | undefined;

export function ensureControlSchema(): Promise<void> {
  if (!initialization) initialization = getControlPool().query(`
    SELECT pg_advisory_xact_lock(817632941);
    CREATE SCHEMA IF NOT EXISTS ez_control;
    CREATE TABLE IF NOT EXISTS ez_control.company_sequences(pair TEXT PRIMARY KEY,next_number INTEGER NOT NULL CHECK(next_number>=0));
    CREATE TABLE IF NOT EXISTS ez_control.tenants(
      id UUID PRIMARY KEY, code TEXT NOT NULL UNIQUE CHECK(code ~ '^[A-Z][0-9]{4}[A-Z]$'),
      name TEXT NOT NULL, schema_name TEXT NOT NULL UNIQUE CHECK(schema_name ~ '^ez_t_[a-f0-9]{16,64}$'),
      status TEXT NOT NULL CHECK(status IN ('PROVISIONING','ACTIVE','SUSPENDED','FAILED')),
      owner_email TEXT NOT NULL, owner_name TEXT NOT NULL, owner_user_id TEXT NOT NULL,
      storage_limit_bytes BIGINT NOT NULL DEFAULT 104857600 CHECK(storage_limit_bytes>=0),
      storage_bytes_used BIGINT NOT NULL DEFAULT 0 CHECK(storage_bytes_used>=0),
      ai_token_limit BIGINT NOT NULL DEFAULT 0 CHECK(ai_token_limit>=0),
      ai_tokens_used BIGINT NOT NULL DEFAULT 0 CHECK(ai_tokens_used>=0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS ez_control.operators(
      id UUID PRIMARY KEY,email TEXT NOT NULL UNIQUE CHECK(email=lower(email)),name TEXT NOT NULL,
      password_hash TEXT NOT NULL,session_version INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS ez_control.setup_tokens(
      id UUID PRIMARY KEY,tenant_id UUID NOT NULL REFERENCES ez_control.tenants(id),
      token_hash TEXT NOT NULL UNIQUE,expires_at TIMESTAMPTZ NOT NULL,consumed_at TIMESTAMPTZ);
    ALTER TABLE ez_control.setup_tokens ADD COLUMN IF NOT EXISTS target_user_id TEXT;
    ALTER TABLE ez_control.setup_tokens ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'OWNER_SETUP';
    UPDATE ez_control.setup_tokens SET purpose='INVITE' WHERE target_user_id IS NOT NULL AND purpose='OWNER_SETUP';
    ALTER TABLE ez_control.tenants ADD COLUMN IF NOT EXISTS seat_limit INTEGER NOT NULL DEFAULT 10 CHECK(seat_limit>0);
    CREATE TABLE IF NOT EXISTS ez_control.tenant_sessions(sid VARCHAR PRIMARY KEY,sess JSON NOT NULL,expire TIMESTAMP(6) NOT NULL);
    CREATE INDEX IF NOT EXISTS tenant_sessions_expire_idx ON ez_control.tenant_sessions(expire);
    CREATE TABLE IF NOT EXISTS ez_control.operator_sessions(sid VARCHAR PRIMARY KEY,sess JSON NOT NULL,expire TIMESTAMP(6) NOT NULL);
    CREATE INDEX IF NOT EXISTS operator_sessions_expire_idx ON ez_control.operator_sessions(expire);
    CREATE TABLE IF NOT EXISTS ez_control.audit(
      id UUID PRIMARY KEY,tenant_id UUID REFERENCES ez_control.tenants(id),operator_id UUID,
      action TEXT NOT NULL,detail JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS audit_created_at_idx ON ez_control.audit(created_at DESC);
    CREATE OR REPLACE FUNCTION ez_control.immutable_tenant_identity() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.code<>OLD.code OR NEW.schema_name<>OLD.schema_name OR NEW.id<>OLD.id THEN
        RAISE EXCEPTION 'Tenant identity is immutable';
      END IF;
      RETURN NEW;
    END $$;
    DROP TRIGGER IF EXISTS tenant_identity_immutable ON ez_control.tenants;
    CREATE TRIGGER tenant_identity_immutable BEFORE UPDATE ON ez_control.tenants
      FOR EACH ROW EXECUTE FUNCTION ez_control.immutable_tenant_identity();
  `).then(() => undefined).catch((error) => { initialization = undefined; throw error; });
  return initialization;
}

const iso = (value: Date | string) => new Date(value).toISOString();
function mapTenant(row: any): Tenant {
  validateSchemaName(row.schema_name);
  return { id: row.id, code: row.code, name: row.name, schemaName: row.schema_name, status: row.status,
    ownerEmail: row.owner_email, ownerName: row.owner_name, seatLimit: Number(row.seat_limit),
    storageLimitBytes: Number(row.storage_limit_bytes), storageBytesUsed: Number(row.storage_bytes_used),
    aiTokenLimit: Number(row.ai_token_limit), aiTokensUsed: Number(row.ai_tokens_used),
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
export function publicTenant(tenant: Tenant) {
  const { schemaName: _schema, ...safe } = tenant;
  return safe;
}
export async function getTenantByCode(code: string): Promise<Tenant | null> {
  const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!/^[A-Z][0-9]{4}[A-Z]$/.test(normalized)) return null;
  await ensureControlSchema();
  const result = await getControlPool().query('SELECT * FROM ez_control.tenants WHERE code=$1', [normalized]);
  return result.rows[0] ? mapTenant(result.rows[0]) : null;
}
export async function getTenantById(id: string): Promise<Tenant | null> {
  if (!/^[a-f0-9-]{36}$/i.test(id || '')) return null;
  await ensureControlSchema();
  const result = await getControlPool().query('SELECT * FROM ez_control.tenants WHERE id=$1', [id]);
  return result.rows[0] ? mapTenant(result.rows[0]) : null;
}
export async function listTenants(): Promise<Tenant[]> {
  await ensureControlSchema();
  const result = await getControlPool().query('SELECT * FROM ez_control.tenants ORDER BY created_at DESC LIMIT 500');
  return result.rows.map(mapTenant);
}
async function audit(client: Pick<PoolClient, 'query'>, action: string, tenantId?: string, operatorId?: string, detail: object = {}) {
  await client.query('INSERT INTO ez_control.audit(id,tenant_id,operator_id,action,detail) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), tenantId || null, operatorId || null, action, JSON.stringify(detail)]);
}
const emailOf = (email: string) => String(email || '').trim().toLowerCase();
function requiredText(value: string, field: string, max = 120) {
  const text = String(value || '').trim();
  if (!text || text.length > max) throw Object.assign(new Error(`Invalid ${field}`), { status: 400 });
  return text;
}
function limit(value: number | undefined, fallback: number) {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 0) throw Object.assign(new Error('Invalid allowance'), { status: 400 });
  return result;
}
function assertHash(hash: string) {
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) throw new Error('A password hash is required');
}

export async function createTenant(input: { name: string; ownerEmail: string; ownerName: string; storageLimitBytes?: number; aiTokenLimit?: number; seatLimit?: number }, operatorId?: string): Promise<{ tenant: Tenant; setupToken: string }> {
  const name = requiredText(input.name, 'workspace name');
  const ownerName = requiredText(input.ownerName, 'owner name');
  const email = emailOf(input.ownerEmail);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Invalid owner email'), { status: 400 });
  const storage = limit(input.storageLimitBytes, 100 * 1024 * 1024);
  const ai = limit(input.aiTokenLimit, 0);
  const seats = limit(input.seatLimit, 10);
  if(seats<1||seats>10000)throw Object.assign(new Error('Invalid seat limit'),{status:400});
  await ensureControlSchema();
  const id = randomUUID(), ownerId = randomUUID();
  const schema = validateSchemaName(`ez_t_${randomBytes(16).toString('hex')}`);
  const letters = name.normalize('NFKD').toUpperCase().replace(/[^A-Z]/g, '') || 'EZ';
  const pair = `${letters[0]}${letters[letters.length - 1]}`;
  const client = await getControlPool().connect();
  try {
    await client.query('BEGIN');
    const sequence = await client.query(`INSERT INTO ez_control.company_sequences(pair,next_number) VALUES($1,1)
      ON CONFLICT(pair) DO UPDATE SET next_number=ez_control.company_sequences.next_number+1
      RETURNING next_number-1 AS number`, [pair]);
    const number = Number(sequence.rows[0].number);
    if (number > 9999) throw Object.assign(new Error('Company code range exhausted'), { status: 409 });
    const code = `${pair[0]}${String(number).padStart(4, '0')}${pair[1]}`;
    await client.query(`INSERT INTO ez_control.tenants
      (id,code,name,schema_name,status,owner_email,owner_name,owner_user_id,storage_limit_bytes,ai_token_limit,seat_limit)
      VALUES($1,$2,$3,$4,'PROVISIONING',$5,$6,$7,$8,$9,$10)`, [id, code, name, schema, email, ownerName, ownerId, storage, ai,seats]);
    await audit(client, 'tenant.provisioning', id, operatorId);
    await client.query('COMMIT');
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout='60s'");
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      if (/\b(?:public|ez_control)\s*\./i.test(tenantSchemaSql) || /"(?:public|ez_control)"\s*\./i.test(tenantSchemaSql)) throw new Error('Tenant DDL must be unqualified');
      await client.query(tenantSchemaSql);
      await client.query(`INSERT INTO "${schema}".users(id,email,name,role,"isActive","updatedAt") VALUES($1,$2,$3,'ADMIN',true,now())`, [ownerId, email, ownerName]);
      const setupToken = randomBytes(32).toString('hex');
      await client.query(`INSERT INTO ez_control.setup_tokens(id,tenant_id,token_hash,expires_at)
        VALUES($1,$2,$3,now()+interval '24 hours')`, [randomUUID(), id, createHash('sha256').update(setupToken).digest('hex')]);
      const updated = await client.query("UPDATE ez_control.tenants SET status='ACTIVE',updated_at=now() WHERE id=$1 RETURNING *", [id]);
      await audit(client, 'tenant.created', id, operatorId, { code });
      await client.query('COMMIT');
      return { tenant: mapTenant(updated.rows[0]), setupToken };
    } catch {
      await client.query('ROLLBACK');
      await client.query("UPDATE ez_control.tenants SET status='FAILED',updated_at=now() WHERE id=$1", [id]);
      await audit(client, 'tenant.provisioning_failed', id, operatorId);
      throw Object.assign(new Error('Workspace provisioning failed; inspect operator audit'), { status: 500 });
    }
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function activateOwner(input: { tenantCode: string; token: string; passwordHash: string }) {
  assertHash(input.passwordHash);
  const tenant = await getTenantByCode(input.tenantCode);
  const invalid = () => Object.assign(new Error('Invalid or expired setup link'), { status: 400 });
  if (!tenant || !/^[a-f0-9]{64}$/.test(input.token || '')) throw invalid();
  const schema = validateSchemaName(tenant.schemaName);
  const client = await getControlPool().connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT * FROM ez_control.tenants WHERE id=$1 FOR UPDATE', [tenant.id]);
    if (current.rows[0]?.status !== 'ACTIVE') throw invalid();
    const token = await client.query(`SELECT id,target_user_id,purpose FROM ez_control.setup_tokens WHERE tenant_id=$1 AND token_hash=$2
      AND consumed_at IS NULL AND expires_at>now() FOR UPDATE`, [tenant.id, createHash('sha256').update(input.token).digest('hex')]);
    if (!token.rows.length) throw invalid();
    const resetting = token.rows[0].purpose === 'OWNER_RESET' && token.rows[0].target_user_id === current.rows[0].owner_user_id;
    const user = await client.query(`UPDATE "${schema}".users SET "passwordHash"=$1,"sessionVersion"="sessionVersion"+1,"updatedAt"=now()
      WHERE id=$2 AND ("passwordHash" IS NULL OR $3) AND "isActive"=true
      RETURNING id,email,name,picture,role,"isActive","sessionVersion"`, [input.passwordHash, token.rows[0].target_user_id || current.rows[0].owner_user_id,resetting]);
    if (!user.rows.length) throw invalid();
    await client.query('UPDATE ez_control.setup_tokens SET consumed_at=now() WHERE id=$1', [token.rows[0].id]);
    if (token.rows[0].purpose === 'INVITE') {
      await client.query(`UPDATE "${schema}".team_invites SET status='ACCEPTED',"acceptedAt"=now()
        WHERE token=$1 AND status='PENDING'`, [createHash('sha256').update(input.token).digest('hex')]);
    }
    if(resetting)await client.query("DELETE FROM ez_control.tenant_sessions WHERE sess->>'tenantId'=$1 AND sess->'passport'->>'user'=$2",[tenant.id,user.rows[0].id]);
    await audit(client, resetting ? 'tenant.owner_access_reset' : token.rows[0].target_user_id ? 'tenant.member_activated' : 'tenant.owner_activated', tenant.id, undefined, { userId: user.rows[0].id });
    await client.query('COMMIT');
    return { tenant: mapTenant(current.rows[0]), user: user.rows[0] };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function updateTenant(id: string, patch: { name?: string; status?: 'ACTIVE' | 'SUSPENDED'; storageLimitBytes?: number; aiTokenLimit?: number; seatLimit?: number }, operatorId?: string): Promise<Tenant> {
  if (Object.keys(patch).some((key) => !['name', 'status', 'storageLimitBytes', 'aiTokenLimit', 'seatLimit'].includes(key))) throw Object.assign(new Error('Unsupported workspace update'), { status: 400 });
  if (patch.status && !['ACTIVE', 'SUSPENDED'].includes(patch.status)) throw Object.assign(new Error('Invalid status'), { status: 400 });
  await ensureControlSchema();
  const client = await getControlPool().connect();
  try {
    await client.query('BEGIN');
    const rows = await client.query('SELECT * FROM ez_control.tenants WHERE id=$1 FOR UPDATE', [id]);
    if (!rows.rows.length) throw Object.assign(new Error('Workspace not found'), { status: 404 });
    const current = mapTenant(rows.rows[0]);
    if (['PROVISIONING', 'FAILED'].includes(current.status)) throw Object.assign(new Error('Workspace is not provisioned'), { status: 409 });
    const name = patch.name === undefined ? current.name : requiredText(patch.name, 'workspace name');
    const storage = limit(patch.storageLimitBytes, current.storageLimitBytes);
    const ai = limit(patch.aiTokenLimit, current.aiTokenLimit);
    const seats = limit(patch.seatLimit, current.seatLimit);
    if (seats < 1 || seats > 10000) throw Object.assign(new Error('Invalid seat limit'), { status: 400 });
    const status = patch.status || current.status;
    const updated = await client.query(`UPDATE ez_control.tenants SET name=$2,status=$3,storage_limit_bytes=$4,ai_token_limit=$5,seat_limit=$6,updated_at=now()
      WHERE id=$1 RETURNING *`, [id, name, status, storage, ai, seats]);
    if (status === 'SUSPENDED' && current.status !== 'SUSPENDED') {
      const schema = validateSchemaName(current.schemaName);
      await client.query(`UPDATE "${schema}".users SET "sessionVersion"="sessionVersion"+1`);
      const table = await client.query("SELECT to_regclass('ez_control.tenant_sessions') AS present");
      if (table.rows[0].present) await client.query("DELETE FROM ez_control.tenant_sessions WHERE sess->>'tenantId'=$1", [id]);
    }
    await audit(client, 'tenant.updated', id, operatorId, { fields: Object.keys(patch), status });
    await client.query('COMMIT');
    try { tenantLifecycleEvents.emit('changed', { tenantId: id, status }); }
    catch { console.error('Tenant session revocation signal failed'); }
    return mapTenant(updated.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

function mapOperator(row: any): Operator {
  return { id: row.id, email: row.email, name: row.name, sessionVersion: row.session_version };
}

export async function createMemberInvitation(input: { tenantId: string; email: string; name: string; role: 'ADMIN' | 'MEMBER'; actorId: string }) {
  const tenant = await getTenantById(input.tenantId);
  if (!tenant) throw Object.assign(new Error('Workspace not found'), { status: 404 });
  const email = emailOf(input.email), name = requiredText(input.name, 'member name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !['ADMIN','MEMBER'].includes(input.role)) throw Object.assign(new Error('Invalid invitation'), { status: 400 });
  const schema = validateSchemaName(tenant.schemaName), client = await getControlPool().connect();
  try {
    await client.query('BEGIN');
    const catalog = await client.query('SELECT * FROM ez_control.tenants WHERE id=$1 FOR UPDATE', [tenant.id]);
    if (catalog.rows[0]?.status !== 'ACTIVE') throw Object.assign(new Error('Workspace is not active'), { status: 403 });
    const actor = await client.query(`SELECT id FROM "${schema}".users WHERE id=$1 AND role='ADMIN' AND "isActive"=true`, [input.actorId]);
    if (!actor.rows.length) throw Object.assign(new Error('Workspace administrator required'), { status: 403 });
    const existing = await client.query(`SELECT id,"passwordHash","isActive" FROM "${schema}".users WHERE lower(email)=$1 FOR UPDATE`, [email]);
    if(existing.rows[0]?.id===catalog.rows[0].owner_user_id)throw Object.assign(new Error('The workspace owner already has a setup flow'),{status:409});
    if (existing.rows[0]?.passwordHash) throw Object.assign(new Error('A member with that email already exists'), { status: 409 });
    if (existing.rows[0]) {
      const live = await client.query('SELECT id FROM ez_control.setup_tokens WHERE tenant_id=$1 AND target_user_id=$2 AND consumed_at IS NULL AND expires_at>now()', [tenant.id,existing.rows[0].id]);
      if (live.rows.length) throw Object.assign(new Error('An invitation is already pending'), { status: 409 });
    }
    const count = await client.query(`SELECT count(*) AS count FROM "${schema}".users WHERE "isActive"=true AND id<>$1`, [existing.rows[0]?.id || '']);
    if (Number(count.rows[0].count) >= Number(catalog.rows[0].seat_limit)) throw Object.assign(new Error('Workspace member allowance reached'), { status: 409 });
    const userId = existing.rows[0]?.id || randomUUID();
    const user = await client.query(`INSERT INTO "${schema}".users(id,email,name,role,"isActive","updatedAt") VALUES($1,$2,$3,$4,true,now())
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,"isActive"=true,"updatedAt"=now()
      RETURNING id,email,name,picture,role,"isActive","sessionVersion"`, [userId,email,name,input.role]);
    const setupToken = randomBytes(32).toString('hex'), tokenHash = createHash('sha256').update(setupToken).digest('hex');
    await client.query(`INSERT INTO ez_control.setup_tokens(id,tenant_id,target_user_id,token_hash,expires_at,purpose) VALUES($1,$2,$3,$4,now()+interval '24 hours','INVITE')`, [randomUUID(),tenant.id,userId,tokenHash]);
    const invite = await client.query(`INSERT INTO "${schema}".team_invites(id,email,token,role,status,"invitedById","expiresAt","createdAt")
      VALUES($1,$2,$3,$4,'PENDING',$5,now()+interval '24 hours',now()) RETURNING id,email,role,status,"expiresAt","createdAt","acceptedAt","invitedById"`,
      [randomUUID(),email,tokenHash,input.role,input.actorId]);
    await audit(client,'tenant.member_invited',tenant.id,undefined,{actorId:input.actorId,userId,role:input.role});
    await client.query('COMMIT');
    return { tenant:mapTenant(catalog.rows[0]),setupToken,user:user.rows[0],invite:invite.rows[0] };
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function revokeMemberInvitation(input: { tenantId: string; inviteId: string; actorId: string }) {
  const tenant = await getTenantById(input.tenantId);
  if (!tenant) throw Object.assign(new Error('Workspace not found'), { status: 404 });
  const schema = validateSchemaName(tenant.schemaName),client=await getControlPool().connect();
  try {
    await client.query('BEGIN');
    const catalog=await client.query('SELECT status FROM ez_control.tenants WHERE id=$1 FOR UPDATE',[tenant.id]);
    if(catalog.rows[0]?.status!=='ACTIVE')throw Object.assign(new Error('Workspace is not active'),{status:403});
    const actor=await client.query(`SELECT id FROM "${schema}".users WHERE id=$1 AND role='ADMIN' AND "isActive"=true`,[input.actorId]);
    if(!actor.rows.length)throw Object.assign(new Error('Workspace administrator required'),{status:403});
    const invite=await client.query(`SELECT id,token,status FROM "${schema}".team_invites WHERE id=$1 FOR UPDATE`,[input.inviteId]);
    if(!invite.rows.length)throw Object.assign(new Error('Invitation not found'),{status:404});
    if(invite.rows[0].status!=='PENDING')throw Object.assign(new Error('Invitation is no longer pending'),{status:409});
    const target=await client.query(`UPDATE ez_control.setup_tokens SET consumed_at=now() WHERE tenant_id=$1 AND token_hash=$2 AND consumed_at IS NULL RETURNING target_user_id`,[tenant.id,invite.rows[0].token]);
    await client.query(`UPDATE "${schema}".team_invites SET status='REVOKED' WHERE id=$1`,[input.inviteId]);
    if(target.rows[0]?.target_user_id)await client.query(`UPDATE "${schema}".users SET "isActive"=false,"sessionVersion"="sessionVersion"+1
      WHERE id=$1 AND "passwordHash" IS NULL AND NOT EXISTS(SELECT 1 FROM ez_control.setup_tokens
      WHERE tenant_id=$2 AND target_user_id=$1 AND consumed_at IS NULL AND expires_at>now())`,[target.rows[0].target_user_id,tenant.id]);
    await audit(client,'tenant.member_invitation_revoked',tenant.id,undefined,{actorId:input.actorId,inviteId:input.inviteId});
    await client.query('COMMIT');
    return {success:true};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

/** Operator recovery is explicitly issued, audited, expires in one hour and changes no credential until consumed. */
export async function createOwnerSetupLink(tenantId:string,operatorId:string):Promise<{tenant:Tenant;setupToken:string}> {
  const tenant=await getTenantById(tenantId);
  if(!tenant)throw Object.assign(new Error('Workspace not found'),{status:404});
  const client=await getControlPool().connect();
  try{
    await client.query('BEGIN');
    const current=await client.query('SELECT * FROM ez_control.tenants WHERE id=$1 FOR UPDATE',[tenantId]);
    if(current.rows[0]?.status!=='ACTIVE')throw Object.assign(new Error('Workspace is not active'),{status:409});
    const operator=await client.query('SELECT id FROM ez_control.operators WHERE id=$1',[operatorId]);
    if(!operator.rows.length)throw Object.assign(new Error('Operator authorization required'),{status:403});
    const schema=validateSchemaName(current.rows[0].schema_name),ownerId=current.rows[0].owner_user_id;
    const owner=await client.query(`SELECT id FROM "${schema}".users WHERE id=$1 AND "isActive"=true FOR UPDATE`,[ownerId]);
    if(!owner.rows.length)throw Object.assign(new Error('Workspace owner is unavailable'),{status:409});
    await client.query(`UPDATE ez_control.setup_tokens SET consumed_at=now() WHERE tenant_id=$1
      AND (target_user_id IS NULL OR target_user_id=$2) AND consumed_at IS NULL`,[tenantId,ownerId]);
    const setupToken=randomBytes(32).toString('hex');
    await client.query(`INSERT INTO ez_control.setup_tokens(id,tenant_id,target_user_id,token_hash,purpose,expires_at)
      VALUES($1,$2,$3,$4,'OWNER_RESET',now()+interval '1 hour')`,[randomUUID(),tenantId,ownerId,createHash('sha256').update(setupToken).digest('hex')]);
    await audit(client,'tenant.owner_setup_issued',tenantId,operatorId,{userId:ownerId,expiresInSeconds:3600});
    await client.query('COMMIT');
    return {tenant:mapTenant(current.rows[0]),setupToken};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function bootstrapOperator(input: { email: string; name: string; passwordHash: string }): Promise<Operator> {
  assertHash(input.passwordHash);
  const email = emailOf(input.email), name = requiredText(input.name, 'operator name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Invalid operator email');
  await ensureControlSchema();
  const client = await getControlPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('ez_control.bootstrap_operator'))");
    const count = await client.query('SELECT count(*) AS count FROM ez_control.operators');
    if (Number(count.rows[0].count)) throw Object.assign(new Error('An operator already exists; bootstrap is disabled'), { status: 409 });
    const result = await client.query('INSERT INTO ez_control.operators(id,email,name,password_hash) VALUES($1,$2,$3,$4) RETURNING *', [randomUUID(), email, name, input.passwordHash]);
    await audit(client, 'operator.bootstrapped', undefined, result.rows[0].id);
    await client.query('COMMIT');
    return mapOperator(result.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function findOperatorByEmail(email: string): Promise<(Operator & { passwordHash: string }) | null> {
  await ensureControlSchema();
  const result = await getControlPool().query('SELECT * FROM ez_control.operators WHERE email=$1', [emailOf(email)]);
  return result.rows[0] ? { ...mapOperator(result.rows[0]), passwordHash: result.rows[0].password_hash } : null;
}
export async function findOperatorById(id: string): Promise<Operator | null> {
  if (!/^[a-f0-9-]{36}$/i.test(id || '')) return null;
  await ensureControlSchema();
  const result = await getControlPool().query('SELECT id,email,name,session_version FROM ez_control.operators WHERE id=$1', [id]);
  return result.rows[0] ? mapOperator(result.rows[0]) : null;
}
/** Compare-and-swap prevents two verified requests from overwriting each other. */
export async function changeOperatorPassword(input: {
  id: string; expectedVersion: number; expectedHash: string; passwordHash: string;
}): Promise<Operator> {
  assertHash(input.passwordHash);
  const client = await getControlPool().connect();
  try {
    await client.query('BEGIN');
    const changed = await client.query(`UPDATE ez_control.operators
      SET password_hash=$1,session_version=session_version+1
      WHERE id=$2 AND session_version=$3 AND password_hash=$4
      RETURNING id,email,name,session_version`,
    [input.passwordHash, input.id, input.expectedVersion, input.expectedHash]);
    if (!changed.rows.length) throw Object.assign(new Error('Operator credentials changed; sign in again'), { status: 409 });
    await audit(client, 'operator.password_changed', undefined, input.id);
    await client.query('COMMIT');
    return mapOperator(changed.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function listAudit(count = 100) {
  await ensureControlSchema();
  const result = await getControlPool().query('SELECT id,tenant_id,operator_id,action,detail,created_at FROM ez_control.audit ORDER BY created_at DESC LIMIT $1', [Math.max(1, Math.min(500, count))]);
  return result.rows.map((row) => ({ id: row.id, tenantId: row.tenant_id, operatorId: row.operator_id, action: row.action, detail: row.detail, createdAt: iso(row.created_at) }));
}
