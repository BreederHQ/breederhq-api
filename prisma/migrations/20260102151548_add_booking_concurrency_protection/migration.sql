-- Partial unique index to prevent concurrent CONFIRMED bookings for same (eventId, partyId)
-- This provides database-level concurrency protection that application-layer checks cannot guarantee

-- Drop the existing index if it was created manually before
DROP INDEX IF EXISTS "SchedulingBooking_eventId_partyId_confirmed_unique";

-- Create partial unique index: only one CONFIRMED booking per (eventId, partyId)
CREATE UNIQUE INDEX "SchedulingBooking_eventId_partyId_confirmed_unique"
ON "SchedulingBooking" ("eventId", "partyId")
WHERE status = 'CONFIRMED';

-- Add index on (blockId, startsAt) for efficient slot queries by block and time
-- This index helps staff endpoints list slots for a specific block ordered by time
CREATE INDEX IF NOT EXISTS "SchedulingSlot_blockId_status_startsAt_idx"
ON "SchedulingSlot" ("blockId", "status", "startsAt");

-- Add composite index for booking queries by event, party, and status
-- This optimizes the common query pattern: find booking for event+party with specific status
CREATE INDEX IF NOT EXISTS "SchedulingBooking_eventId_partyId_status_idx"
ON "SchedulingBooking" ("eventId", "partyId", "status");
