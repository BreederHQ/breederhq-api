-- AlterTable
-- Add femaleCycleLenOverrideDays column to Animal table
-- Cycle Length Override v1: Animal-level override for female cycle length calculation
-- Valid range: 30-730 days (enforced at API layer). NULL means use automatic calculation.
ALTER TABLE "Animal" ADD COLUMN "femaleCycleLenOverrideDays" INTEGER;
