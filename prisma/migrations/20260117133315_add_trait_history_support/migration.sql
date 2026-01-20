-- AlterTable
ALTER TABLE "public"."TraitDefinition" ADD COLUMN     "supportsHistory" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."AnimalTraitEntry" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "traitDefinitionId" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "performedBy" VARCHAR(255),
    "location" VARCHAR(255),
    "notes" TEXT,
    "documentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalTraitEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalTraitEntry_tenantId_animalId_idx" ON "public"."AnimalTraitEntry"("tenantId", "animalId");

-- CreateIndex
CREATE INDEX "AnimalTraitEntry_tenantId_animalId_traitDefinitionId_idx" ON "public"."AnimalTraitEntry"("tenantId", "animalId", "traitDefinitionId");

-- CreateIndex
CREATE INDEX "AnimalTraitEntry_tenantId_animalId_recordedAt_idx" ON "public"."AnimalTraitEntry"("tenantId", "animalId", "recordedAt");

-- AddForeignKey
ALTER TABLE "public"."AnimalTraitEntry" ADD CONSTRAINT "AnimalTraitEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalTraitEntry" ADD CONSTRAINT "AnimalTraitEntry_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalTraitEntry" ADD CONSTRAINT "AnimalTraitEntry_traitDefinitionId_fkey" FOREIGN KEY ("traitDefinitionId") REFERENCES "public"."TraitDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalTraitEntry" ADD CONSTRAINT "AnimalTraitEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
