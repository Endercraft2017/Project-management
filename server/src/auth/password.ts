import bcrypt from 'bcryptjs';
import { z } from 'zod';

// bcrypt only considers the first 72 bytes. Reject longer inputs rather than
// silently treating distinct user passwords as equivalent.
export const newPasswordSchema = z.string().min(12).max(128).refine(
  (value) => Buffer.byteLength(value, 'utf8') <= 72,
  'Password must fit within 72 UTF-8 bytes'
);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(newPasswordSchema.parse(password), 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || Buffer.byteLength(password, 'utf8') > 72 || !/^\$2[aby]\$\d{2}\$/.test(hash)) return false;
  return bcrypt.compare(password, hash);
}
