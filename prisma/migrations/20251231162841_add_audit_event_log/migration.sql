-- CreateEnum (safe to re-run with IF NOT EXISTS pattern)
DO $$ BEGIN
  CREATE TYPE "TenantMembershipRole" AS ENUM ('STAFF', 'CLIENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TenantMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AuditSurface" AS ENUM ('PLATFORM', 'PORTAL', 'MARKETPLACE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AuditActorContext" AS ENUM ('STAFF', 'CLIENT', 'PUBLIC');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable TenantMembership (idempotent)
ALTER TABLE "TenantMembership" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TenantMembership" ADD COLUMN IF NOT EXISTS "membershipRole" "TenantMembershipRole" NOT NULL DEFAULT 'STAFF';
ALTER TABLE "TenantMembership" ADD COLUMN IF NOT EXISTS "membershipStatus" "TenantMembershipStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "TenantMembership" ADD COLUMN IF NOT EXISTS "partyId" INTEGER;
ALTER TABLE "TenantMembership" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable AuditEvent
CREATE TABLE IF NOT EXISTS "AuditEvent" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" VARCHAR(64),
    "ip" VARCHAR(45),
    "userAgent" TEXT,
    "userId" VARCHAR(64),
    "surface" "AuditSurface" NOT NULL,
    "actorContext" "AuditActorContext",
    "tenantId" INTEGER,
    "action" VARCHAR(64) NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "detailJson" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "TenantMembership_partyId_idx" ON "TenantMembership"("partyId");
CREATE INDEX IF NOT EXISTS "TenantMembership_membershipRole_membershipStatus_idx" ON "TenantMembership"("membershipRole", "membershipStatus");
