-- v2_post_import_restore_fks.sql
-- Restores all FK constraints after data import.
-- Reads from _bhq_fk_backup table created by v2_pre_import_drop_fks.sql.
--
-- If any constraint fails to restore, the script stops with an error.
-- The _bhq_fk_backup table is left in place for debugging.

-- Check backup table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_bhq_fk_backup'
  ) THEN
    RAISE EXCEPTION '_bhq_fk_backup table not found. Run v2_pre_import_drop_fks.sql first.';
  END IF;
END $$;

-- Report what we're about to restore
DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count FROM _bhq_fk_backup;
  RAISE NOTICE 'Restoring % FK constraints...', fk_count;
END $$;

-- Dynamically restore all FK constraints
-- ON_ERROR_STOP=1 in psql will cause this to fail on first error
-- Note: relname is already quoted by regclass::text, so use %s not %I
DO $$
DECLARE
  r RECORD;
  add_sql TEXT;
  restored_count INTEGER := 0;
BEGIN
  FOR r IN SELECT conname, relname, condef FROM _bhq_fk_backup ORDER BY relname, conname
  LOOP
    -- Safety: skip null relnames (should not happen)
    IF r.relname IS NULL THEN
      RAISE NOTICE 'Skipping constraint % with NULL relname', r.conname;
      CONTINUE;
    END IF;

    -- relname from regclass::text is already properly quoted/schema-qualified
    -- conname needs %I quoting, condef is a constraint definition (use %s)
    add_sql := format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.relname, r.conname, r.condef);
    RAISE NOTICE 'Restoring: %.%', r.relname, r.conname;
    EXECUTE add_sql;
    restored_count := restored_count + 1;
  END LOOP;

  RAISE NOTICE 'Successfully restored % FK constraints.', restored_count;
END $$;

-- Verify all FKs were restored by comparing counts
DO $$
DECLARE
  backup_count INTEGER;
  current_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backup_count FROM _bhq_fk_backup;

  SELECT COUNT(*) INTO current_count
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  IF current_count < backup_count THEN
    RAISE EXCEPTION 'FK restoration incomplete: expected %, got %', backup_count, current_count;
  END IF;

  RAISE NOTICE 'FK constraint count verified: % constraints in place.', current_count;
END $$;
