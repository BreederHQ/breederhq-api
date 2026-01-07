-- CreateTable
CREATE TABLE "AnimalGenetics" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "testProvider" VARCHAR(255),
    "testDate" DATE,
    "testId" VARCHAR(255),
    "coatColorData" JSONB,
    "healthGeneticsData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalGenetics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalGenetics_animalId_key" ON "AnimalGenetics"("animalId");

-- CreateIndex
CREATE INDEX "AnimalGenetics_animalId_idx" ON "AnimalGenetics"("animalId");

-- AddForeignKey
ALTER TABLE "AnimalGenetics" ADD CONSTRAINT "AnimalGenetics_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
