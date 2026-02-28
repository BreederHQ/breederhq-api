-- migrate:up
-- Create ComplianceRequirement table for Client Health Portal compliance tracking (Phase 3)
-- Stores health guarantee requirements extracted from signed contracts

CREATE TABLE "public"."ComplianceRequirement" (
  "id" SERIAL PRIMARY KEY,
  "tenantId" integer NOT NULL,
  "offspringId" integer NOT NULL,
  "contractId" integer,
  "type" varchar(50) NOT NULL,
  "description" text NOT NULL,
  "dueBy" timestamptz,
  "reminderDays" integer[] NOT NULL DEFAULT '{30,7,1}',
  "lastReminderSentAt" timestamptz,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "fulfilledAt" timestamptz,
  "proofRecordId" integer,
  "verifiedByBreeder" boolean NOT NULL DEFAULT false,
  "verifiedAt" timestamptz,
  "verifiedBy" varchar(255),
  "rejectionReason" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "ComplianceRequirement_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ComplianceRequirement_offspringId_fkey"
    FOREIGN KEY ("offspringId") REFERENCES "public"."Offspring"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ComplianceRequirement_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id")
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "ComplianceRequirement_proofRecordId_fkey"
    FOREIGN KEY ("proofRecordId") REFERENCES "public"."ClientHealthRecord"("id")
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX "idx_compliance_requirement_tenant_offspring"
  ON "public"."ComplianceRequirement" USING btree ("tenantId", "offspringId");

CREATE INDEX "idx_compliance_requirement_status"
  ON "public"."ComplianceRequirement" USING btree ("status");

CREATE INDEX "idx_compliance_requirement_due"
  ON "public"."ComplianceRequirement" USING btree ("dueBy");

-- migrate:down
DROP TABLE IF EXISTS "public"."ComplianceRequirement";
