-- ============================================================================
-- v2_post_import_fix.sql
-- Post-import fixes for v1 → v2 data-only migration
--
-- Run this AFTER importing v1 data into v2 database.
-- ============================================================================

-- ============================================================================
-- 1. DROP _prisma_migrations TABLE (v1 ARTIFACT)
-- ============================================================================
-- v1 had its own migration history that does not apply to v2.
-- Do NOT recreate this table - v2 will create its own when needed.

DROP TABLE IF EXISTS "_prisma_migrations";

-- ============================================================================
-- 2. RESET ALL SEQUENCES
-- ============================================================================
-- After data-only import, sequences are not updated to match imported data.
-- Reset each sequence to MAX(id) + 1 for its table.

DO $$
DECLARE
  seq_name text;
  table_name text;
  column_name text;
  max_val bigint;
  seq_record record;
BEGIN
  -- Iterate through all sequences in public schema
  FOR seq_record IN
    SELECT
      s.relname as sequence_name,
      t.relname as table_name,
      a.attname as column_name
    FROM pg_class s
    JOIN pg_namespace ns ON s.relnamespace = ns.oid
    JOIN pg_depend d ON d.objid = s.oid
    JOIN pg_class t ON d.refobjid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    WHERE s.relkind = 'S'
      AND ns.nspname = 'public'
      AND d.deptype = 'a'
    ORDER BY t.relname, a.attname
  LOOP
    -- Get max value from table
    EXECUTE format(
      'SELECT COALESCE(MAX(%I), 0) FROM %I',
      seq_record.column_name,
      seq_record.table_name
    ) INTO max_val;

    -- Reset sequence to max + 1
    IF max_val > 0 THEN
      EXECUTE format(
        'SELECT setval(pg_get_serial_sequence(%L, %L), %s)',
        seq_record.table_name,
        seq_record.column_name,
        max_val
      );
      RAISE NOTICE 'Reset sequence for %.%: setval to %',
        seq_record.table_name, seq_record.column_name, max_val;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 3. SET CONSTRAINTS IMMEDIATE
-- ============================================================================
-- Ensure all deferred constraints are checked immediately after import.
-- This catches any FK violations that might have been deferred during import.

SET CONSTRAINTS ALL IMMEDIATE;

-- ============================================================================
-- 4. SANITY CHECK: ORPHAN CONDITION COUNTS
-- ============================================================================
-- These queries return counts for orphan conditions.
-- They do NOT modify data - that is handled by validation step.
-- If any count > 0, you should investigate before proceeding.

-- 4a. Party references: rows with partyId pointing to non-existent Party rows
SELECT 'WaitlistEntry.clientPartyId' as check_name,
       COUNT(*) as orphan_count
FROM "WaitlistEntry" w
WHERE w."clientPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = w."clientPartyId");

SELECT 'OffspringGroupBuyer.buyerPartyId' as check_name,
       COUNT(*) as orphan_count
FROM "OffspringGroupBuyer" o
WHERE o."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = o."buyerPartyId");

SELECT 'Offspring.buyerPartyId' as check_name,
       COUNT(*) as orphan_count
FROM "Offspring" o
WHERE o."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = o."buyerPartyId");

SELECT 'Invoice.clientPartyId' as check_name,
       COUNT(*) as orphan_count
FROM "Invoice" i
WHERE i."clientPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = i."clientPartyId");

SELECT 'AnimalOwner.partyId' as check_name,
       COUNT(*) as orphan_count
FROM "AnimalOwner" ao
WHERE ao."partyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = ao."partyId");

SELECT 'PlanParty.partyId' as check_name,
       COUNT(*) as orphan_count
FROM "PlanParty" pp
WHERE pp."partyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = pp."partyId");

SELECT 'Animal.buyerPartyId' as check_name,
       COUNT(*) as orphan_count
FROM "Animal" a
WHERE a."buyerPartyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Party" p WHERE p.id = a."buyerPartyId");

-- 4b. Core FK integrity: tenantId references
SELECT 'Contact.tenantId' as check_name,
       COUNT(*) as orphan_count
FROM "Contact" c
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t.id = c."tenantId");

SELECT 'Organization.tenantId' as check_name,
       COUNT(*) as orphan_count
FROM "Organization" o
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t.id = o."tenantId");

SELECT 'Party.tenantId' as check_name,
       COUNT(*) as orphan_count
FROM "Party" p
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t.id = p."tenantId");

-- ============================================================================
-- END OF POST-IMPORT FIXES
-- ============================================================================
-- After running this script:
-- 1. Check the orphan counts above - all should be 0
-- 2. Run npm run db:v2:validate:dev or db:v2:validate:prod
-- 3. Run npm run db:v2:dev:status or db:v2:prod:status
-- ============================================================================
