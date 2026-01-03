-- DropIndex (IF EXISTS - may not exist depending on migration history)
DROP INDEX IF EXISTS "public"."SchedulingBooking_eventId_partyId_status_idx";

-- DropIndex (IF EXISTS - may not exist depending on migration history)
DROP INDEX IF EXISTS "public"."SchedulingSlot_blockId_status_startsAt_idx";

-- AlterTable
ALTER TABLE "OffspringGroup" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
