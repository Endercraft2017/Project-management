-- AlterTable
ALTER TABLE "messages"
ADD COLUMN IF NOT EXISTS "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_mentions_idx" ON "messages"("mentions");
