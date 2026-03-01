-- migrate:up
-- Add buyerVisible flag so breeders can control which assessments are shared with buyers in the client portal
ALTER TABLE public."AssessmentResult"
  ADD COLUMN "buyerVisible" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public."AssessmentResult"."buyerVisible" IS 'Whether this assessment result is visible to the buyer in the client portal';

-- migrate:down
ALTER TABLE public."AssessmentResult"
  DROP COLUMN IF EXISTS "buyerVisible";
