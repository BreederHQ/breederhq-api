-- AlterTable
ALTER TABLE "AnimalPrivacySettings" ADD COLUMN     "showCompetitionDetails" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showCompetitions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showTitleDetails" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showTitles" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "AnimalTitle" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CompetitionEntry" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "AnimalTitle_isPublic_idx" ON "AnimalTitle"("isPublic");

-- CreateIndex
CREATE INDEX "CompetitionEntry_isPublic_idx" ON "CompetitionEntry"("isPublic");
