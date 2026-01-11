-- AlterTable
ALTER TABLE "MessageThread" ADD COLUMN     "originPagePath" TEXT,
ADD COLUMN     "originReferrer" TEXT,
ADD COLUMN     "originSource" TEXT,
ADD COLUMN     "originUtmCampaign" TEXT,
ADD COLUMN     "originUtmMedium" TEXT,
ADD COLUMN     "originUtmSource" TEXT;

-- AlterTable
ALTER TABLE "WaitlistEntry" ADD COLUMN     "originPagePath" TEXT,
ADD COLUMN     "originProgramSlug" TEXT,
ADD COLUMN     "originReferrer" TEXT,
ADD COLUMN     "originSource" TEXT,
ADD COLUMN     "originUtmCampaign" TEXT,
ADD COLUMN     "originUtmMedium" TEXT,
ADD COLUMN     "originUtmSource" TEXT;
