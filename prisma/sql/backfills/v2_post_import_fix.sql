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
-- 2. RESET ALL SEQUENCES (Discovery-Driven)
-- ============================================================================
-- After data-only import, sequences are not updated to match imported data.
-- This uses pg_sequences to discover all sequences, then resets each to MAX(col).
--
-- NOTE: Tables with UUID primary keys or non-serial IDs are automatically
-- skipped because they have no associated sequence.

DO $$
DECLARE
  seq_record record;
  max_val bigint;
  reset_count integer := 0;
  skip_count integer := 0;
BEGIN
  -- Iterate through all sequences in public schema that follow the naming
  -- convention TableName_columnName_seq (Prisma's default pattern)
  FOR seq_record IN
    SELECT
      s.sequencename AS seq_name,
      -- Extract table name by removing the _id_seq suffix
      -- This handles PascalCase table names correctly
      CASE
        WHEN s.sequencename LIKE '%_id_seq' THEN
          SUBSTRING(s.sequencename FROM 1 FOR LENGTH(s.sequencename) - 7)
        ELSE NULL
      END AS table_name
    FROM pg_sequences s
    WHERE s.schemaname = 'public'
      AND s.sequencename LIKE '%_id_seq'
    ORDER BY s.sequencename
  LOOP
    -- Skip if we couldn't parse the table name
    IF seq_record.table_name IS NULL THEN
      skip_count := skip_count + 1;
      CONTINUE;
    END IF;

    BEGIN
      -- Get max id value from the table
      EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I', seq_record.table_name)
        INTO max_val;

      -- Reset sequence if there's data
      IF max_val > 0 THEN
        -- Use setval with the sequence name directly (already properly cased)
        EXECUTE format('SELECT setval(%L, %s, true)', seq_record.seq_name, max_val);
        RAISE NOTICE 'Reset %: setval to %', seq_record.seq_name, max_val;
        reset_count := reset_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Table might not exist or have different column types - skip silently
      skip_count := skip_count + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Sequence reset complete: % reset, % skipped', reset_count, skip_count;
END $$;

-- ============================================================================
-- 3. DROP FK BACKUP TABLE (MIGRATION TOOLING RESIDUE)
-- ============================================================================
-- The _bhq_fk_backup table is created by v2_pre_import_drop_fks.sql to store
-- FK constraint definitions during import. After FKs are restored, this table
-- is no longer needed and should be removed to avoid Prisma schema drift.

DROP TABLE IF EXISTS "_bhq_fk_backup" CASCADE;

-- ============================================================================
-- 4. SET CONSTRAINTS IMMEDIATE
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
