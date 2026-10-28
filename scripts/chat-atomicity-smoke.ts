/** Real PostgreSQL concurrency regression; uses only owned fixtures in a local *_test DB. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const supplied = process.env.TEST_DATABASE_URL;
assert(supplied, 'TEST_DATABASE_URL is required');
const url = new URL(supplied);
assert(['postgres:', 'postgresql:'].includes(url.protocol));
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Only local disposable PostgreSQL is permitted');
assert(/^[a-z0-9_]+_test$/i.test(url.pathname.slice(1)), 'Dedicated database name must end _test');
assert(!url.searchParams.has('schema'), 'Test URL must not select a tenant schema');
process.env.DATABASE_URL = supplied;
const root = resolve(__dirname, '../server/dist');
const store = require(resolve(root, 'platform/store.js'));
const { createTenantClient, disconnectPrisma } = require(resolve(root, 'database/client.js'));
const { runWithTenant } = require(resolve(root, 'tenancy/context.js'));
const { addReaction, removeReaction, deleteMessage, editMessage, sendMessage } = require(resolve(root, 'chat/message-service.js'));
const { sendThreadReply, deleteThreadReply } = require(resolve(root, 'chat/thread-service.js'));
let tenant: any, db: any, passed = 0;
async function check(name: string, fn: () => Promise<void>) { await fn(); console.log(`PASS ${name}`); passed++; }
async function waitForLock(fragment: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await store.getControlPool().query(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
      WHERE datname=current_database() AND wait_event_type='Lock' AND position($1 in query)>0) AS waiting`, [fragment]);
    if (result.rows[0].waiting) return;
    await new Promise((done) => setTimeout(done, 10));
  }
  throw new Error('Expected transaction lock wait was not observed');
}

async function main() {
  await store.ensureControlSchema();
  ({ tenant } = await store.createTenant({ name: `Chat Regression ${randomUUID()}`, ownerEmail: 'chat-owner@example.invalid', ownerName: 'Synthetic Owner' }));
  db = createTenantClient(tenant);
  await runWithTenant(tenant, async () => {
    const owner = await db.user.findUnique({ where: { email: 'chat-owner@example.invalid' } });
    const first = await db.user.create({ data: { email: 'first@example.invalid', name: 'First' } });
    const second = await db.user.create({ data: { email: 'second@example.invalid', name: 'Second' } });
    const outsider = await db.user.create({ data: { email: 'outsider@example.invalid', name: 'Outsider' } });
    const conversation = await db.conversation.create({ data: { type: 'GROUP', name: 'Synthetic chat', createdById: owner.id,
      members: { create: [{ userId: owner.id, isAdmin: true }, { userId: first.id }, { userId: second.id }] } } });
    const message = await db.message.create({ data: { conversationId: conversation.id, senderId: owner.id, content: 'Synthetic root' } });
    await check('concurrent reaction adds preserve users and deduplicate repeats', async () => {
      await Promise.all([owner, first, second, owner, first, second].map((user) => addReaction(message.id, user.id, '👍')));
      const current = await db.message.findUnique({ where: { id: message.id } });
      assert.deepEqual(new Set(current.reactions['👍']), new Set([owner.id, first.id, second.id]));
      assert.equal(current.reactions['👍'].length, 3);
    });
    await check('simultaneous remove/add preserve unrelated users and emoji keys', async () => {
      await Promise.all([removeReaction(message.id, owner.id, '👍'), addReaction(message.id, first.id, '🎉'), addReaction(message.id, second.id, '🎉')]);
      const current = await db.message.findUnique({ where: { id: message.id } });
      assert.deepEqual(new Set(current.reactions['👍']), new Set([first.id, second.id]));
      assert.deepEqual(new Set(current.reactions['🎉']), new Set([first.id, second.id]));
    });
    await check('concurrent removals remove empty emoji without losing another key', async () => {
      await Promise.all([first, second, first].map((user) => removeReaction(message.id, user.id, '👍')));
      const current = await db.message.findUnique({ where: { id: message.id } });
      assert.equal(current.reactions['👍'], undefined);
      assert.equal(current.reactions['🎉'].length, 2);
    });
    await check('prototype-like reaction keys cannot corrupt the JSON map', async () => {
      const before = (await db.message.findUnique({ where: { id: message.id } })).reactions;
      await assert.rejects(addReaction(message.id, first.id, '__proto__'), (error: any) => error.status === 400);
      assert.deepEqual((await db.message.findUnique({ where: { id: message.id } })).reactions, before);
    });
    await check('outsider and inactive-member authorization happens inside mutation transaction', async () => {
      const before = await db.message.findUnique({ where: { id: message.id } });
      await assert.rejects(addReaction(message.id, outsider.id, '❌'), /Not a member/);
      await db.user.update({ where: { id: second.id }, data: { isActive: false } });
      await assert.rejects(removeReaction(message.id, second.id, '🎉'), /Not a member/);
      assert.deepEqual((await db.message.findUnique({ where: { id: message.id } })).reactions, before.reactions);
      await db.user.update({ where: { id: second.id }, data: { isActive: true } });
    });
    await check('membership removal committed during mutation blocks the write', async () => {
      const blocker = await store.getControlPool().connect();
      try {
        await blocker.query('BEGIN');
        await blocker.query(`DELETE FROM "${tenant.schemaName}".conversation_members WHERE "conversationId"=$1 AND "userId"=$2`, [conversation.id, first.id]);
        const pending = addReaction(message.id, first.id, '❌').then(() => null, (error: Error) => error);
        await waitForLock('conversation_members');
        await blocker.query('COMMIT');
        assert.match((await pending)?.message || '', /Not a member/);
        assert.equal((await db.message.findUnique({ where: { id: message.id } })).reactions['❌'], undefined);
      } finally { await blocker.query('ROLLBACK'); blocker.release(); }
      await db.conversationMember.create({ data: { conversationId: conversation.id, userId: first.id } });
    });
    await check('former members cannot edit or delete their own old root messages', async () => {
      const own = await db.message.create({ data: { conversationId: conversation.id, senderId: first.id, content: 'Unchanged private root' } });
      await db.conversationMember.delete({ where: { conversationId_userId: { conversationId: conversation.id, userId: first.id } } });
      await assert.rejects(editMessage(own.id, first.id, 'Unauthorized change'), /Not a member/);
      await assert.rejects(deleteMessage(own.id, first.id), /Not a member/);
      const current = await db.message.findUnique({ where: { id: own.id } });
      assert.equal(current.content, 'Unchanged private root'); assert.equal(current.isDeleted, false);
      await db.conversationMember.create({ data: { conversationId: conversation.id, userId: first.id } });
    });
    await check('membership removal committed while editing blocks the message update', async () => {
      const own = await db.message.create({ data: { conversationId: conversation.id, senderId: first.id, content: 'Before revocation' } });
      const blocker = await store.getControlPool().connect();
      try {
        await blocker.query('BEGIN');
        await blocker.query(`DELETE FROM "${tenant.schemaName}".conversation_members WHERE "conversationId"=$1 AND "userId"=$2`, [conversation.id, first.id]);
        const pending = editMessage(own.id, first.id, 'Must not commit').then(() => null, (error: Error) => error);
        await waitForLock('conversation_members'); await blocker.query('COMMIT');
        assert.match((await pending)?.message || '', /Not a member/);
        assert.equal((await db.message.findUnique({ where: { id: own.id } })).content, 'Before revocation');
      } finally { await blocker.query('ROLLBACK'); blocker.release(); }
      await db.conversationMember.create({ data: { conversationId: conversation.id, userId: first.id } });
    });
    await check('membership removal committed while sending blocks message creation', async () => {
      const before = await db.message.count({ where: { conversationId: conversation.id } });
      const blocker = await store.getControlPool().connect();
      try {
        await blocker.query('BEGIN');
        await blocker.query(`DELETE FROM "${tenant.schemaName}".conversation_members WHERE "conversationId"=$1 AND "userId"=$2`, [conversation.id, first.id]);
        const pending = sendMessage(conversation.id, first.id, 'Must not appear').then(() => null, (error: Error) => error);
        await waitForLock('conversation_members'); await blocker.query('COMMIT');
        assert.match((await pending)?.message || '', /Not a member/);
        assert.equal(await db.message.count({ where: { conversationId: conversation.id } }), before);
      } finally { await blocker.query('ROLLBACK'); blocker.release(); }
      await db.conversationMember.create({ data: { conversationId: conversation.id, userId: first.id } });
    });
    await check('reply creation serializes parent count with concurrent creates', async () => {
      await Promise.all([first, second].map((user) => sendThreadReply(message.id, user.id, 'Concurrent reply')));
      assert.equal((await db.message.findUnique({ where: { id: message.id } })).threadRepliesCount, 2);
    });
    const replies = await db.message.findMany({ where: { parentMessageId: message.id }, orderBy: { id: 'asc' } });
    await check('duplicate simultaneous reply deletion decrements exactly once', async () => {
      const results = await Promise.allSettled([deleteThreadReply(replies[0].id, owner.id), deleteThreadReply(replies[0].id, owner.id)]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal((await db.message.findUnique({ where: { id: message.id } })).threadRepliesCount, 1);
    });
    await check('generic message deletion uses the same reply counter transaction', async () => {
      await deleteMessage(replies[1].id, owner.id);
      assert.equal((await db.message.findUnique({ where: { id: message.id } })).threadRepliesCount, 0);
    });
    await check('reply authorization rejects removed sender even for their own reply', async () => {
      const reply = await sendThreadReply(message.id, first.id, 'Private reply');
      await db.conversationMember.delete({ where: { conversationId_userId: { conversationId: conversation.id, userId: first.id } } });
      await assert.rejects(deleteThreadReply(reply.id, first.id), /Not a member/);
      assert.equal((await db.message.findUnique({ where: { id: reply.id } })).isDeleted, false);
      await db.conversationMember.create({ data: { conversationId: conversation.id, userId: first.id } });
    });
    await check('parent deletion after preflight rejects reply inside write transaction', async () => {
      const parent = await db.message.create({ data: { conversationId: conversation.id, senderId: owner.id, content: 'Parent race' } });
      const blocker = await store.getControlPool().connect();
      try {
        await blocker.query('BEGIN');
        await blocker.query(`SELECT id FROM "${tenant.schemaName}".messages WHERE id=$1 FOR UPDATE`, [parent.id]);
        const pending = sendThreadReply(parent.id, first.id, 'Must not appear').then(() => null, (error: Error) => error);
        await waitForLock('FROM messages');
        await blocker.query(`UPDATE "${tenant.schemaName}".messages SET "isDeleted"=true WHERE id=$1`, [parent.id]);
        await blocker.query('COMMIT');
        assert.match((await pending)?.message || '', /deleted/);
        assert.equal(await db.message.count({ where: { parentMessageId: parent.id } }), 0);
      } finally { await blocker.query('ROLLBACK'); blocker.release(); }
    });
    await check('disabled Drive write inputs never reach provider code', async () => {
      await assert.rejects(sendMessage(conversation.id, owner.id, 'Text', ['not-a-provider-file']), (error: any) => error.status === 503);
      await assert.rejects(sendThreadReply(message.id, owner.id, 'Text', ['not-a-provider-file']), (error: any) => error.status === 503);
    });
  });
  console.log(`Chat atomicity: ${passed} real PostgreSQL checks passed`);
}

main().catch((error) => { console.error(`Chat atomicity failed: ${error.message}`); process.exitCode = 1; }).finally(async () => {
  try {
    await disconnectPrisma();
    if (tenant) {
      // Drop only the server-generated schema and control records owned by this run.
      assert(/^ez_t_[a-f0-9]{32}$/.test(tenant.schemaName));
      const client = await store.getControlPool().connect();
      try {
        await client.query('BEGIN');
        await client.query(`DROP SCHEMA "${tenant.schemaName}" CASCADE`);
        await client.query('DELETE FROM ez_control.audit WHERE tenant_id=$1', [tenant.id]);
        await client.query('DELETE FROM ez_control.setup_tokens WHERE tenant_id=$1', [tenant.id]);
        await client.query('DELETE FROM ez_control.tenants WHERE id=$1', [tenant.id]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
  } catch { console.error('Owned chat fixture cleanup failed'); process.exitCode = 1; }
  finally { await store.closeControlPool(); }
});
