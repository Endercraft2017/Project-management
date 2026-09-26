/**
 * Reset Database Script
 * Drops all tables and recreates the schema
 * USE WITH CAUTION - This will delete ALL data!
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🗑️  Resetting database...');

  try {
    // Drop all existing enum types first (they persist after DROP SCHEMA)
    console.log('🔍 Checking for existing enum types...');
    await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "Role" CASCADE;`);
    await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "SprintStatus" CASCADE;`);
    await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS "ConversationType" CASCADE;`);
    console.log('✅ Dropped enum types');

    // Drop all tables by dropping and recreating the public schema
    await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE;');
    console.log('✅ Dropped public schema');

    await prisma.$executeRawUnsafe('CREATE SCHEMA public;');
    console.log('✅ Created public schema');

    await prisma.$executeRawUnsafe('GRANT ALL ON SCHEMA public TO postgres;');
    await prisma.$executeRawUnsafe('GRANT ALL ON SCHEMA public TO public;');
    console.log('✅ Restored default permissions');

    console.log('✅ Database reset complete!');
    console.log('ℹ️  Run "npx prisma migrate deploy" to apply migrations');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
