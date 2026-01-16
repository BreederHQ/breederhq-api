-- AlterTable
ALTER TABLE "public"."BreedingProgram" ADD COLUMN     "breedId" INTEGER,
ADD COLUMN     "comingSoon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "programStory" TEXT,
ADD COLUMN     "showCoverImage" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showWaitTime" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showWhatsIncluded" BOOLEAN NOT NULL DEFAULT true;
