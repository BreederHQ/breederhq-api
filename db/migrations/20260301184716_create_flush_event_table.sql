-- migrate:up
-- Create FlushEvent table for tracking embryo flush/recovery procedures.
-- A flush event represents a single veterinary procedure where embryos are
-- recovered from a donor female. For MOET (goat/sheep), one flush can yield
-- 5-15+ embryos going to multiple recipients (= multiple breeding plans).

CREATE TABLE "public"."FlushEvent" (
  "id" SERIAL PRIMARY KEY,
  "tenantId" integer NOT NULL,
  "geneticDamId" integer NOT NULL,
  "sireId" integer,
  "flushDate" timestamp(3) without time zone NOT NULL,
  "embryosRecovered" integer,
  "embryosViable" integer,
  "embryoGrades" jsonb,
  "embryoType" text,
  "vetName" text,
  "location" text,
  "notes" text,
  "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "FlushEvent_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "FlushEvent_geneticDamId_fkey"
    FOREIGN KEY ("geneticDamId") REFERENCES "public"."Animal"(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "FlushEvent_sireId_fkey"
    FOREIGN KEY ("sireId") REFERENCES "public"."Animal"(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "FlushEvent_embryoType_check"
    CHECK ("embryoType" IN ('FRESH', 'FROZEN'))
);

CREATE INDEX "FlushEvent_tenantId_idx"
  ON "public"."FlushEvent" USING btree ("tenantId");
CREATE INDEX "FlushEvent_geneticDamId_idx"
  ON "public"."FlushEvent" USING btree ("geneticDamId");
CREATE INDEX "FlushEvent_flushDate_idx"
  ON "public"."FlushEvent" USING btree ("flushDate");

-- Link breeding plans to flush events
ALTER TABLE "public"."BreedingPlan"
  ADD COLUMN "flushEventId" integer;

ALTER TABLE "public"."BreedingPlan"
  ADD CONSTRAINT "BreedingPlan_flushEventId_fkey"
    FOREIGN KEY ("flushEventId") REFERENCES "public"."FlushEvent"(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX "BreedingPlan_flushEventId_idx"
  ON "public"."BreedingPlan" USING btree ("flushEventId");

-- migrate:down
ALTER TABLE "public"."BreedingPlan"
  DROP CONSTRAINT IF EXISTS "BreedingPlan_flushEventId_fkey";
ALTER TABLE "public"."BreedingPlan"
  DROP COLUMN IF EXISTS "flushEventId";
DROP TABLE IF EXISTS "public"."FlushEvent";
