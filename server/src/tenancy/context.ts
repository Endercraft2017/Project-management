/**
 * Tenant Context
 * Which organization the current request belongs to.
 *
 * The id is held in AsyncLocalStorage, so it follows the request through every
 * await without being passed around. The Prisma extension in ./prisma-scope.ts
 * reads it to filter and stamp queries.
 *
 * Code that runs outside a request (schedulers, socket events, scripts) has no
 * organization in context, and its queries are not scoped. That is safe only
 * while there is a single organization; those paths move to explicit
 * per-organization loops before new organizations can be created.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';

/**
 * The organization that owned all data before multi-tenancy
 * (created by the 20261012100000_add_organizations migration).
 */
export const DEFAULT_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';

interface TenantStore {
  organizationId: string;
}

const storage = new AsyncLocalStorage<TenantStore>();

/**
 * The organization of the current request, or undefined outside a request
 */
export function currentOrganizationId(): string | undefined {
  return storage.getStore()?.organizationId;
}

/**
 * Run a function with queries scoped to one organization
 * (for schedulers and scripts that work through organizations one by one)
 */
export function runAsOrganization<T>(organizationId: string, fn: () => T): T {
  return storage.run({ organizationId }, fn);
}

/**
 * Express middleware: scope the rest of the request to the signed-in user's
 * organization. Must run after passport has attached req.user.
 */
export function tenantContext(req: Request, res: Response, next: NextFunction): void {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    return next();
  }
  storage.run({ organizationId }, () => next());
}
