-- AlterTable
ALTER TABLE "public"."AnimalOwner" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "percent" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "public"."AnimalCycleDate" (
    "id" SERIAL NOT NULL,
    "animalId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalCycleDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalDocument" (
    "id" SERIAL NOT NULL,
    "animalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalCycleDate_animalId_startDate_idx" ON "public"."AnimalCycleDate"("animalId", "startDate");

-- CreateIndex
CREATE INDEX "AnimalDocument_animalId_idx" ON "public"."AnimalDocument"("animalId");

-- AddForeignKey
ALTER TABLE "public"."AnimalCycleDate" ADD CONSTRAINT "AnimalCycleDate_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalDocument" ADD CONSTRAINT "AnimalDocument_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
