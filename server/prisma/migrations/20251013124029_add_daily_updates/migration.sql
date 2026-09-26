-- CreateTable
CREATE TABLE "daily_updates" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_updates_date_idx" ON "daily_updates"("date");

-- CreateIndex
CREATE INDEX "daily_updates_userId_idx" ON "daily_updates"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_updates_userId_date_key" ON "daily_updates"("userId", "date");

-- AddForeignKey
ALTER TABLE "daily_updates" ADD CONSTRAINT "daily_updates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
