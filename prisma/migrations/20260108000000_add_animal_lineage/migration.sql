-- Add lineage tracking fields to Animal
-- Enables pedigree visualization and COI (coefficient of inbreeding) calculations

-- AlterTable: Add parent references
ALTER TABLE "Animal" ADD COLUMN "damId" INTEGER;
ALTER TABLE "Animal" ADD COLUMN "sireId" INTEGER;

-- AlterTable: Add cached COI fields
ALTER TABLE "Animal" ADD COLUMN "coiPercent" DOUBLE PRECISION;
ALTER TABLE "Animal" ADD COLUMN "coiGenerations" INTEGER;
ALTER TABLE "Animal" ADD COLUMN "coiCalculatedAt" TIMESTAMP(3);

-- CreateIndex: Optimize parent lookups
CREATE INDEX "Animal_damId_idx" ON "Animal"("damId");
CREATE INDEX "Animal_sireId_idx" ON "Animal"("sireId");

-- AddForeignKey: Dam relationship (self-referential)
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Sire relationship (self-referential)
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
