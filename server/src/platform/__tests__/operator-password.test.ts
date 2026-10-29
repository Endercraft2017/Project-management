import { changeOperatorPassword } from '../store';
import { getControlPool } from '../pool';

jest.mock('../pool', () => ({ getControlPool: jest.fn() }));

const id = '12345678-1234-1234-1234-123456789012';
const oldHash = '$2b$12$' + 'a'.repeat(53), newHash = '$2b$12$' + 'b'.repeat(53);
const input = { id, expectedVersion: 3, expectedHash: oldHash, passwordHash: newHash };
const query = jest.fn(), release = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (getControlPool as jest.Mock).mockReturnValue({ connect: jest.fn().mockResolvedValue({ query, release }) });
  query.mockResolvedValue({ rows: [] });
});

it('commits the conditional hash/version update with a credential-free audit record', async () => {
  query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('UPDATE')
    ? [{ id, email: 'operator@example.invalid', name: 'Operator', session_version: 4 }] : [] }));
  await expect(changeOperatorPassword(input)).resolves.toEqual({ id, email: 'operator@example.invalid', name: 'Operator', sessionVersion: 4 });
  expect(query.mock.calls[1][0]).toContain('session_version=$3 AND password_hash=$4');
  expect(query.mock.calls[1][1]).toEqual([newHash, id, 3, oldHash]);
  const audit = query.mock.calls[2];
  expect(audit[0]).toContain('INSERT INTO ez_control.audit');
  expect(audit[1]).toEqual([expect.any(String), null, id, 'operator.password_changed', '{}']);
  expect(query.mock.calls[3]).toEqual(['COMMIT']);
  expect(release).toHaveBeenCalledTimes(1);
});

it('rejects a stale verified hash/version and never records a successful change', async () => {
  await expect(changeOperatorPassword(input)).rejects.toMatchObject({ status: 409 });
  expect(query.mock.calls.map((call) => call[0])).toEqual(['BEGIN', expect.stringContaining('UPDATE'), 'ROLLBACK']);
  expect(release).toHaveBeenCalledTimes(1);
});

it('rolls back the password update when its audit cannot be stored', async () => {
  query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('INSERT')) throw new Error('Audit storage unavailable');
    return { rows: sql.startsWith('UPDATE') ? [{ id, email: 'operator@example.invalid', name: 'Operator', session_version: 4 }] : [] };
  });
  await expect(changeOperatorPassword(input)).rejects.toThrow('Audit storage unavailable');
  expect(query).toHaveBeenLastCalledWith('ROLLBACK');
  expect(query).not.toHaveBeenCalledWith('COMMIT');
  expect(release).toHaveBeenCalledTimes(1);
});
