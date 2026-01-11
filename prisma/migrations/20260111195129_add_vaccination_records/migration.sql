-- CreateTable
CREATE TABLE "VaccinationRecord" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "protocolKey" VARCHAR(100) NOT NULL,
    "administeredAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "veterinarian" VARCHAR(255),
    "clinic" VARCHAR(255),
    "batchLotNumber" VARCHAR(100),
    "notes" TEXT,
    "documentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaccinationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaccinationRecord_tenantId_animalId_idx" ON "VaccinationRecord"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "VaccinationRecord_tenantId_protocolKey_idx" ON "VaccinationRecord"("tenantId", "protocolKey");

-- CreateIndex
CREATE INDEX "VaccinationRecord_animalId_protocolKey_idx" ON "VaccinationRecord"("animalId", "protocolKey");

-- CreateIndex
CREATE INDEX "VaccinationRecord_administeredAt_idx" ON "VaccinationRecord"("administeredAt");

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
