import { randomBytes } from 'node:crypto';
import { acceptedCounter, decryptMfaSecret, encryptMfaSecret, makeTotp, mfaConfigured, recoveryHash } from '../operator-mfa';

const previousKey = process.env.CONSOLE_MFA_ENCRYPTION_KEY;
beforeEach(() => { process.env.CONSOLE_MFA_ENCRYPTION_KEY = randomBytes(32).toString('hex'); });
afterAll(() => {
  if (previousKey === undefined) delete process.env.CONSOLE_MFA_ENCRYPTION_KEY;
  else process.env.CONSOLE_MFA_ENCRYPTION_KEY = previousKey;
});
it('authenticates encrypted secrets to the operator and randomizes every encryption', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  const first = encryptMfaSecret('operator-a', secret), second = encryptMfaSecret('operator-a', secret);
  expect(first === second).toBe(false); expect(first.includes(secret)).toBe(false);
  expect(decryptMfaSecret('operator-a', first) === secret).toBe(true);
  expect(() => decryptMfaSecret('operator-b', first)).toThrow('MFA is unavailable');
  const parts = first.split('.'); parts[1] = Buffer.alloc(16).toString('base64url');
  expect(() => decryptMfaSecret('operator-a', parts.join('.'))).toThrow('MFA is unavailable');
});
it('fails closed when its dedicated encryption key is missing or replaced', () => {
  const encrypted = encryptMfaSecret('operator', 'JBSWY3DPEHPK3PXP');
  process.env.CONSOLE_MFA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  expect(() => decryptMfaSecret('operator', encrypted)).toThrow('MFA is unavailable');
  delete process.env.CONSOLE_MFA_ENCRYPTION_KEY;
  expect(mfaConfigured()).toBe(false);
  expect(() => encryptMfaSecret('operator', 'secret')).toThrow('MFA is unavailable');
});
it('accepts only a fresh six-digit counter within one 30-second window of clock drift', () => {
  const secret = 'JBSWY3DPEHPK3PXP', now = 1_700_000_000_000, totp = makeTotp(secret);
  const counter = Math.floor(now / 30000), current = totp.generate({ timestamp: now });
  expect(acceptedCounter(secret, current, counter-1, now)).toBe(counter);
  expect(acceptedCounter(secret, current, counter, now)).toBeNull();
  expect(acceptedCounter(secret, totp.generate({ timestamp: now+30000 }), counter, now)).toBe(counter+1);
  expect(acceptedCounter(secret, totp.generate({ timestamp: now-60000 }), -1, now)).toBeNull();
  expect(acceptedCounter(secret, '12345', -1, now)).toBeNull();
});
it('normalizes random recovery-code presentation without storing the original code', () => {
  const code = randomBytes(16).toString('hex');
  expect(recoveryHash(code) === recoveryHash(code.toUpperCase().match(/.{1,8}/g)!.join('-'))).toBe(true);
  expect(recoveryHash(code) === code).toBe(false);
});
