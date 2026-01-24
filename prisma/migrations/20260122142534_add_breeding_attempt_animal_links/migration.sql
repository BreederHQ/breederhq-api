-- DropForeignKey
ALTER TABLE "public"."BreedingAttempt" DROP CONSTRAINT "BreedingAttempt_planId_fkey";

-- AlterTable
ALTER TABLE "public"."BreedingAttempt" ADD COLUMN     "damId" INTEGER,
ADD COLUMN     "sireId" INTEGER,
ALTER COLUMN "planId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "BreedingAttempt_damId_idx" ON "public"."BreedingAttempt"("damId");

-- CreateIndex
CREATE INDEX "BreedingAttempt_sireId_idx" ON "public"."BreedingAttempt"("sireId");

-- AddForeignKey
ALTER TABLE "public"."BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_damId_fkey" FOREIGN KEY ("damId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
