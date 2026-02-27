-- migrate:up transaction:false
-- Add STILLBORN to OffspringLifeState enum.
-- Stillborn offspring are tracked individually in the Offspring tab with a distinct
-- status, and the litter statistics in FoalingOutcome are auto-derived from them.

ALTER TYPE "public"."OffspringLifeState" ADD VALUE IF NOT EXISTS 'STILLBORN';

-- migrate:down
-- PostgreSQL cannot remove enum values; this operation is one-way.
-- To fully revert, the type would need to be recreated (destructive — requires data migration).
