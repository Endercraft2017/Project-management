-- Multi-tenancy foundation.
--
-- 1. Organizations and memberships.
-- 2. One organization, "ServiceBay", that owns all existing data. Its id is a
--    fixed constant so code and this migration agree on it.
-- 3. Every existing user becomes a member of it, keeping their current role.
-- 4. "organizationId" on every tenant-owned table. Existing rows are filled in
--    by the column default. The default is transitional: it keeps writes that
--    don't pass through a request (schedulers, scripts) working while there is
--    only one organization, and is removed once new organizations can be
--    created.

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "allowedEmailDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "memberships_userId_idx" ON "memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organizationId_userId_key" ON "memberships"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The organization that owns all existing data
INSERT INTO "organizations" ("id", "name", "slug", "allowedEmailDomains", "updatedAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'ServiceBay', 'servicebay', ARRAY['servicebay.ai'], CURRENT_TIMESTAMP);

-- Every existing user joins it with their current role
INSERT INTO "memberships" ("id", "organizationId", "userId", "role", "updatedAt")
SELECT gen_random_uuid()::text, '00000000-0000-4000-8000-000000000001', "id", "role", CURRENT_TIMESTAMP
FROM "users";

-- sprints
ALTER TABLE "sprints" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "sprints_organizationId_idx" ON "sprints"("organizationId");
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tasks
ALTER TABLE "tasks" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "tasks_organizationId_idx" ON "tasks"("organizationId");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- conversations
ALTER TABLE "conversations" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "conversations_organizationId_idx" ON "conversations"("organizationId");
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- messages
ALTER TABLE "messages" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "messages_organizationId_idx" ON "messages"("organizationId");
ALTER TABLE "messages" ADD CONSTRAINT "messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- sync_logs
ALTER TABLE "sync_logs" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "sync_logs_organizationId_idx" ON "sync_logs"("organizationId");
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- files
ALTER TABLE "files" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "files_organizationId_idx" ON "files"("organizationId");
ALTER TABLE "files" ADD CONSTRAINT "files_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- team_invites
ALTER TABLE "team_invites" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "team_invites_organizationId_idx" ON "team_invites"("organizationId");
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- daily_updates
ALTER TABLE "daily_updates" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "daily_updates_organizationId_idx" ON "daily_updates"("organizationId");
ALTER TABLE "daily_updates" ADD CONSTRAINT "daily_updates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- notes
ALTER TABLE "notes" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "notes_organizationId_idx" ON "notes"("organizationId");
ALTER TABLE "notes" ADD CONSTRAINT "notes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- weekly_summaries
ALTER TABLE "weekly_summaries" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "weekly_summaries_organizationId_idx" ON "weekly_summaries"("organizationId");
ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- member_weekly_summaries
ALTER TABLE "member_weekly_summaries" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "member_weekly_summaries_organizationId_idx" ON "member_weekly_summaries"("organizationId");
ALTER TABLE "member_weekly_summaries" ADD CONSTRAINT "member_weekly_summaries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- admin_settings
ALTER TABLE "admin_settings" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "admin_settings_organizationId_idx" ON "admin_settings"("organizationId");
ALTER TABLE "admin_settings" ADD CONSTRAINT "admin_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- notifications
ALTER TABLE "notifications" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "notifications_organizationId_idx" ON "notifications"("organizationId");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
