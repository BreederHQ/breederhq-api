-- AlterTable
ALTER TABLE "AnimalTitle" ADD COLUMN     "eventLocation" TEXT,
ADD COLUMN     "eventName" TEXT,
ADD COLUMN     "handlerName" TEXT;

-- AlterTable
ALTER TABLE "CompetitionEntry" ADD COLUMN     "distanceFurlongs" DOUBLE PRECISION,
ADD COLUMN     "distanceMeters" INTEGER,
ADD COLUMN     "finishTime" TEXT,
ADD COLUMN     "handlerName" TEXT,
ADD COLUMN     "prizeMoneyCents" INTEGER,
ADD COLUMN     "raceGrade" TEXT,
ADD COLUMN     "speedFigure" INTEGER,
ADD COLUMN     "trackName" TEXT,
ADD COLUMN     "trackSurface" TEXT,
ADD COLUMN     "trainerName" TEXT;
