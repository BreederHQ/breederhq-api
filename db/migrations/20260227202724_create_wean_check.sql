-- migrate:up
-- Creates the WeanCheck table for horse-specific foal weaning assessment records.
-- One record per breeding plan (UNIQUE constraint on breedingPlanId).
-- Stores weaning method, foal stress/adaptation, vet health checks, and nutrition transition.

CREATE TABLE "public"."WeanCheck" (
  "id" SERIAL PRIMARY KEY,
  "tenantId" integer NOT NULL,
  "breedingPlanId" integer NOT NULL,
  "weaningMethod" text,
  "stressRating" text,
  "behaviorSigns" text[] DEFAULT '{}',
  "daysToSettle" integer,
  "vetAssessmentDone" boolean,
  "vetName" text,
  "vetNotes" text,
  "vaccinationsUpToDate" boolean,
  "dewormingDone" boolean,
  "cogginsPulled" boolean,
  "eatingHayIndependently" boolean,
  "eatingGrainIndependently" boolean,
  "supplementStarted" text,
  "notes" text,
  "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "WeanCheck_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "WeanCheck_breedingPlanId_fkey"
    FOREIGN KEY ("breedingPlanId") REFERENCES "public"."BreedingPlan"(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "WeanCheck_breedingPlanId_key" UNIQUE ("breedingPlanId")
);

CREATE INDEX "WeanCheck_tenantId_idx"
  ON "public"."WeanCheck" USING btree ("tenantId");
CREATE INDEX "WeanCheck_breedingPlanId_idx"
  ON "public"."WeanCheck" USING btree ("breedingPlanId");

-- migrate:down
-- Removes the WeanCheck table. All foal wean check records will be permanently deleted.
DROP TABLE IF EXISTS "public"."WeanCheck";
