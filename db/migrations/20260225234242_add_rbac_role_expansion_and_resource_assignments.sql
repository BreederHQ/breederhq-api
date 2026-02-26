-- migrate:up transaction:false
-- RBAC Phase 1: Expand TenantRole enum + create ResourceAssignment table

-- Change 1: Add new role values to TenantRole enum
ALTER TYPE "public"."TenantRole" ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE "public"."TenantRole" ADD VALUE IF NOT EXISTS 'BREEDING_STAFF';
ALTER TYPE "public"."TenantRole" ADD VALUE IF NOT EXISTS 'BARN_STAFF';
ALTER TYPE "public"."TenantRole" ADD VALUE IF NOT EXISTS 'FINANCE';

-- Change 2: Create ResourceAssignment table
CREATE TABLE "public"."ResourceAssignment" (
  "id" SERIAL PRIMARY KEY,
  "tenantId" integer NOT NULL,
  "userId" text NOT NULL,
  "resourceType" text NOT NULL,
  "resourceId" integer NOT NULL,
  "assignmentRole" text NOT NULL,
  "assignedBy" text,
  "startDate" date,
  "endDate" date,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "ResourceAssignment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ResourceAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."User"(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ResourceAssignment_assignedBy_fkey"
    FOREIGN KEY ("assignedBy") REFERENCES "public"."User"(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "ResourceAssignment_unique_assignment"
    UNIQUE ("tenantId", "userId", "resourceType", "resourceId", "assignmentRole")
);

-- Indexes
CREATE INDEX "ResourceAssignment_tenantId_resourceType_resourceId_idx"
  ON "public"."ResourceAssignment" USING btree ("tenantId", "resourceType", "resourceId");
CREATE INDEX "ResourceAssignment_tenantId_userId_idx"
  ON "public"."ResourceAssignment" USING btree ("tenantId", "userId");

-- migrate:down
-- Note: PostgreSQL cannot remove enum values, so TenantRole changes are one-way
DROP TABLE IF EXISTS "public"."ResourceAssignment";
