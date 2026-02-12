-- Add temperament genetics data column (behavioral genetics like serotonin transporter, dopamine receptor)
-- This is a non-destructive migration - only adds a new nullable column

ALTER TABLE "public"."AnimalGenetics" ADD COLUMN IF NOT EXISTS "temperamentData" JSONB;
