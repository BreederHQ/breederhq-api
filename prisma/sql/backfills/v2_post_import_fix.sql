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
-- 2. RESET ALL SEQUENCES (pg_depend Ownership-Based)
-- ============================================================================
-- After data-only import, sequences are not updated to match imported data.
-- This uses pg_depend to discover sequence ownership via the dependency catalog,
-- which is the authoritative source for sequence-to-column relationships.
--
-- This approach:
-- - Works for any column name (not just 'id')
-- - Works if tables or sequences are renamed
-- - Is idempotent and safe to re-run
-- - Only resets sequences that are actually owned by table columns

DO $$
DECLARE
  seq_record record;
  max_val bigint;
  reset_count integer := 0;
  skip_count integer := 0;
BEGIN
  -- Use pg_depend with deptype='a' (auto dependency) to find sequences
  -- that are owned by table columns. This is the authoritative way to
  -- discover sequence ownership without relying on naming conventions.
  --
  -- We use seq.oid::regclass::text for the sequence name because regclass
  -- automatically provides the properly quoted identifier (e.g., "Animal_id_seq")
  -- which is required for setval() to work with PascalCase names.
  FOR seq_record IN
    SELECT
      seq.oid::regclass::text AS seq_name,
      d.refobjid::regclass::text AS table_name,
      a.attname AS column_name
    FROM pg_sequences s
    JOIN pg_class seq ON seq.relname = s.sequencename
    JOIN pg_namespace ns ON ns.oid = seq.relnamespace AND ns.nspname = s.schemaname
    JOIN pg_depend d ON d.objid = seq.oid AND d.deptype = 'a'
    JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
    WHERE s.schemaname = 'public'
    ORDER BY s.sequencename
  LOOP
    BEGIN
      -- Get max value from the owning column (using the actual column name)
      -- table_name from regclass is already properly quoted
      EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %s', seq_record.column_name, seq_record.table_name)
        INTO max_val;

      -- Reset sequence if there's data
      -- seq_name from regclass is already properly quoted for setval
      IF max_val > 0 THEN
        EXECUTE format('SELECT setval(%L::regclass, %s, true)', seq_record.seq_name, max_val);
        RAISE NOTICE 'Reset %: setval to % (table: %, column: %)',
          seq_record.seq_name, max_val, seq_record.table_name, seq_record.column_name;
        reset_count := reset_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log and skip on error (shouldn't happen with pg_depend-based discovery)
      RAISE NOTICE 'Skipped %: %', seq_record.seq_name, SQLERRM;
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
