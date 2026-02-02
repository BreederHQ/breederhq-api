-- AlterTable
ALTER TABLE "public"."UserNotificationPreferences" ADD COLUMN     "geneticCarrierWarning" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "geneticIncomplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "geneticMissing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "geneticPrebreeding" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "geneticRecommended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "geneticRegistration" BOOLEAN NOT NULL DEFAULT true;
