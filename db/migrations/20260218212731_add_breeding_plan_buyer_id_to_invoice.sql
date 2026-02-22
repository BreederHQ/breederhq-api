-- migrate:up
-- Link an Invoice directly to a specific BreedingPlanBuyer (1:1 optional).
-- This is NOT a new anchor — it's a reference field used to track which
-- deposit invoice belongs to which assigned buyer within a breeding plan.
-- Allows the buyers tab to show per-buyer invoice status without compound queries.

ALTER TABLE public."Invoice"
  ADD COLUMN "breedingPlanBuyerId" integer;

ALTER TABLE public."Invoice"
  ADD CONSTRAINT "Invoice_breedingPlanBuyerId_fkey"
    FOREIGN KEY ("breedingPlanBuyerId")
    REFERENCES public."BreedingPlanBuyer"(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public."Invoice"
  ADD CONSTRAINT "Invoice_breedingPlanBuyerId_key"
    UNIQUE ("breedingPlanBuyerId");

CREATE INDEX "Invoice_breedingPlanBuyerId_idx"
  ON public."Invoice" USING btree ("breedingPlanBuyerId");

-- migrate:down
-- Remove the breedingPlanBuyerId link from Invoice

DROP INDEX IF EXISTS "Invoice_breedingPlanBuyerId_idx";

ALTER TABLE public."Invoice"
  DROP CONSTRAINT IF EXISTS "Invoice_breedingPlanBuyerId_key";

ALTER TABLE public."Invoice"
  DROP CONSTRAINT IF EXISTS "Invoice_breedingPlanBuyerId_fkey";

ALTER TABLE public."Invoice"
  DROP COLUMN IF EXISTS "breedingPlanBuyerId";
