/**
 * Prisma Client Singleton
 * Ensures only one instance of Prisma Client exists
 * Follows best practices for connection management
 */

import { PrismaClient } from '@prisma/client';
import { withTenantScope } from '@/tenancy/prisma-scope';

// Prisma Client options for development
const prismaClientOptions = {
  log: (process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error']) as ('query' | 'info' | 'warn' | 'error')[],
};

// Global variable to store Prisma Client instance
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

// Create Prisma Client instance or reuse existing one
const baseClient = globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions);

// In development, store instance globally to prevent hot reload issues
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = baseClient;
}

/**
 * The client every service uses. Queries are scoped to the organization of
 * the current request (see tenancy/prisma-scope.ts).
 */
export const prisma = withTenantScope(baseClient);

/**
 * Graceful shutdown handler
 * Disconnects Prisma Client when application terminates
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

// Handle process termination
process.on('beforeExit', async () => {
  await disconnectPrisma();
});

/**
 * Health check function
 * Verifies database connection is active
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

export default prisma;
