/*
  Warnings:

  - You are about to drop the column `manualReproductiveStatus` on the `MareReproductiveHistory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Animal" ADD COLUMN     "breedingAvailability" TEXT;

-- AlterTable
ALTER TABLE "public"."MareReproductiveHistory" DROP COLUMN "manualReproductiveStatus";
