-- migrate:up
-- Add buyer preference rankings table for pick sheets.
-- Each buyer can rank offspring by preference (1 = most preferred).

CREATE TABLE "public"."BreedingPlanBuyerPreference" (
  "id" SERIAL PRIMARY KEY,
  "planBuyerId" integer NOT NULL,
  "offspringId" integer NOT NULL,
  "rank" integer NOT NULL,
  "notes" text,
  "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "BreedingPlanBuyerPreference_planBuyerId_fkey"
    FOREIGN KEY ("planBuyerId") REFERENCES "public"."BreedingPlanBuyer"(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "BreedingPlanBuyerPreference_offspringId_fkey"
    FOREIGN KEY ("offspringId") REFERENCES "public"."Offspring"(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- One ranking per buyer per offspring
ALTER TABLE "public"."BreedingPlanBuyerPreference"
  ADD CONSTRAINT "BreedingPlanBuyerPreference_planBuyerId_offspringId_key"
  UNIQUE ("planBuyerId", "offspringId");

-- No duplicate ranks per buyer
ALTER TABLE "public"."BreedingPlanBuyerPreference"
  ADD CONSTRAINT "BreedingPlanBuyerPreference_planBuyerId_rank_key"
  UNIQUE ("planBuyerId", "rank");

-- Index for buyer lookups
CREATE INDEX "BreedingPlanBuyerPreference_planBuyerId_idx"
  ON "public"."BreedingPlanBuyerPreference" USING btree ("planBuyerId");

-- Index for offspring lookups
CREATE INDEX "BreedingPlanBuyerPreference_offspringId_idx"
  ON "public"."BreedingPlanBuyerPreference" USING btree ("offspringId");

-- migrate:down
DROP TABLE IF EXISTS "public"."BreedingPlanBuyerPreference";
