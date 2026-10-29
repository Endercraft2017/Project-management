/** Guarded real PostgreSQL/HTTP MFA checks. Creates and removes only its random sibling test DB. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const supplied = process.env.TEST_DATABASE_URL;
assert(supplied, 'TEST_DATABASE_URL is required');
const source = new URL(supplied);
assert(['postgres:', 'postgresql:'].includes(source.protocol));
assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname));
assert(/^[a-z0-9_]+_test$/i.test(source.pathname.slice(1)) && !source.searchParams.has('schema'));
const database = `ez_mfa_${randomBytes(8).toString('hex')}_test`, target = new URL(source);
target.pathname = '/'+database;
const admin = new Pool({ connectionString: source.toString(), max: 1 });
let created = false, server: Server | undefined, store: any, db: any, base = '', count = 0;
process.env.DATABASE_URL = target.toString(); process.env.NODE_ENV = 'production';
process.env.SESSION_SECRET = randomBytes(48).toString('hex'); process.env.CONSOLE_SESSION_SECRET = randomBytes(48).toString('hex');
process.env.CONSOLE_MFA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
process.env.CLIENT_URL = 'https://example.test'; process.env.CORS_ORIGIN = process.env.CLIENT_URL;
process.env.AI_ENABLED = 'false'; process.env.MAIL_ENABLED = 'false';
const root = resolve(__dirname, '..');
type Reply = { status: number; data: any; cookie: string };
async function request(path: string, cookie = '', body?: unknown, forwardedIp?: string): Promise<Reply> {
  const response = await fetch(base+'/api/console'+path, { method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: process.env.CLIENT_URL!, Cookie: cookie, 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https', ...(forwardedIp ? {'X-Forwarded-For':forwardedIp} : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  return { status: response.status, data: await response.json(), cookie: response.headers.getSetCookie().find((value) => value.startsWith('ez.operator.sid='))?.split(';')[0] || '' };
}
async function check(label: string, fn: () => Promise<void>) { await fn(); count++; console.log('PASS '+label); }
async function main() {
  await admin.query(`CREATE DATABASE "${database}"`); created = true;
  store = require(resolve(root,'server/dist/platform/store.js')); db = require(resolve(root,'server/dist/database/client.js'));
  const mfa = require(resolve(root,'server/dist/platform/operator-mfa.js'));
  const { hashPassword } = require(resolve(root,'server/dist/auth/password.js'));
  const password = 'Local-'+randomBytes(20).toString('hex'), email = 'mfa-test@example.invalid';
  const operator = await store.bootstrapOperator({ email, name: 'MFA fixture', passwordHash: await hashPassword(password) });
  server = createServer(require(resolve(root,'server/dist/app.js')).default);
  await new Promise<void>((done, reject) => { server!.once('error', reject); server!.listen(0, '127.0.0.1', done); });
  base = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
  let signed = await request('/login','',{email,password}); assert.equal(signed.status,200);
  let session = signed.cookie, oldSession = session, secret = '', enrolledToken = '', codes: string[] = [];
  await check('enrollment requires the current password and stores only authenticated ciphertext', async () => {
    assert.equal((await request('/mfa/enrollment',session,{password:'wrong'})).status,403);
    const pending = await request('/mfa/enrollment',session,{password}); assert.equal(pending.status,200); secret=pending.data.secret;
    const row=(await store.getControlPool().query('SELECT * FROM ez_control.operator_mfa WHERE operator_id=$1',[operator.id])).rows[0];
    assert(row.pending_cipher && !row.pending_cipher.includes(secret)); assert.equal(row.enabled,false);
    assert.equal((await request('/me',session)).status,200);
  });
  await check('confirmation verifies a real TOTP and revokes old operator sessions', async () => {
    let wrong='000000'; while(mfa.acceptedCounter(secret,wrong,-1)!==null) wrong=String(Number(wrong)+1).padStart(6,'0');
    assert.equal((await request('/mfa/enable',session,{token:wrong})).status,400);
    enrolledToken=mfa.makeTotp(secret).generate();
    const confirmed=await request('/mfa/enable',session,{token:enrolledToken}); assert.equal(confirmed.status,200);
    assert.equal(confirmed.data.recoveryCodes.length,10); codes=confirmed.data.recoveryCodes;session=confirmed.cookie;
    assert.equal((await request('/me',oldSession)).status,401); assert.equal((await request('/me',session)).status,200);
    const row=(await store.getControlPool().query('SELECT * FROM ez_control.operator_mfa WHERE operator_id=$1',[operator.id])).rows[0];
    assert(!JSON.stringify(row).includes(secret)); assert(codes.every((code)=>!JSON.stringify(row).includes(code)));assert.equal(row.pending_cipher,null);
  });
  await check('password verification grants only a five-minute pending challenge with no operator authority', async () => {
    signed=await request('/login','',{email,password});assert.equal(signed.status,200);assert.equal(signed.data.mfaRequired,true);assert.equal(signed.data.user,undefined);
    assert.equal((await request('/me',signed.cookie)).status,401);assert.equal((await request('/tenants',signed.cookie)).status,401);
    assert.equal((await request('/mfa/verify',signed.cookie,{token:enrolledToken})).status,401);
  });
  await check('a recovery code completes password-bound sign-in and cannot be replayed', async () => {
    const verified=await request('/mfa/verify',signed.cookie,{token:codes[0]}); assert.equal(verified.status,200);assert(verified.cookie!==signed.cookie);
    assert.equal((await request('/me',verified.cookie)).status,200);
    signed=await request('/login','',{email,password});assert.equal((await request('/mfa/verify',signed.cookie,{token:codes[0]})).status,401);
    const second=await request('/mfa/verify',signed.cookie,{token:mfa.makeTotp(secret).generate({timestamp:Date.now()+30000})});assert.equal(second.status,200);session=second.cookie;
  });
  await check('concurrent recovery redemption has exactly one winner and a stale version cannot authenticate', async () => {
    const current=await store.findOperatorById(operator.id);
    const results=await Promise.allSettled([0,1].map(()=>mfa.verifyOperatorMfa(operator.id,current.sessionVersion,codes[2])));
    assert.equal(results.filter((result)=>result.status==='fulfilled').length,1);
    await assert.rejects(mfa.verifyOperatorMfa(operator.id,current.sessionVersion-1,codes[3]));
  });
  await check('missing or replaced encryption keys never bypass MFA, including recovery-code attempts', async () => {
    const current=await store.findOperatorById(operator.id), key=process.env.CONSOLE_MFA_ENCRYPTION_KEY!;
    delete process.env.CONSOLE_MFA_ENCRYPTION_KEY;
    await assert.rejects(mfa.verifyOperatorMfa(operator.id,current.sessionVersion,codes[3]),(error:any)=>error.status===503);
    assert.equal((await request('/login','',{email,password})).status,503);
    process.env.CONSOLE_MFA_ENCRYPTION_KEY=randomBytes(32).toString('hex');
    await assert.rejects(mfa.verifyOperatorMfa(operator.id,current.sessionVersion,mfa.makeTotp(secret).generate()),(error:any)=>error.status===503);
    await assert.rejects(mfa.verifyOperatorMfa(operator.id,current.sessionVersion,codes[3]),(error:any)=>error.status===503);
    process.env.CONSOLE_MFA_ENCRYPTION_KEY=key;
  });
  await check('MFA disable requires password and a single-use factor, revokes sessions and audits no secrets', async () => {
    assert.equal((await request('/mfa/disable',session,{password:'wrong',token:codes[3]})).status,403);
    const disabled=await request('/mfa/disable',session,{password,token:codes[3]});assert.equal(disabled.status,200);assert.equal(disabled.data.enabled,false);
    assert.equal((await request('/me',session)).status,401);
    signed=await request('/login','',{email,password});assert.equal(signed.data.mfaRequired,undefined);
    const audit=(await store.getControlPool().query('SELECT action,detail FROM ez_control.audit WHERE operator_id=$1',[operator.id])).rows;
    assert(audit.some((row:any)=>row.action==='operator.mfa_enabled'));assert(audit.some((row:any)=>row.action==='operator.mfa_disabled'));
    assert(audit.every((row:any)=>JSON.stringify(row.detail)==='{}'));
  });
  await check('account-scoped throttling also limits attempts from a different IP address', async () => {
    assert.equal((await request('/mfa/verify',signed.cookie,{token:'123456'},'198.51.100.7')).status,429);
  });
  console.log(`Completed ${count} real PostgreSQL/HTTP MFA checks; no live account or provider calls.`);
}
main().catch((error)=>{console.error('MFA smoke failed:',error instanceof Error?error.message:'Unknown failure');process.exitCode=1;}).finally(async()=>{
  if(server?.listening)await new Promise<void>((done)=>server!.close(()=>done()));
  try{await require(resolve(root,'server/dist/platform/routes.js')).closeConsoleSessions();}catch{}
  try{await require(resolve(root,'server/dist/middlewares/session.js')).closeSessionStore();}catch{}
  if(db)await db.disconnectPrisma();if(store)await store.closeControlPool();
  if(created)await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);await admin.end();
});
