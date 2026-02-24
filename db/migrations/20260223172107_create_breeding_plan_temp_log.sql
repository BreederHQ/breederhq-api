-- migrate:up
-- Pre-labor temperature log for breeding plans.
-- Tracks serial dam temperature readings to detect the characteristic
-- temperature drop that signals imminent labor (dogs/cats).

CREATE TABLE "public"."BreedingPlanTempLog" (
  "id" SERIAL PRIMARY KEY,
  "planId" integer NOT NULL,
  "tenantId" integer NOT NULL,
  "recordedAt" timestamp(3) with time zone NOT NULL,
  "temperatureF" decimal(5,2) NOT NULL,
  "notes" text,
  "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "BreedingPlanTempLog_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "public"."BreedingPlan"("id")
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "BreedingPlanTempLog_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX "BreedingPlanTempLog_planId_idx"
  ON "public"."BreedingPlanTempLog" USING btree ("planId");
CREATE INDEX "BreedingPlanTempLog_tenantId_idx"
  ON "public"."BreedingPlanTempLog" USING btree ("tenantId");

-- migrate:down
DROP TABLE IF EXISTS "public"."BreedingPlanTempLog";
