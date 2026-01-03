-- DropIndex
DROP INDEX "public"."SchedulingBooking_eventId_partyId_status_idx";

-- DropIndex
DROP INDEX "public"."SchedulingSlot_blockId_status_startsAt_idx";

-- AlterTable
ALTER TABLE "OffspringGroup" ADD COLUMN     "archivedAt" TIMESTAMP(3);
