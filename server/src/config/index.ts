/**
 * Configuration Module
 * Centralized configuration management with validation
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment variable schema with Zod validation
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // Database
  DATABASE_URL: z.string().url(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  // Session
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  SESSION_MAX_AGE: z.coerce.number().int().min(60000).max(43200000).default(43200000),
  CONSOLE_SESSION_SECRET: z.string().min(32).optional(),

  // Google Sheets
  GOOGLE_SHEETS_PRIVATE_KEY: z.string().optional(),
  GOOGLE_SHEETS_CLIENT_EMAIL: z.string().email().optional(),
  GOOGLE_SPREADSHEET_ID: z.string().optional(),

  // Admin
  ADMIN_EMAILS: z.string().default('').transform((str) => str.split(',').map((e) => e.trim()).filter(Boolean)),

  // CORS
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(86400000).default(900000), // 15 min
  // Per user per window. The app makes several requests per screen, so this
  // must be generous enough for normal use.
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(100000).default(1000),

  // File Upload
  MAX_FILE_SIZE: z.coerce.number().int().min(1).max(104857600).default(5242880), // 5MB
  UPLOAD_DIR: z.string().default('uploads'),
}).refine((value) => !value.CONSOLE_SESSION_SECRET || value.CONSOLE_SESSION_SECRET !== value.SESSION_SECRET, {
  path: ['CONSOLE_SESSION_SECRET'], message: 'Operator and tenant session secrets must be different',
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.issues.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

export const config = parseEnv();

// Export individual config sections
export const serverConfig = {
  nodeEnv: config.NODE_ENV,
  port: config.PORT,
  isDevelopment: config.NODE_ENV === 'development',
  isProduction: config.NODE_ENV === 'production',
  isTest: config.NODE_ENV === 'test',
};

export const databaseConfig = {
  url: config.DATABASE_URL,
};

export const googleOAuthConfig = {
  clientID: config.GOOGLE_CLIENT_ID,
  clientSecret: config.GOOGLE_CLIENT_SECRET,
  callbackURL: config.GOOGLE_CALLBACK_URL,
};

export const sessionConfig = {
  secret: config.SESSION_SECRET,
  maxAge: config.SESSION_MAX_AGE,
};

export const googleSheetsConfig = {
  privateKey: config.GOOGLE_SHEETS_PRIVATE_KEY,
  clientEmail: config.GOOGLE_SHEETS_CLIENT_EMAIL,
  spreadsheetId: config.GOOGLE_SPREADSHEET_ID,
};

export const adminConfig = {
  emails: config.ADMIN_EMAILS,
};

export const corsConfig = {
  origin: config.CORS_ORIGIN,
  clientUrl: config.CLIENT_URL,
};

export const rateLimitConfig = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
};

export const fileUploadConfig = {
  maxSize: config.MAX_FILE_SIZE,
  uploadDir: config.UPLOAD_DIR,
};

export default config;
