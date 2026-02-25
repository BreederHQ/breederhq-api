-- migrate:up
ALTER TABLE public."FoalingOutcome"
  ADD COLUMN "maternalRating" VARCHAR(20),
  ADD COLUMN "milkProduction" VARCHAR(20),
  ADD COLUMN "mastitisHistory" BOOLEAN NOT NULL DEFAULT false;

-- migrate:down
ALTER TABLE public."FoalingOutcome"
  DROP COLUMN IF EXISTS "maternalRating",
  DROP COLUMN IF EXISTS "milkProduction",
  DROP COLUMN IF EXISTS "mastitisHistory";
