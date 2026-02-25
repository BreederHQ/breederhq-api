-- migrate:up
-- Creates the FoalingCheck table to store timestamped physical sign observations
-- recorded by barn staff during foaling watch. Each check is a snapshot of the
-- mare's current signs (udder, vulva, tailhead, behavior) at a point in time.
-- These checks power the check history view and are dual-written to BreedingMilestone
-- to keep urgency scoring up to date.

CREATE TABLE "public"."FoalingCheck" (
  "id"                  SERIAL PRIMARY KEY,
  "tenantId"            integer NOT NULL,
  "breedingPlanId"      integer NOT NULL,
  "checkedAt"           timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedByUserId"     text,
  "udderDevelopment"    text NOT NULL DEFAULT 'none',
  "vulvaRelaxation"     text NOT NULL DEFAULT 'none',
  "tailHeadRelaxation"  text NOT NULL DEFAULT 'none',
  "temperature"         decimal(5,2),
  "behaviorNotes"       text[] NOT NULL DEFAULT '{}',
  "additionalNotes"     text,
  "foalingImminent"     boolean NOT NULL DEFAULT false,
  "createdAt"           timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt"           timestamp(3) without time zone NOT NULL,
  CONSTRAINT "FoalingCheck_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "FoalingCheck_breedingPlanId_fkey"
    FOREIGN KEY ("breedingPlanId") REFERENCES "public"."BreedingPlan"(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX "FoalingCheck_tenantId_idx"
  ON "public"."FoalingCheck" USING btree ("tenantId");
CREATE INDEX "FoalingCheck_breedingPlanId_idx"
  ON "public"."FoalingCheck" USING btree ("breedingPlanId");
CREATE INDEX "FoalingCheck_checkedAt_idx"
  ON "public"."FoalingCheck" USING btree ("checkedAt");

-- migrate:down
DROP TABLE IF EXISTS "public"."FoalingCheck";
