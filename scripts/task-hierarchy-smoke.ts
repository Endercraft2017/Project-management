/** Real PostgreSQL topology and nested-read authorization checks, with owned fixtures only. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
const supplied = process.env.TEST_DATABASE_URL;
assert(supplied, 'TEST_DATABASE_URL is required');
const url = new URL(supplied);
assert(['postgres:', 'postgresql:'].includes(url.protocol));
assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
assert(/^[a-z0-9_]+_test$/i.test(url.pathname.slice(1)) && !url.searchParams.has('schema'));
process.env.DATABASE_URL = supplied;
const root = resolve(__dirname, '../server/dist');
const store = require(resolve(root, 'platform/store.js'));
const { createTenantClient, disconnectPrisma } = require(resolve(root, 'database/client.js'));
const { runWithTenant } = require(resolve(root, 'tenancy/context.js'));
const { taskService: tasks } = require(resolve(root, 'tasks/service.js'));
const { sprintService: sprints } = require(resolve(root, 'sprints/service.js'));
const { listTasksQuerySchema } = require(resolve(root, 'tasks/validators.js'));
let tenant: any, db: any, passed = 0;
async function check(name: string, action: () => Promise<void>) { await action(); passed++; console.log(`PASS ${name}`); }
async function main() {
  ({ tenant } = await store.createTenant({ name: `Hierarchy ${randomUUID()}`, ownerName: 'Synthetic owner', ownerEmail: 'hierarchy@example.invalid' }));
  db = createTenantClient(tenant);
  await runWithTenant(tenant, async () => {
    const owner = await db.user.findUnique({ where: { email: 'hierarchy@example.invalid' } });
    const member = await db.user.create({ data: { name: 'Synthetic member', email: 'member@example.invalid' } });
    const make = (name: string, data = {}) => tasks.createTask({ taskName: name, ...data }, owner.id, true);
    const sprint = () => db.sprint.create({ data: { name: randomUUID(), createdById: owner.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) } });
    await check('backlog children inherit links and actual depth', async () => {
      const parent = await make('Backlog parent'); const child = await make('Backlog child', { parentTaskId: parent.id });
      assert.equal(child.sprintId, null); assert.equal(child.nestingLevel, 1);
    });
    await check('concurrent opposite reparenting cannot create a cycle', async () => {
      const a = await make('Cycle A'), b = await make('Cycle B');
      const results = await Promise.allSettled([tasks.updateTask(a.id, { parentTaskId: b.id }, owner.id, true), tasks.updateTask(b.id, { parentTaskId: a.id }, owner.id, true)]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      const aa = await db.task.findUnique({ where: { id: a.id } }), bb = await db.task.findUnique({ where: { id: b.id } });
      assert(!(aa.parentTaskId === b.id && bb.parentTaskId === a.id));
    });
    await check('ancestor cycles and depth overflow reject without partial writes', async () => {
      const a = await make('Depth A'), b = await make('Depth B', { parentTaskId: a.id }), c = await make('Depth C', { parentTaskId: b.id }), d = await make('Depth D', { parentTaskId: c.id });
      await assert.rejects(make('Too deep', { parentTaskId: d.id }), /depth/i);
      await assert.rejects(tasks.updateTask(a.id, { parentTaskId: c.id }, owner.id, true), /descendants/i);
      assert.equal((await db.task.findUnique({ where: { id: a.id } })).parentTaskId, null);
      const x = await make('Subtree X'), y = await make('Subtree Y', { parentTaskId: x.id });
      await assert.rejects(tasks.updateTask(x.id, { parentTaskId: c.id }, owner.id, true), /depth/i);
      assert.equal((await db.task.findUnique({ where: { id: y.id } })).nestingLevel, 1);
    });
    await check('reparenting updates every descendant level and both parent rollups', async () => {
      const a = await make('Old parent'), b = await make('New parent'), child = await make('Completed child', { parentTaskId: a.id });
      await tasks.updateTask(child.id, { progress: 100 }, owner.id, true);
      await make('Other child', { parentTaskId: b.id });
      await tasks.updateTask(child.id, { parentTaskId: b.id }, owner.id, true);
      assert.equal((await db.task.findUnique({ where: { id: a.id } })).progress, 0);
      assert.equal((await db.task.findUnique({ where: { id: b.id } })).progress, 50);
      const rootTask = await make('Detach root'), nested = await make('Nested', { parentTaskId: rootTask.id }), leaf = await make('Leaf', { parentTaskId: nested.id });
      await tasks.updateTask(nested.id, { parentTaskId: null }, owner.id, true);
      assert.equal((await db.task.findUnique({ where: { id: nested.id } })).nestingLevel, 0);
      assert.equal((await db.task.findUnique({ where: { id: leaf.id } })).nestingLevel, 1);
    });
    await check('cross-sprint and cross-project parents reject', async () => {
      const first = await sprint(), second = await sprint();
      const a = await make('Sprint A', { sprintId: first.id }), b = await make('Sprint B', { sprintId: second.id });
      await assert.rejects(tasks.updateTask(a.id, { parentTaskId: b.id }, owner.id, true), /same project and sprint/i);
      const project = await db.project.create({ data: { name: 'Other project', createdById: owner.id } });
      const other = await db.task.create({ data: { taskName: 'Project parent', projectId: project.id, createdById: owner.id } });
      const backlog = await make('No project');
      await assert.rejects(tasks.updateTask(backlog.id, { parentTaskId: other.id }, owner.id, true), /same project and sprint/i);
    });
    await check('moving a nested subtree detaches it and preserves descendant coherence', async () => {
      const first = await sprint(), second = await sprint();
      const a = await make('Move root', { sprintId: first.id }), b = await make('Move child', { parentTaskId: a.id }), c = await make('Move grandchild', { parentTaskId: b.id });
      await tasks.moveToSprint(b.id, second.id, owner.id, true);
      const bb = await db.task.findUnique({ where: { id: b.id } }), cc = await db.task.findUnique({ where: { id: c.id } });
      assert.equal(bb.parentTaskId, null); assert.equal(bb.nestingLevel, 0); assert.equal(cc.nestingLevel, 1); assert.equal(cc.sprintId, second.id);
      assert.equal((await db.task.findUnique({ where: { id: a.id } })).sprintId, first.id);
      await sprints.deleteSprint(second.id, true, false);
      assert.equal((await db.task.findUnique({ where: { id: c.id } })).sprintId, null);
      assert.equal((await db.task.findUnique({ where: { id: c.id } })).parentTaskId, b.id);
    });
    await check('occupied sprint deletion requires explicit task disposition', async () => {
      const s = await sprint(); const task = await make('Keep me', { sprintId: s.id });
      await assert.rejects(sprints.deleteSprint(s.id, false, false), /Sprint has/);
      assert(await db.task.findUnique({ where: { id: task.id } }));
    });
    await check('concurrent empty-sprint deletion never silently cascade-deletes a new task', async () => {
      const s = await sprint();
      const [creation, deletion] = await Promise.allSettled([make('Race fixture', { sprintId: s.id }), sprints.deleteSprint(s.id, false, false)]);
      assert.equal([creation, deletion].filter((r) => r.status === 'fulfilled').length, 1);
      if (creation.status === 'fulfilled') assert(await db.task.findUnique({ where: { id: creation.value.id } }));
    });
    await check('task list/detail/hierarchy and sprint reads exclude private nested tasks', async () => {
      const s = await sprint();
      const parent = await make('Visible parent', { sprintId: s.id, assignedToId: member.id });
      const child = await make('Hidden child', { parentTaskId: parent.id, assignedToId: owner.id });
      const list = await tasks.listTasks(listTasksQuerySchema.parse({ includeSubtasks: true }), member.id, false);
      assert(!JSON.stringify(list).includes('Hidden child'));
      const detail = await tasks.getTaskById(parent.id, true, true, member.id, false);
      assert.equal(detail.subtasks.length, 0); assert.equal(detail._count.subtasks, 0);
      await assert.rejects(tasks.getTaskById(child.id, true, true, member.id, false), /No permission/);
      assert(!JSON.stringify(await tasks.getTaskHierarchy(parent.id, member.id, false)).includes('Hidden child'));
      const bySprint = await sprints.getSprintById(s.id, true, member.id, false);
      assert.equal(bySprint.tasks.length, 1); assert.equal(bySprint._count.tasks, 1);
      const rows = await sprints.getSprintTasks(s.id, { page: 1, limit: 20 }, member.id, false);
      assert.equal(rows.tasks.length, 1); assert.equal(rows.pagination.total, 1);
    });
  });
  console.log(`Task hierarchy: ${passed} real PostgreSQL checks passed`);
}
main().catch((error) => { console.error(`Task hierarchy failed: ${error.message}`); process.exitCode = 1; }).finally(async () => {
  await disconnectPrisma();
  try {
    if (tenant) {
      assert(/^ez_t_[a-f0-9]{32}$/.test(tenant.schemaName));
      const c = await store.getControlPool().connect();
      try {
        await c.query('BEGIN'); await c.query(`DROP SCHEMA "${tenant.schemaName}" CASCADE`);
        await c.query('DELETE FROM ez_control.audit WHERE tenant_id=$1', [tenant.id]);
        await c.query('DELETE FROM ez_control.setup_tokens WHERE tenant_id=$1', [tenant.id]);
        await c.query('DELETE FROM ez_control.tenants WHERE id=$1', [tenant.id]); await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    }
  } catch { console.error('Owned task fixture cleanup failed'); process.exitCode = 1; }
  await store.closeControlPool();
});
