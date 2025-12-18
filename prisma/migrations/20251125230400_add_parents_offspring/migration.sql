-- AlterTable
ALTER TABLE "Offspring" ADD COLUMN     "damId" INTEGER,
ADD COLUMN     "sireId" INTEGER;

-- CreateIndex
CREATE INDEX "Offspring_tenantId_damId_idx" ON "Offspring"("tenantId", "damId");

-- CreateIndex
CREATE INDEX "Offspring_tenantId_sireId_idx" ON "Offspring"("tenantId", "sireId");

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offspring" ADD CONSTRAINT "Offspring_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
