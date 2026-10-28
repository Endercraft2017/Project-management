import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';
import { sessionConfig, databaseConfig, serverConfig } from '@/config';

declare module 'express-session' {
  interface SessionData {
    passport?: { user?: string };
    tenantId?: string;
    sessionVersion?: number;
    issuedAt?: number;
    workspaceContext?: string;
  }
}

const PgSession = connectPgSimple(session);
const pgPool = new Pool({ connectionString: databaseConfig.url, max: 10 });
export const sessionStore = new PgSession({
  pool: pgPool, schemaName: 'ez_control', tableName: 'tenant_sessions',
  createTableIfMissing: false, pruneSessionInterval: 900,
});
export const getTenantSessionStore = () => sessionStore;
export const sessionMiddleware = session({
  store: sessionStore, secret: sessionConfig.secret, resave: false,
  saveUninitialized: false, name: 'connect.sid', rolling: false,
  cookie: { maxAge: sessionConfig.maxAge, httpOnly: true, secure: serverConfig.isProduction, sameSite: 'lax', path: '/' },
  proxy: serverConfig.isProduction,
});
export async function closeSessionStore(): Promise<void> {
  sessionStore.close();
  await pgPool.end();
}
