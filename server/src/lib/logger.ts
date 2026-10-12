/**
 * Logger
 * One structured logger for the server.
 *
 * - production: one JSON object per line, so the hosting log viewer (or a log
 *   drain) can search and filter by field (requestId, userId, status...)
 * - development: readable colored lines
 * - test: warnings and errors only
 *
 * Set LOG_LEVEL to override the level (error, warn, info, http, debug).
 */

import winston from 'winston';

const env = process.env.NODE_ENV || 'development';
const defaultLevel = env === 'test' ? 'warn' : env === 'production' ? 'http' : 'debug';

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service: _service, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${message}${extra}`;
  })
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || defaultLevel,
  format: env === 'production' ? prodFormat : devFormat,
  defaultMeta: { service: 'server' },
  transports: [new winston.transports.Console()],
});

/**
 * Turn an unknown thrown value into loggable fields
 */
export function errorFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, stack: error.stack };
  }
  return { errorMessage: String(error) };
}

export default logger;
