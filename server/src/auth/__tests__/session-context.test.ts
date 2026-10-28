import type { Request, Response } from 'express';
import { sessionTenantContext } from '../session-context';
import { getTenantById } from '@/platform/store';
import { runWithTenant } from '@/tenancy/context';

jest.mock('@/config', () => ({ sessionConfig: { maxAge: 43200000 } }));
jest.mock('@/platform/store', () => ({ getTenantById: jest.fn() }));
jest.mock('@/tenancy/context', () => ({ runWithTenant: jest.fn((_tenant, next) => next()) }));

const tenant = { id: 'workspace-id', code: 'A0000Z', name: 'Workspace', schemaName: 'ez_t_aaaaaaaaaaaaaaaa', status: 'ACTIVE' };

function context(path = '/api/tasks', overrides: Record<string, unknown> = {}) {
  const destroy = jest.fn((done) => done());
  const req = { path, get: () => 'tab-context', session: { tenantId: tenant.id, issuedAt: Date.now(), workspaceContext: 'tab-context', passport: { user: 'user-id' }, destroy, ...overrides } } as unknown as Request;
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return { req, res: res as unknown as Response, destroy, next: jest.fn() };
}

describe('session tenant boundary before identity deserialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getTenantById as jest.Mock).mockResolvedValue(tenant);
  });

  it('enters only the server-resolved active tenant context', async () => {
    const { req, res, next } = context();
    await sessionTenantContext(req, res, next);
    expect(getTenantById).toHaveBeenCalledWith(tenant.id);
    expect(runWithTenant).toHaveBeenCalledWith(tenant, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('expires a legacy session without a context instead of creating a reload loop', async () => {
    const { req, res, next, destroy } = context('/api/auth/me', { workspaceContext: undefined });
    await sessionTenantContext(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a stale tab without destroying the new current session', async () => {
    const { req, res, next, destroy } = context('/api/tasks', { workspaceContext: 'new-tab-context' });
    await sessionTenantContext(req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(destroy).not.toHaveBeenCalled();
    expect(getTenantById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not allow an old suspended session to block a new explicit login', async () => {
    const { req, res, next } = context('/api/auth/login');
    await sessionTenantContext(req, res, next);
    expect(getTenantById).not.toHaveBeenCalled();
    expect(runWithTenant).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it.each([null, { ...tenant, status: 'SUSPENDED' }])('rejects a missing or inactive catalog tenant', async (found) => {
    (getTenantById as jest.Mock).mockResolvedValue(found);
    const { req, res, next, destroy } = context();
    await sessionTenantContext(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(runWithTenant).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a serialized identity without a tenant instead of entering a default schema', async () => {
    const { req, res, next, destroy } = context('/api/tasks', { tenantId: undefined });
    await sessionTenantContext(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(runWithTenant).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('enforces the absolute lifetime before deserialization', async () => {
    const { req, res, next } = context('/api/tasks', { issuedAt: Date.now() - 43200001 });
    await sessionTenantContext(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(runWithTenant).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
