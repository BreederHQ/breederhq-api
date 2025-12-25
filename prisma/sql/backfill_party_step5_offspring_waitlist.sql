-- ============================================================================
-- Party Migration Step 5: Backfill Offspring and Waitlist Party References
-- ============================================================================
-- This script backfills partyId references from legacy contactId/organizationId
-- for WaitlistEntry, OffspringGroupBuyer, and Offspring models.
--
-- IMPORTANT: Run this script manually in pgAdmin or psql after schema is applied.
-- DO NOT run via Prisma migrate deploy - this is a data migration only.
--
-- Usage:
--   psql -h <host> -U <user> -d <database> -f backfill_party_step5_offspring_waitlist.sql
--
-- Safety:
--   - Idempotent: Only updates rows where partyId IS NULL
--   - Read-only for legacy columns: contactId/organizationId remain unchanged
--   - Reports conflicts and unresolved counts at the end
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. WaitlistEntry.clientPartyId
-- ============================================================================

-- Backfill from Contact
UPDATE "WaitlistEntry" AS w
SET "clientPartyId" = c."partyId"
FROM "Contact" c
WHERE w."clientPartyId" IS NULL
  AND w."contactId" = c.id
  AND w."contactId" IS NOT NULL
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization
UPDATE "WaitlistEntry" AS w
SET "clientPartyId" = o."partyId"
FROM "Organization" o
WHERE w."clientPartyId" IS NULL
  AND w."organizationId" = o.id
  AND w."organizationId" IS NOT NULL
  AND o."partyId" IS NOT NULL;

-- ============================================================================
-- 2. OffspringGroupBuyer.buyerPartyId
-- ============================================================================

-- Backfill from Contact
UPDATE "OffspringGroupBuyer" AS ogb
SET "buyerPartyId" = c."partyId"
FROM "Contact" c
WHERE ogb."buyerPartyId" IS NULL
  AND ogb."contactId" = c.id
  AND ogb."contactId" IS NOT NULL
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization
UPDATE "OffspringGroupBuyer" AS ogb
SET "buyerPartyId" = o."partyId"
FROM "Organization" o
WHERE ogb."buyerPartyId" IS NULL
  AND ogb."organizationId" = o.id
  AND ogb."organizationId" IS NOT NULL
  AND o."partyId" IS NOT NULL;

-- ============================================================================
-- 3. Offspring.buyerPartyId
-- ============================================================================

-- Backfill from Contact
UPDATE "Offspring" AS off
SET "buyerPartyId" = c."partyId"
FROM "Contact" c
WHERE off."buyerPartyId" IS NULL
  AND off."buyerContactId" = c.id
  AND off."buyerContactId" IS NOT NULL
  AND c."partyId" IS NOT NULL;

-- Backfill from Organization
UPDATE "Offspring" AS off
SET "buyerPartyId" = o."partyId"
FROM "Organization" o
WHERE off."buyerPartyId" IS NULL
  AND off."buyerOrganizationId" = o.id
  AND off."buyerOrganizationId" IS NOT NULL
  AND o."partyId" IS NOT NULL;

COMMIT;

-- ============================================================================
-- Summary Report
-- ============================================================================

\echo ''
\echo '======================================================================'
\echo 'Backfill Summary for Party Step 5: Offspring and Waitlist'
\echo '======================================================================'
\echo ''

-- WaitlistEntry metrics
\echo '--- WaitlistEntry ---'
SELECT
  COUNT(*) AS total_entries,
  COUNT("clientPartyId") AS entries_with_party,
  COUNT(*) - COUNT("clientPartyId") AS entries_without_party,
  COUNT(CASE WHEN "contactId" IS NOT NULL AND "organizationId" IS NOT NULL THEN 1 END) AS conflict_both_set,
  COUNT(CASE WHEN "contactId" IS NULL AND "organizationId" IS NULL THEN 1 END) AS entries_no_client
FROM "WaitlistEntry";

-- OffspringGroupBuyer metrics
\echo ''
\echo '--- OffspringGroupBuyer ---'
SELECT
  COUNT(*) AS total_buyers,
  COUNT("buyerPartyId") AS buyers_with_party,
  COUNT(*) - COUNT("buyerPartyId") AS buyers_without_party,
  COUNT(CASE WHEN "contactId" IS NOT NULL AND "organizationId" IS NOT NULL THEN 1 END) AS conflict_both_set,
  COUNT(CASE WHEN "contactId" IS NULL AND "organizationId" IS NULL AND "waitlistEntryId" IS NULL THEN 1 END) AS buyers_no_ref
FROM "OffspringGroupBuyer";

-- Offspring metrics
\echo ''
\echo '--- Offspring ---'
SELECT
  COUNT(*) AS total_offspring,
  COUNT("buyerPartyId") AS offspring_with_party,
  COUNT(*) - COUNT("buyerPartyId") AS offspring_without_party,
  COUNT(CASE WHEN "buyerContactId" IS NOT NULL AND "buyerOrganizationId" IS NOT NULL THEN 1 END) AS conflict_both_set,
  COUNT(CASE WHEN "buyerContactId" IS NULL AND "buyerOrganizationId" IS NULL THEN 1 END) AS offspring_no_buyer
FROM "Offspring";

\echo ''
\echo 'Backfill complete. Review counts above.'
\echo 'Conflicts (both contactId and organizationId set) were NOT modified.'
\echo '======================================================================'
