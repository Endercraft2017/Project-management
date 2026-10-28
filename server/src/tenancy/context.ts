import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantStatus = 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'FAILED';
export interface TenantContext {
  id: string;
  code: string;
  name: string;
  schemaName: string;
  status: TenantStatus;
}
const tenants = new AsyncLocalStorage<Readonly<TenantContext>>();

export function validateSchemaName(schemaName: string): string {
  if (!/^ez_t_[a-f0-9]{16,64}$/.test(schemaName)) throw new Error('Invalid server-generated tenant schema');
  return schemaName;
}

export function getTenantContext(): Readonly<TenantContext> {
  const tenant = tenants.getStore();
  if (!tenant) throw new Error('Tenant context is required');
  validateSchemaName(tenant.schemaName);
  return tenant;
}

export function runWithTenant<T>(tenant: TenantContext, fn: () => T): T {
  validateSchemaName(tenant.schemaName);
  if (!tenant.id || !/^[A-Z][0-9]{4}[A-Z]$/.test(tenant.code)) throw new Error('Invalid tenant context');
  if (tenant.status !== 'ACTIVE') throw Object.assign(new Error('Workspace is not active'), { status: 403 });
  return tenants.run(Object.freeze({ ...tenant }), fn);
}
