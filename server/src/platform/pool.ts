import { Pool } from 'pg';
let pool: Pool | undefined;
export function getControlPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.delete('schema');
    pool = new Pool({ connectionString: url.toString(), max: 5, connectionTimeoutMillis: 10000 });
    pool.on('error', () => console.error('Control database connection failed'));
  }
  return pool;
}
export async function closeControlPool(): Promise<void> {
  if (pool) { const current = pool; pool = undefined; await current.end(); }
}
