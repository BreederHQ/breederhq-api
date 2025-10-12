-- Bring migrations history in line with the current DB where Tag is tenant-scoped.
-- Safe to run on either old (org-scoped) or new (tenant-scoped) Tag tables.

DO $$
BEGIN
  -- Only run the transition if the old column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Tag'
      AND column_name = 'organizationId'
  ) THEN
    -- 1) Add tenantId if not present
    ALTER TABLE "Tag"
      ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;

    -- 2) Backfill tenantId from Organization.tenantId
    UPDATE "Tag" t
      SET "tenantId" = o."tenantId"
    FROM "Organization" o
    WHERE t."organizationId" = o."id"
      AND (t."tenantId" IS NULL);

    -- 3) Enforce NOT NULL (after backfill)
    ALTER TABLE "Tag"
      ALTER COLUMN "tenantId" SET NOT NULL;

    -- 4) Ensure FK to Tenant
    DO $inner$
    BEGIN
      BEGIN
        ALTER TABLE "Tag"
          ADD CONSTRAINT "Tag_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN
          -- FK already exists
          NULL;
      END;
    END
    $inner$;

    -- 5) Drop the old column (removes old FKs/indexes)
    ALTER TABLE "Tag" DROP COLUMN IF EXISTS "organizationId" CASCADE;
  END IF;
END
$$;

-- Ensure the new tenant-scoped indexes/uniques exist (safe if already present)
CREATE INDEX IF NOT EXISTS "Tag_tenantId_module_idx"
  ON "Tag" ("tenantId", "module");

CREATE UNIQUE INDEX IF NOT EXISTS "Tag_tenantId_module_name_key"
  ON "Tag" ("tenantId", "module", "name");
