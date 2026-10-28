/** Every business operation resolves a validated tenant schema. No public fallback. */
import { PrismaClient } from '@prisma/client';
import { getTenantContext, TenantContext, validateSchemaName } from '../tenancy/context';
import { getControlPool } from '../platform/pool';

const clients = new Map<string, PrismaClient>();
export function createTenantClient(tenant: Pick<TenantContext, 'id' | 'schemaName'>): PrismaClient {
  const schema = validateSchemaName(tenant.schemaName);
  if (!tenant.id) throw new Error('Tenant identity is required');
  const key = `${tenant.id}:${schema}`;
  let client = clients.get(key);
  if (!client) {
    const cap = Number(process.env.TENANT_DB_MAX_CLIENTS ?? 32);
    if (!Number.isInteger(cap) || cap < 1 || cap > 128) throw new Error('Invalid tenant client capacity');
    if (clients.size >= cap) throw Object.assign(new Error('Tenant database capacity reached; retry later'), { status: 503 });
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('schema', schema);
    const poolSize = Number(process.env.TENANT_DB_POOL_SIZE ?? 2);
    if (!Number.isInteger(poolSize) || poolSize < 1 || poolSize > 10) throw new Error('Invalid tenant pool size');
    url.searchParams.set('connection_limit', String(poolSize));
    // ORM errors can include failed-row values; transport/job boundaries report safe errors.
    client = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
    clients.set(key, client);
  }
  return client;
}
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = createTenantClient(getTenantContext());
    const member = Reflect.get(client, property, client);
    return typeof member === 'function' ? member.bind(client) : member;
  },
});
export async function disconnectPrisma(): Promise<void> {
  const current = [...clients.values()]; clients.clear();
  await Promise.all(current.map((client) => client.$disconnect()));
}
export async function checkDatabaseConnection(): Promise<boolean> {
  try { await getControlPool().query('SELECT 1'); return true; } catch { return false; }
}
export default prisma;
