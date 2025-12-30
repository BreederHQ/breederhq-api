-- CreateTable
CREATE TABLE "Breed" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedRegistryLink" (
    "breedId" INTEGER NOT NULL,
    "registryId" INTEGER NOT NULL,
    "statusText" TEXT,
    "registryRef" TEXT,
    "url" TEXT,
    "primary" BOOLEAN,
    "since" INTEGER,
    "notes" TEXT,
    "proofUrl" TEXT,

    CONSTRAINT "BreedRegistryLink_pkey" PRIMARY KEY ("breedId","registryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Breed_name_key" ON "Breed"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Breed_slug_key" ON "Breed"("slug");

-- CreateIndex
CREATE INDEX "Breed_species_idx" ON "Breed"("species");

-- CreateIndex
CREATE INDEX "BreedRegistryLink_registryId_idx" ON "BreedRegistryLink"("registryId");

-- CreateIndex
CREATE INDEX "Animal_canonicalBreedId_idx" ON "Animal"("canonicalBreedId");

-- CreateIndex
CREATE INDEX "Animal_customBreedId_idx" ON "Animal"("customBreedId");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_canonicalBreedId_fkey" FOREIGN KEY ("canonicalBreedId") REFERENCES "Breed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_customBreedId_fkey" FOREIGN KEY ("customBreedId") REFERENCES "CustomBreed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedRegistryLink" ADD CONSTRAINT "BreedRegistryLink_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedRegistryLink" ADD CONSTRAINT "BreedRegistryLink_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "Registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

