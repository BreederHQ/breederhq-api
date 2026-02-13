-- CreateTable
CREATE TABLE "public"."NetworkSearchIndex" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "species" "public"."Species" NOT NULL,
    "sex" "public"."Sex" NOT NULL,
    "geneticTraits" JSONB NOT NULL,
    "physicalTraits" JSONB,
    "healthClearances" JSONB,
    "animalCount" INTEGER NOT NULL DEFAULT 1,
    "lastRebuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkSearchIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NetworkSearchIndex_species_sex_idx" ON "public"."NetworkSearchIndex"("species", "sex");

-- CreateIndex
CREATE INDEX "NetworkSearchIndex_tenantId_idx" ON "public"."NetworkSearchIndex"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkSearchIndex_tenantId_species_sex_key" ON "public"."NetworkSearchIndex"("tenantId", "species", "sex");

-- AddForeignKey
ALTER TABLE "public"."NetworkSearchIndex" ADD CONSTRAINT "NetworkSearchIndex_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
