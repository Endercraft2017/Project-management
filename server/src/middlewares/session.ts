/**
 * Session Configuration
 * PostgreSQL session store with secure settings
 */

import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';
import { sessionConfig, databaseConfig, serverConfig } from '@/config';

const PgSession = connectPgSimple(session);

// Create PostgreSQL connection pool for sessions
const pgPool = new Pool({
  connectionString: databaseConfig.url,
  max: 10,
});

/**
 * Session store configuration
 */
const sessionStore = new PgSession({
  pool: pgPool,
  tableName: 'session',
  createTableIfMissing: true,
  pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
});

/**
 * Session middleware configuration
 */
export const sessionMiddleware = session({
  store: sessionStore,
  secret: sessionConfig.secret,
  resave: false,
  saveUninitialized: false,
  name: 'connect.sid',
  cookie: {
    maxAge: sessionConfig.maxAge, // 7 days
    httpOnly: true, // Prevent JavaScript access
    secure: serverConfig.isProduction, // HTTPS only in production
    sameSite: 'lax', // 'lax' allows cookies to be sent on top-level navigations (OAuth redirects)
    path: '/',
  },
  rolling: true, // Reset expiration on every request
  proxy: serverConfig.isProduction, // Trust the reverse proxy when using secure cookies
});

/**
 * Cleanup function for graceful shutdown
 */
export async function closeSessionStore(): Promise<void> {
  await pgPool.end();
}
