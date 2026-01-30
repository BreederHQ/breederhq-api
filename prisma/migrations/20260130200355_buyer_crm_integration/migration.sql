-- AlterTable
ALTER TABLE "public"."BreedingPlanBuyer" ADD COLUMN     "buyerId" INTEGER;

-- AlterTable
ALTER TABLE "public"."OffspringGroupBuyer" ADD COLUMN     "buyerId" INTEGER;

-- AlterTable
ALTER TABLE "public"."WaitlistEntry" ADD COLUMN     "buyerId" INTEGER;

-- CreateIndex
CREATE INDEX "BreedingPlanBuyer_buyerId_idx" ON "public"."BreedingPlanBuyer"("buyerId");

-- CreateIndex
CREATE INDEX "OffspringGroupBuyer_buyerId_idx" ON "public"."OffspringGroupBuyer"("buyerId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_buyerId_idx" ON "public"."WaitlistEntry"("buyerId");

-- AddForeignKey
ALTER TABLE "public"."BreedingPlanBuyer" ADD CONSTRAINT "BreedingPlanBuyer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OffspringGroupBuyer" ADD CONSTRAINT "OffspringGroupBuyer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
