-- ============================================================================
-- v2_post_import_checks.sql
-- Validation queries for v1 → v2 data-only migration
--
-- Run this AFTER importing v1 data and running v2_post_import_fix.sql.
-- Returns structured results for programmatic validation.
-- ============================================================================

-- ============================================================================
-- SECTION 1: TABLE ROW COUNTS
-- ============================================================================
-- Critical tables that should have data after import.
-- These are returned as a single result set for easy parsing.

SELECT 'table_counts' as section, jsonb_build_object(
  'Animal', (SELECT COUNT(*) FROM "Animal"),
  'Party', (SELECT COUNT(*) FROM "Party"),
  'Contact', (SELECT COUNT(*) FROM "Contact"),
  'Organization', (SELECT COUNT(*) FROM "Organization"),
  'OffspringGroup', (SELECT COUNT(*) FROM "OffspringGroup"),
  'Offspring', (SELECT COUNT(*) FROM "Offspring"),
  'BreedingPlan', (SELECT COUNT(*) FROM "BreedingPlan"),
  'Invoice', (SELECT COUNT(*) FROM "Invoice"),
  'Expense', (SELECT COUNT(*) FROM "Expense"),
  'User', (SELECT COUNT(*) FROM "User"),
  'Tenant', (SELECT COUNT(*) FROM "Tenant"),
  'WaitlistEntry', (SELECT COUNT(*) FROM "WaitlistEntry"),
  'AnimalOwner', (SELECT COUNT(*) FROM "AnimalOwner"),
  'PlanParty', (SELECT COUNT(*) FROM "PlanParty"),
  'OffspringGroupBuyer', (SELECT COUNT(*) FROM "OffspringGroupBuyer")
) as data;

-- ============================================================================
-- SECTION 2: ORPHAN CHECKS - PARTY RELATIONSHIPS
-- ============================================================================
-- These are the critical FK integrity checks.
-- All counts should be 0 for a successful import.

-- 2a. WaitlistEntry.clientPartyId → Party.id
SELECT 'orphan_check' as section, jsonb_build_object(
  'table', 'WaitlistEntry',
  'column', 'clientPartyId',
  'orphan_count', COUNT(*)
) as data
FROM "WaitlistEntry" w
WHERE w."clientPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = w."clientPartyId");

-- Sample query for investigation (LIMIT 25):
-- SELECT w.id, w."tenantId", w."clientPartyId"
-- FROM "WaitlistEntry" w
-- WHERE w."clientPartyId" IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = w."clientPartyId")
-- LIMIT 25;

-- 2b. OffspringGroupBuyer.buyerPartyId → Party.id
SELECT 'orphan_check' as section, jsonb_build_object(
  'table', 'OffspringGroupBuyer',
  'column', 'buyerPartyId',
  'orphan_count', COUNT(*)
) as data
FROM "OffspringGroupBuyer" o
WHERE o."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = o."buyerPartyId");

-- Sample query for investigation (LIMIT 25):
-- SELECT o.id, o."tenantId", o."groupId", o."buyerPartyId"
-- FROM "OffspringGroupBuyer" o
-- WHERE o."buyerPartyId" IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = o."buyerPartyId")
-- LIMIT 25;

-- 2c. AnimalOwner.partyId → Party.id
SELECT 'orphan_check' as section, jsonb_build_object(
  'table', 'AnimalOwner',
  'column', 'partyId',
  'orphan_count', COUNT(*)
) as data
FROM "AnimalOwner" ao
WHERE ao."partyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = ao."partyId");

-- Sample query for investigation (LIMIT 25):
-- SELECT ao.id, ao."animalId", ao."partyId", ao."percent"
-- FROM "AnimalOwner" ao
-- WHERE ao."partyId" IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = ao."partyId")
-- LIMIT 25;

-- ============================================================================
-- SECTION 3: ADDITIONAL PARTY ORPHAN CHECKS
-- ============================================================================

-- 3a. Offspring.buyerPartyId → Party.id
SELECT 'orphan_check' as section, jsonb_build_object(
  'table', 'Offspring',
  'column', 'buyerPartyId',
  'orphan_count', COUNT(*)
) as data
FROM "Offspring" o
WHERE o."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = o."buyerPartyId");

-- Sample query for investigation (LIMIT 25):
-- SELECT o.id, o."tenantId", o."groupId", o."buyerPartyId", o.name
-- FROM "Offspring" o
-- WHERE o."buyerPartyId" IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = o."buyerPartyId")
-- LIMIT 25;

-- 3b. Invoice.clientPartyId → Party.id
SELECT 'orphan_check' as section, jsonb_build_object(
  'table', 'Invoice',
  'column', 'clientPartyId',
  'orphan_count', COUNT(*)
) as data
FROM "Invoice" i
WHERE i."clientPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = i."clientPartyId");

-- Sample query for investigation (LIMIT 25):
-- SELECT i.id, i."tenantId", i."invoiceNumber", i."clientPartyId"
-- FROM "Invoice" i
-- WHERE i."clientPartyId" IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = i."clientPartyId")
-- LIMIT 25;

-- 3c. PlanParty.partyId → Party.id
SELECT 'orphan_check' as section, jsonb_build_object(
  'table', 'PlanParty',
  'column', 'partyId',
  'orphan_count', COUNT(*)
) as data
FROM "PlanParty" pp
WHERE pp."partyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = pp."partyId");

-- Sample query for investigation (LIMIT 25):
-- SELECT pp.id, pp."tenantId", pp."planId", pp."partyId", pp."role"
-- FROM "PlanParty" pp
-- WHERE pp."partyId" IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = pp."partyId")
-- LIMIT 25;

-- 3d. Animal.buyerPartyId → Party.id
SELECT 'orphan_check' as section, jsonb_build_object(
  'table', 'Animal',
  'column', 'buyerPartyId',
  'orphan_count', COUNT(*)
) as data
FROM "Animal" a
WHERE a."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = a."buyerPartyId");

-- Sample query for investigation (LIMIT 25):
-- SELECT a.id, a."tenantId", a.name, a."buyerPartyId"
-- FROM "Animal" a
-- WHERE a."buyerPartyId" IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = a."buyerPartyId")
-- LIMIT 25;

-- 3e. Expense.vendorPartyId → Party.id
SELECT 'orphan_check' as section, jsonb_build_object(
  'table', 'Expense',
  'column', 'vendorPartyId',
  'orphan_count', COUNT(*)
) as data
FROM "Expense" e
WHERE e."vendorPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = e."vendorPartyId");

-- Sample query for investigation (LIMIT 25):
-- SELECT e.id, e."tenantId", e."amountCents", e."vendorPartyId"
-- FROM "Expense" e
-- WHERE e."vendorPartyId" IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = e."vendorPartyId")
-- LIMIT 25;

-- ============================================================================
-- SECTION 4: CORE FK INTEGRITY (TENANT REFERENCES)
-- ============================================================================

-- 4a. Contact.tenantId → Tenant.id
SELECT 'orphan_check' as section, jsonb_build_object(
  'table', 'Contact',
  'column', 'tenantId',
  'orphan_count', COUNT(*)
) as data
FROM "Contact" c
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t.id = c."tenantId");

-- 4b. Organization.tenantId → Tenant.id
SELECT 'orphan_check' as section, jsonb_build_object(
  'table', 'Organization',
  'column', 'tenantId',
  'orphan_count', COUNT(*)
) as data
FROM "Organization" o
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t.id = o."tenantId");

-- 4c. Party.tenantId → Tenant.id
SELECT 'orphan_check' as section, jsonb_build_object(
  'table', 'Party',
  'column', 'tenantId',
  'orphan_count', COUNT(*)
) as data
FROM "Party" p
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t.id = p."tenantId");

-- 4d. Animal.tenantId → Tenant.id
SELECT 'orphan_check' as section, jsonb_build_object(
  'table', 'Animal',
  'column', 'tenantId',
  'orphan_count', COUNT(*)
) as data
FROM "Animal" a
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t.id = a."tenantId");

-- ============================================================================
-- SECTION 5: PARTY TYPE INTEGRITY
-- ============================================================================

-- 5a. Contact.partyId should point to Party with type='CONTACT'
SELECT 'type_mismatch' as section, jsonb_build_object(
  'table', 'Contact',
  'issue', 'partyId_type_mismatch',
  'count', COUNT(*)
) as data
FROM "Contact" c
JOIN "Party" p ON c."partyId" = p.id
WHERE c."partyId" IS NOT NULL
  AND p."type" != 'CONTACT';

-- 5b. Organization.partyId should point to Party with type='ORGANIZATION'
SELECT 'type_mismatch' as section, jsonb_build_object(
  'table', 'Organization',
  'issue', 'partyId_type_mismatch',
  'count', COUNT(*)
) as data
FROM "Organization" o
JOIN "Party" p ON o."partyId" = p.id
WHERE p."type" != 'ORGANIZATION';

-- ============================================================================
-- END OF VALIDATION CHECKS
-- ============================================================================
