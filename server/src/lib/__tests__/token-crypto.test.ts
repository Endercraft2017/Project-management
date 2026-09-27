/**
 * Token encryption tests
 * The key is read at module load, so each case loads a fresh module copy.
 */

const KEY = 'a'.repeat(64); // 32 bytes as hex

function loadWithKey(key: string | undefined) {
  const previous = process.env.TOKEN_ENCRYPTION_KEY;
  if (key === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
  else process.env.TOKEN_ENCRYPTION_KEY = key;

  let mod: typeof import('../token-crypto') | undefined;
  jest.isolateModules(() => {
    mod = require('../token-crypto');
  });

  if (previous === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
  else process.env.TOKEN_ENCRYPTION_KEY = previous;
  return mod!;
}

describe('token-crypto', () => {
  describe('with a key', () => {
    const { encryptToken, decryptToken } = loadWithKey(KEY);

    it('round-trips a token', () => {
      const encrypted = encryptToken('ya29.secret-token');
      expect(encrypted).not.toContain('ya29');
      expect(encrypted.startsWith('enc:v1:')).toBe(true);
      expect(decryptToken(encrypted)).toBe('ya29.secret-token');
    });

    it('uses a fresh IV each time', () => {
      expect(encryptToken('same')).not.toBe(encryptToken('same'));
    });

    it('still reads legacy plaintext tokens', () => {
      expect(decryptToken('1//legacy-refresh-token')).toBe('1//legacy-refresh-token');
    });

    it('rejects tampered ciphertext', () => {
      const encrypted = encryptToken('value');
      const tampered = encrypted.slice(0, -2) + (encrypted.endsWith('A') ? 'BB' : 'AA');
      expect(() => decryptToken(tampered)).toThrow();
    });

    it('passes empty values through', () => {
      expect(encryptToken(null)).toBeNull();
      expect(decryptToken(undefined)).toBeNull();
    });
  });

  describe('without a key', () => {
    const { encryptToken, decryptToken } = loadWithKey(undefined);

    it('stores tokens as-is', () => {
      expect(encryptToken('plain')).toBe('plain');
      expect(decryptToken('plain')).toBe('plain');
    });

    it('fails loudly on an encrypted value it cannot read', () => {
      const encrypted = loadWithKey(KEY).encryptToken('value');
      expect(() => decryptToken(encrypted)).toThrow(/TOKEN_ENCRYPTION_KEY/);
    });
  });

  it('rejects a key of the wrong length', () => {
    expect(() => loadWithKey('abcd')).toThrow(/32 bytes/);
  });
});
