-- Rename existing DB indexes/unique to what Prisma migration history expects
DO $$
BEGIN
  -- unique
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Tag_tenant_module_name_key'
  ) THEN
    ALTER INDEX "Tag_tenant_module_name_key" RENAME TO "Tag_tenantId_module_name_key";
  END IF;

  -- non-unique index
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Tag_tenant_module_idx'
  ) THEN
    ALTER INDEX "Tag_tenant_module_idx" RENAME TO "Tag_tenantId_module_idx";
  END IF;
END
$$;
