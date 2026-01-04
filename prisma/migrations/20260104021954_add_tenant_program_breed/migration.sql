-- CreateTable
CREATE TABLE "TenantProgramBreed" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "species" "Species" NOT NULL,
    "breedId" INTEGER,
    "customBreedId" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantProgramBreed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantProgramBreed_tenantId_species_idx" ON "TenantProgramBreed"("tenantId", "species");

-- CreateIndex
CREATE UNIQUE INDEX "TenantProgramBreed_tenantId_breedId_key" ON "TenantProgramBreed"("tenantId", "breedId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantProgramBreed_tenantId_customBreedId_key" ON "TenantProgramBreed"("tenantId", "customBreedId");

-- AddForeignKey
ALTER TABLE "TenantProgramBreed" ADD CONSTRAINT "TenantProgramBreed_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProgramBreed" ADD CONSTRAINT "TenantProgramBreed_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProgramBreed" ADD CONSTRAINT "TenantProgramBreed_customBreedId_tenantId_fkey" FOREIGN KEY ("customBreedId", "tenantId") REFERENCES "CustomBreed"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
