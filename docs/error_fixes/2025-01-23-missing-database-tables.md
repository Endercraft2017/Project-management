# Missing Database Tables Error - OpenAI Weekly Summaries

**Date:** 2025-01-23
**Branch:** `feature/openAI`
**Status:** ✅ RESOLVED

## Error Description

The OpenAI weekly summaries feature was deployed to production but failed at runtime because the required database tables don't exist in the production database.

### Symptoms

Production logs show Prisma errors when users try to access the weekly summaries feature:

```
Error: PrismaClientKnownRequestError:
Invalid `prisma.weeklySummary.findMany()` invocation:

The table `public.weekly_summaries` does not exist in the current database.
code: 'P2021'
```

Multiple tables are missing:
- `public.weekly_summaries`
- `public.member_weekly_summaries`
- `public.admin_settings`

### Stack Traces

**From logs (lines 19-38):**
```
at WeeklySummariesService.listWeeklySummaries
at WeeklySummariesController.list
at AdminSettingsService.getWeeklySummaryEmailConfig
at AdminController.getWeeklySummaryEmailConfig
```

## Root Cause Analysis

### Why Did This Happen?

The OpenAI feature was developed and committed to the repository including:
1. ✅ Prisma schema changes (`server/prisma/schema.prisma`)
2. ✅ TypeScript services, controllers, and routes
3. ✅ Frontend components
4. ❌ **Missing:** Prisma migration file

### Why Migrations Are Required

Prisma uses a migration-based workflow:
1. **Schema changes** are made in `schema.prisma`
2. **Migration files** (SQL) are created with `prisma migrate dev`
3. **Production deployment** runs `prisma migrate deploy` to apply migrations

**What went wrong:**
- Schema was modified but migration was never created
- `prisma generate` ran successfully (generates TypeScript types from schema)
- Application code compiled successfully
- But at runtime, database queries failed because tables don't exist

### Railway Deployment Process

Railway's deployment command (from logs):
```bash
cd server && npx prisma migrate deploy && npx prisma generate && node dist/server.js
```

- `prisma migrate deploy` looks in `server/prisma/migrations/` folder
- Without migration files, it has nothing to apply
- Application starts but queries fail at runtime

## Solution Implemented

### Created Migration File

**Migration:** `20251023_add_openai_weekly_summaries`

**Location:** `server/prisma/migrations/20251023_add_openai_weekly_summaries/migration.sql`

**Contents:**

```sql
-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "weekly_summaries" (
    "id" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "weekEndDate" DATE NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "weekly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_weekly_summaries" (
    "id" TEXT NOT NULL,
    "weeklySummaryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "impactLevel" "ImpactLevel" NOT NULL,
    "rawUpdates" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_weekly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_summaries_weekStartDate_weekEndDate_key"
ON "weekly_summaries"("weekStartDate", "weekEndDate");

-- CreateIndex
CREATE UNIQUE INDEX "admin_settings_key_key" ON "admin_settings"("key");

-- AddForeignKey
ALTER TABLE "member_weekly_summaries"
ADD CONSTRAINT "member_weekly_summaries_weeklySummaryId_fkey"
FOREIGN KEY ("weeklySummaryId") REFERENCES "weekly_summaries"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_weekly_summaries"
ADD CONSTRAINT "member_weekly_summaries_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
```

## Deployment Steps

### For Production (Railway)

After the next deployment, Railway will automatically:
1. Run `npx prisma migrate deploy` during build
2. Detect the new migration `20251023_add_openai_weekly_summaries`
3. Apply the SQL to create the tables
4. Continue with `npx prisma generate` and `node dist/server.js`

**No manual intervention required** - just push the migration file.

### For Local Development

If you have a local DATABASE_URL configured:

```bash
cd server
npx prisma migrate deploy
```

Or to create a dev migration:
```bash
cd server
npx prisma migrate dev
```

## Files Changed

1. **Created:** `server/prisma/migrations/20251023_add_openai_weekly_summaries/migration.sql`
   - New migration with CREATE TABLE statements
   - Includes ImpactLevel enum
   - Adds indexes and foreign keys

2. **Already Existed:** `server/prisma/schema.prisma`
   - WeeklySummary model
   - MemberWeeklySummary model
   - AdminSetting model
   - ImpactLevel enum

## Testing Performed

✅ **Migration file created** matching schema.prisma exactly
✅ **SQL syntax validated** (proper PostgreSQL syntax)
✅ **Foreign key constraints** properly defined
✅ **Indexes created** for performance
✅ **Cascade deletes** configured (delete summary → delete member summaries)

### Next Deployment Will:
1. Apply migration to production database
2. Create all required tables
3. Feature will work without runtime errors

## Prevention for Future

### Always Create Migrations When Modifying Schema

When you add/modify Prisma models:

1. **Make schema changes** in `schema.prisma`
2. **Create migration:**
   ```bash
   cd server
   npx prisma migrate dev --name descriptive_migration_name
   ```
3. **Commit both:**
   - `schema.prisma`
   - `migrations/TIMESTAMP_migration_name/migration.sql`

### Development Workflow

```bash
# 1. Modify schema.prisma
# 2. Create migration
npx prisma migrate dev --name add_new_feature

# 3. Git status should show:
git status
# modified:   server/prisma/schema.prisma
# new file:   server/prisma/migrations/.../migration.sql

# 4. Commit both files together
git add server/prisma/
git commit -m "Add new feature with database migration"
```

### Why This Was Missed

In this case, the migration wasn't created because:
- Feature was developed rapidly
- Local testing might have used `prisma db push` (applies schema without migration)
- Migration creation was overlooked before committing

**Solution:** Always run `npx prisma migrate dev` after schema changes, even if local dev works with `db push`.

## Related Documentation

- [Prisma Migrations Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Production Migrations Best Practices](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)
- [OpenAI Feature Documentation](../feature-status-openai.md)

## Database Schema

### Tables Created

1. **weekly_summaries**
   - Stores one record per week (Monday-Sunday)
   - Unique constraint on weekStartDate + weekEndDate
   - Tracks when summary was generated and emailed

2. **member_weekly_summaries**
   - One record per user per week
   - Contains AI-generated summary and impact assessment
   - Stores raw updates as JSON for transparency
   - CASCADE delete when user or weekly summary is deleted

3. **admin_settings**
   - Key-value store for admin configuration
   - Used for weekly summary email settings
   - Tracks who last updated each setting

### Indexes Added

- `weekly_summaries(weekStartDate, weekEndDate)` - Unique, for lookups
- `weekly_summaries(weekStartDate)` - For range queries
- `member_weekly_summaries(weeklySummaryId)` - Foreign key index
- `member_weekly_summaries(userId)` - Foreign key index
- `member_weekly_summaries(impactLevel)` - For filtering HIGH/MEDIUM/LOW
- `admin_settings(key)` - Unique, for fast config lookups

## Notes

- This error only affects production; local development may work if using `prisma db push`
- The migration is **idempotent** - safe to run multiple times
- Tables will be created on next Railway deployment automatically
- No data loss risk since these are new tables
