/**
 * Token Encryption
 * AES-256-GCM encryption for Google OAuth tokens stored in the database.
 *
 * Enabled when TOKEN_ENCRYPTION_KEY is set (32 bytes as 64 hex chars or base64).
 * Values are stored as "enc:v1:<iv>:<tag>:<ciphertext>" (base64 parts).
 * Legacy plaintext values are still read, and are re-encrypted the next time
 * they are written (sign-in or token refresh).
 */

import crypto from 'crypto';

const PREFIX = 'enc:v1:';

function loadKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;

  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64)');
  }
  return key;
}

const key = loadKey();

if (!key && process.env.NODE_ENV === 'production') {
  console.warn('[TokenCrypto] TOKEN_ENCRYPTION_KEY is not set; Google tokens are stored unencrypted');
}

export function encryptToken(value: string): string;
export function encryptToken(value: string | null | undefined): string | null | undefined;
export function encryptToken(value: string | null | undefined): string | null | undefined {
  if (!value || !key) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptToken(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext

  if (!key) {
    throw new Error('Encrypted Google token found but TOKEN_ENCRYPTION_KEY is not set');
  }

  const [iv, tag, ciphertext] = value.slice(PREFIX.length).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString(
    'utf8'
  );
}
