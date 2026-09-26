-- AlterTable
ALTER TABLE "users" ADD COLUMN     "googleRefreshToken" TEXT,
ADD COLUMN     "googleAccessToken" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);
