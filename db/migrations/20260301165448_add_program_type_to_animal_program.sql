-- migrate:up

-- Create enum for program types (breeding program focus areas)
CREATE TYPE public."ProgramType" AS ENUM (
  'COMPANION',
  'WORKING_SERVICE',
  'SPORT_COMPETITION',
  'GUN_DOG',
  'SHOW_CONFORMATION',
  'GENERAL'
);

ALTER TABLE public."mkt_listing_breeding_program"
  ADD COLUMN "programType" public."ProgramType" NOT NULL DEFAULT 'GENERAL';

COMMENT ON COLUMN public."mkt_listing_breeding_program"."programType" IS 'Primary focus of this breeding program. Determines which working-dog role recommendations are highlighted in temperament assessments.';

-- migrate:down

ALTER TABLE public."mkt_listing_breeding_program"
  DROP COLUMN IF EXISTS "programType";

DROP TYPE IF EXISTS public."ProgramType";
