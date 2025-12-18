-- AlterTable
ALTER TABLE "public"."Contact" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "archivedReason" TEXT;
