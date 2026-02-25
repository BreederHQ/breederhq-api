-- migrate:up transaction:false
-- Add new breeding method enum values for species-specific breeding support.
-- Existing values (NATURAL, AI_TCI, AI_SI, AI_FROZEN) remain unchanged.
-- New values: AI_VAGINAL (dogs/cats/goats/sheep/rabbits), AI_SURGICAL (dogs),
--             AI_LAPAROSCOPIC (goats/sheep), EMBRYO_TRANSFER (horses/goats/sheep).

ALTER TYPE "public"."BreedingMethod" ADD VALUE IF NOT EXISTS 'AI_VAGINAL';
ALTER TYPE "public"."BreedingMethod" ADD VALUE IF NOT EXISTS 'AI_SURGICAL';
ALTER TYPE "public"."BreedingMethod" ADD VALUE IF NOT EXISTS 'AI_LAPAROSCOPIC';
ALTER TYPE "public"."BreedingMethod" ADD VALUE IF NOT EXISTS 'EMBRYO_TRANSFER';

-- migrate:down
-- PostgreSQL does not support removing enum values. These additions are
-- backward-compatible and safe to leave in place.
