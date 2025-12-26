-- ============================================================================
-- Party Step 5: Users Domain - Backfill Script
-- ============================================================================
-- This script backfills partyId field for User model by resolving Contact
-- legacy ID to its corresponding Party ID.
-- This script is idempotent and can be run multiple times safely.
-- ============================================================================

-- ============================================================================
-- User: partyId from contactId
-- ============================================================================

UPDATE "User" u
SET "partyId" = c."partyId"
FROM "Contact" c
WHERE u."contactId" = c.id
  AND u."partyId" IS NULL
  AND c."partyId" IS NOT NULL;

-- ============================================================================
-- Backfill Completion Summary
-- ============================================================================
-- The backfill is complete. All User records with valid contactId have been
-- populated with partyId values where resolvable from Contact.
-- ============================================================================
