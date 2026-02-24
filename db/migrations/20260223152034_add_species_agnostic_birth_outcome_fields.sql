-- migrate:up
-- Add species-agnostic birth outcome fields to FoalingOutcome table.
-- These columns support C-section tracking, litter statistics, and dam recovery
-- notes for all species (not just horses).

ALTER TABLE "public"."FoalingOutcome"
  ADD COLUMN "wasCSection" boolean NOT NULL DEFAULT false,
  ADD COLUMN "cSectionReason" text,
  ADD COLUMN "placentaCount" integer,
  ADD COLUMN "damRecoveryNotes" text,
  ADD COLUMN "totalBorn" integer,
  ADD COLUMN "bornAlive" integer,
  ADD COLUMN "stillborn" integer;

-- migrate:down
-- Remove species-agnostic birth outcome fields

ALTER TABLE "public"."FoalingOutcome"
  DROP COLUMN IF EXISTS "wasCSection",
  DROP COLUMN IF EXISTS "cSectionReason",
  DROP COLUMN IF EXISTS "placentaCount",
  DROP COLUMN IF EXISTS "damRecoveryNotes",
  DROP COLUMN IF EXISTS "totalBorn",
  DROP COLUMN IF EXISTS "bornAlive",
  DROP COLUMN IF EXISTS "stillborn";
