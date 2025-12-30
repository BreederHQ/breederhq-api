-- Party Migration Step 5: Attachment Party Linkage
-- This migration adds partyId-based linkage for Attachments
-- Schema changes are additive only; legacy columns remain intact

-- ============================================================================
-- SCHEMA CHANGES
-- ============================================================================

-- Add attachmentPartyId column to Attachment table
ALTER TABLE "Attachment" ADD COLUMN "attachmentPartyId" INTEGER;

-- Add foreign key constraint to Party table
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_attachmentPartyId_fkey"
  FOREIGN KEY ("attachmentPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for performance
CREATE INDEX "Attachment_attachmentPartyId_idx" ON "Attachment"("attachmentPartyId");

-- ============================================================================
-- DATA BACKFILL
-- ============================================================================

-- Backfill attachmentPartyId from contactId
-- Only update rows where attachmentPartyId is null and contactId is present
UPDATE "Attachment" AS a
SET "attachmentPartyId" = c."partyId"
FROM "Contact" AS c
WHERE a."contactId" = c."id"
  AND a."attachmentPartyId" IS NULL
  AND c."partyId" IS NOT NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verification Query 1: Count of attachments backfilled from contactId
-- Run this to verify backfill success:
-- SELECT COUNT(*) AS backfilled_from_contact
-- FROM "Attachment" a
-- INNER JOIN "Contact" c ON a."contactId" = c."id"
-- WHERE a."attachmentPartyId" = c."partyId";

-- Verification Query 2: Count of attachments with contactId but no partyId
-- This should be 0 if all contacts have been migrated to Party:
-- SELECT COUNT(*) AS missing_party_id
-- FROM "Attachment" a
-- INNER JOIN "Contact" c ON a."contactId" = c."id"
-- WHERE a."attachmentPartyId" IS NULL;

-- Verification Query 3: Count of attachments still null after backfill
-- These are attachments not linked to contacts:
-- SELECT COUNT(*) AS null_attachment_party_id
-- FROM "Attachment"
-- WHERE "attachmentPartyId" IS NULL;

-- Verification Query 4: Detect any conflicts or inconsistencies
-- This should return 0 rows:
-- SELECT a."id", a."contactId", a."attachmentPartyId", c."partyId"
-- FROM "Attachment" a
-- INNER JOIN "Contact" c ON a."contactId" = c."id"
-- WHERE a."attachmentPartyId" IS NOT NULL
--   AND a."attachmentPartyId" != c."partyId";
