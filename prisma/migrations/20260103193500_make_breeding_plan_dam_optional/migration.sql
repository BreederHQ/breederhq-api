-- Make damId optional on BreedingPlan to support manually created groups without a known dam
ALTER TABLE "BreedingPlan" ALTER COLUMN "damId" DROP NOT NULL;
