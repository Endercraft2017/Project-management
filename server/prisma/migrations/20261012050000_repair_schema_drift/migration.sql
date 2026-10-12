-- Bring the database in line with schema.prisma.
-- Earlier hand-written migrations left out indexes and a unique constraint the
-- schema declares, named one foreign key differently, and added a column the
-- schema doesn't have. Found by the CI check that compares migrations with the
-- schema.

-- Thread replies: recreate the self-referencing foreign key under Prisma's name
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_parentmessageid_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER INDEX IF EXISTS "messages_parentmessageid_idx" RENAME TO "messages_parentMessageId_idx";

-- Drive attachments: drop an index and a column the schema doesn't define
DROP INDEX IF EXISTS "message_attachments_driveFileId_idx";
ALTER TABLE "message_attachments" DROP COLUMN IF EXISTS "updatedAt";

-- Admin settings
CREATE INDEX IF NOT EXISTS "admin_settings_key_idx" ON "admin_settings"("key");

-- Weekly summaries
CREATE INDEX IF NOT EXISTS "weekly_summaries_weekStartDate_idx" ON "weekly_summaries"("weekStartDate");
CREATE INDEX IF NOT EXISTS "weekly_summaries_weekEndDate_idx" ON "weekly_summaries"("weekEndDate");

-- Member weekly summaries: one per member per week. Without the constraint,
-- duplicates could have been written; keep the newest of each before adding it.
DELETE FROM "member_weekly_summaries" a
USING "member_weekly_summaries" b
WHERE a."weeklySummaryId" = b."weeklySummaryId"
  AND a."userId" = b."userId"
  AND (a."createdAt" < b."createdAt" OR (a."createdAt" = b."createdAt" AND a."id" < b."id"));

CREATE UNIQUE INDEX IF NOT EXISTS "member_weekly_summaries_weeklySummaryId_userId_key" ON "member_weekly_summaries"("weeklySummaryId", "userId");
CREATE INDEX IF NOT EXISTS "member_weekly_summaries_weeklySummaryId_idx" ON "member_weekly_summaries"("weeklySummaryId");
CREATE INDEX IF NOT EXISTS "member_weekly_summaries_userId_idx" ON "member_weekly_summaries"("userId");
CREATE INDEX IF NOT EXISTS "member_weekly_summaries_impactLevel_idx" ON "member_weekly_summaries"("impactLevel");
