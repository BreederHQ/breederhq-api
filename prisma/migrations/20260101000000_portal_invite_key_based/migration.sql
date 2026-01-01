-- Migration: portal_invite_key_based
-- Changes PortalInvite to key-based model (tenantId, partyId, emailNorm)
-- Changes PortalAccess to include tenantId and membershipUserId

-- Step 1: Add new columns to PortalAccess
ALTER TABLE "PortalAccess" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "PortalAccess" ADD COLUMN "membershipUserId" TEXT;

-- Step 2: Backfill tenantId from Party.tenantId for existing records
UPDATE "PortalAccess" pa
SET "tenantId" = p."tenantId"
FROM "Party" p
WHERE pa."partyId" = p.id;

-- Step 3: Make tenantId NOT NULL after backfill
ALTER TABLE "PortalAccess" ALTER COLUMN "tenantId" SET NOT NULL;

-- Step 4: Drop old unique constraints on PortalAccess
DROP INDEX IF EXISTS "PortalAccess_partyId_key";
DROP INDEX IF EXISTS "PortalAccess_userId_key";

-- Step 5: Add new composite unique constraint on (tenantId, partyId)
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_tenantId_partyId_key" UNIQUE ("tenantId", "partyId");

-- Step 6: Add new index on tenantId
CREATE INDEX "PortalAccess_tenantId_idx" ON "PortalAccess"("tenantId");

-- Step 7: Add FK constraint for tenantId
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 8: Add new columns to PortalInvite
ALTER TABLE "PortalInvite" ADD COLUMN "tenantId" INTEGER;
ALTER TABLE "PortalInvite" ADD COLUMN "partyId" INTEGER;
ALTER TABLE "PortalInvite" ADD COLUMN "emailNorm" CITEXT;
ALTER TABLE "PortalInvite" ADD COLUMN "userId" TEXT;
ALTER TABLE "PortalInvite" ADD COLUMN "roleToGrant" "TenantMembershipRole" NOT NULL DEFAULT 'CLIENT';
ALTER TABLE "PortalInvite" ADD COLUMN "statusToGrant" "TenantMembershipStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "PortalInvite" ADD COLUMN "membershipUserId" TEXT;
ALTER TABLE "PortalInvite" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 9: Backfill PortalInvite from PortalAccess -> Party
UPDATE "PortalInvite" pi
SET
  "tenantId" = pa."tenantId",
  "partyId" = pa."partyId",
  "emailNorm" = LOWER(TRIM(COALESCE(p.email, '')))
FROM "PortalAccess" pa
JOIN "Party" p ON pa."partyId" = p.id
WHERE pi."portalAccessId" = pa.id;

-- Step 10: Make new columns NOT NULL after backfill (where applicable)
-- Note: For any PortalInvite without a valid portalAccessId, these will be NULL
-- We'll need to handle that case - for now, set defaults for orphans
UPDATE "PortalInvite" SET "tenantId" = 1, "partyId" = 1, "emailNorm" = 'unknown@example.com'
WHERE "tenantId" IS NULL;

ALTER TABLE "PortalInvite" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "PortalInvite" ALTER COLUMN "partyId" SET NOT NULL;
ALTER TABLE "PortalInvite" ALTER COLUMN "emailNorm" SET NOT NULL;

-- Step 11: Drop old FK and column from PortalInvite
ALTER TABLE "PortalInvite" DROP CONSTRAINT IF EXISTS "PortalInvite_portalAccessId_fkey";
DROP INDEX IF EXISTS "PortalInvite_portalAccessId_idx";
ALTER TABLE "PortalInvite" DROP COLUMN "portalAccessId";

-- Step 12: Add new FK constraints to PortalInvite
ALTER TABLE "PortalInvite" ADD CONSTRAINT "PortalInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalInvite" ADD CONSTRAINT "PortalInvite_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalInvite" ADD CONSTRAINT "PortalInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 13: Add new indexes to PortalInvite
CREATE INDEX "PortalInvite_tenantId_partyId_idx" ON "PortalInvite"("tenantId", "partyId");
CREATE INDEX "PortalInvite_tenantId_emailNorm_idx" ON "PortalInvite"("tenantId", "emailNorm");
