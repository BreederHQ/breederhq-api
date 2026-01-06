-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WaitlistStatus" ADD VALUE 'APPROVED';
ALTER TYPE "WaitlistStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "WaitlistEntry" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedReason" TEXT;
