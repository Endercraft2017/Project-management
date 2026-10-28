import { hashPassword, verifyPassword, newPasswordSchema } from '../password';

describe('tenant password boundary', () => {
  it('stores a salted hash and verifies only the correct password', async () => {
    const password = 'Correct horse battery staple';
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('A different password', hash)).toBe(false);
  });
  it('rejects passwords beyond bcrypt byte bounds, including Unicode', () => {
    expect(() => newPasswordSchema.parse('x'.repeat(73))).toThrow();
    expect(() => newPasswordSchema.parse('🔒'.repeat(19))).toThrow();
    expect(() => newPasswordSchema.parse('short')).toThrow();
    expect(() => newPasswordSchema.parse('x'.repeat(72))).not.toThrow();
  });
  it('does not accept an overlong input sharing the first 72 bytes', async () => {
    const password = 'x'.repeat(72);
    const hash = await hashPassword(password);
    expect(await verifyPassword(password + 'extra', hash)).toBe(false);
  });
});
