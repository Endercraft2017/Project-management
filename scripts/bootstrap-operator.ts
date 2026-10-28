/** Read one JSON object from stdin. Passwords must never be passed in argv. */
import { z } from 'zod';
import { hashPassword, newPasswordSchema } from '../server/src/auth/password';
import { ensureControlSchema, bootstrapOperator } from '../server/src/platform/store';
import { closeControlPool } from '../server/src/platform/pool';

async function main() {
  if (process.argv.length > 2 || process.stdin.isTTY) throw new Error('Provide operator JSON through stdin, without command arguments');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk.toString();
    if (Buffer.byteLength(input) > 16384) throw new Error('Input exceeds size limit');
  }
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(254), name: z.string().trim().min(1).max(100), password: newPasswordSchema }).strict().parse(JSON.parse(input));
  await ensureControlSchema();
  const passwordHash = await hashPassword(parsed.password);
  const operator = await bootstrapOperator({ email: parsed.email, name: parsed.name, passwordHash });
  process.stdout.write(JSON.stringify({ success: true, operator: { id: operator.id, email: operator.email, name: operator.name } }) + '\n');
}
main().catch(() => {
  console.error('Operator bootstrap failed. Check stdin fields, password policy and database availability.');
  process.exitCode = 1;
}).finally(async () => { await closeControlPool(); });
