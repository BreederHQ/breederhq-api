-- AlterTable
ALTER TABLE "public"."AnimalGenetics" ADD COLUMN     "breedComposition" JSONB,
ADD COLUMN     "coi" JSONB,
ADD COLUMN     "lifeStage" VARCHAR(100),
ADD COLUMN     "lineage" JSONB,
ADD COLUMN     "mhcDiversity" JSONB,
ADD COLUMN     "predictedAdultWeight" JSONB;
