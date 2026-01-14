-- AlterTable
ALTER TABLE "public"."BreedingPlan" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BreedingPlan_deletedAt_idx" ON "public"."BreedingPlan"("deletedAt");
