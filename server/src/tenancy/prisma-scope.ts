/**
 * Tenant scoping for Prisma
 *
 * When a request has an organization in context (see ./context.ts):
 * - reads, updates and deletes on tenant-owned models only match rows of that
 *   organization (organizationId is added to the where clause)
 * - creates are stamped with that organizationId
 * - user lists and lookups by filter only return members of that organization
 *
 * Services keep writing ordinary Prisma queries; a missed filter can no longer
 * leak another organization's rows.
 *
 * Not covered here: rows reached only through a relation (e.g. a sprint's
 * `tasks` include) are scoped by their parent, and raw SQL is not scoped.
 */

import { PrismaClient } from '@prisma/client';
import { currentOrganizationId } from './context';

/** Models with an organizationId column */
export const TENANT_MODELS = new Set<string>([
  'Membership',
  'Sprint',
  'Task',
  'Conversation',
  'Message',
  'SyncLog',
  'File',
  'TeamInvite',
  'DailyUpdate',
  'Note',
  'WeeklySummary',
  'MemberWeeklySummary',
  'AdminSetting',
  'Notification',
]);

/** Operations whose `where` gets the organization filter */
const FILTERED_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

/** User operations that list or search, and so must stay within the organization */
const USER_SEARCH_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

const RELATION_WRITE_KEYS = ['connect', 'connectOrCreate', 'create', 'createMany', 'set', 'disconnect', 'upsert'];

/**
 * True for a nested relation write such as `{ connect: { id } }`
 */
function isRelationWrite(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || value instanceof Date) {
    return false;
  }
  return RELATION_WRITE_KEYS.some((key) => key in (value as Record<string, unknown>));
}

/**
 * Add the organization to create data.
 *
 * Prisma accepts either scalar foreign keys (`sprintId`) or relation writes
 * (`sprint: { connect }`) in one create, but not both, so match the style the
 * caller used.
 */
export function stampOrganization(data: Record<string, any>, organizationId: string): Record<string, any> {
  if (!data || data.organizationId !== undefined || data.organization !== undefined) {
    return data;
  }
  const usesRelationWrites = Object.values(data).some(isRelationWrite);
  return usesRelationWrites
    ? { ...data, organization: { connect: { id: organizationId } } }
    : { ...data, organizationId };
}

/**
 * Scope the arguments of one tenant-model operation
 */
export function scopeTenantArgs(operation: string, args: any, organizationId: string): any {
  const scoped = { ...(args ?? {}) };

  if (FILTERED_OPERATIONS.has(operation)) {
    // Spread at the top level (not AND) so unique lookups stay valid
    scoped.where = { ...(scoped.where ?? {}), organizationId };
  }

  if (operation === 'create') {
    scoped.data = stampOrganization(scoped.data, organizationId);
  }

  if (operation === 'createMany' || operation === 'createManyAndReturn') {
    scoped.data = Array.isArray(scoped.data)
      ? scoped.data.map((row: any) => ({ ...row, organizationId: row.organizationId ?? organizationId }))
      : { ...scoped.data, organizationId: scoped.data?.organizationId ?? organizationId };
  }

  if (operation === 'upsert') {
    scoped.where = { ...(scoped.where ?? {}), organizationId };
    scoped.create = stampOrganization(scoped.create, organizationId);
  }

  return scoped;
}

/**
 * Scope user searches to members of the organization
 */
export function scopeUserArgs(operation: string, args: any, organizationId: string): any {
  if (!USER_SEARCH_OPERATIONS.has(operation)) {
    return args;
  }
  const scoped = { ...(args ?? {}) };
  const memberOfOrg = { memberships: { some: { organizationId } } };
  scoped.where = scoped.where ? { AND: [scoped.where, memberOfOrg] } : memberOfOrg;
  return scoped;
}

/**
 * Wrap a Prisma client so every query respects the current organization
 */
export function withTenantScope(client: PrismaClient) {
  return client.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const organizationId = currentOrganizationId();
          if (!organizationId || !model) {
            return query(args);
          }
          if (TENANT_MODELS.has(model)) {
            return query(scopeTenantArgs(operation, args, organizationId));
          }
          if (model === 'User') {
            return query(scopeUserArgs(operation, args, organizationId));
          }
          return query(args);
        },
      },
    },
  });
}
