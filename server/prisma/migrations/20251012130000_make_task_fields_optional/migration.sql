-- AlterTable: Make task fields optional for CSV import
-- assignedToId, startDate, and deadline can now be NULL

-- Make assignedToId optional
ALTER TABLE "tasks" ALTER COLUMN "assignedToId" DROP NOT NULL;

-- Make startDate optional
ALTER TABLE "tasks" ALTER COLUMN "startDate" DROP NOT NULL;

-- Make deadline optional
ALTER TABLE "tasks" ALTER COLUMN "deadline" DROP NOT NULL;
