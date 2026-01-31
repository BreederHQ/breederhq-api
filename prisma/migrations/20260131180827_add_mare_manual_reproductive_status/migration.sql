-- AlterTable
ALTER TABLE "public"."MareReproductiveHistory" ADD COLUMN     "isBarren" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manualReproductiveStatus" TEXT;
