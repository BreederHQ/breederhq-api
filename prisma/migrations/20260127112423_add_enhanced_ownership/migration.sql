-- CreateEnum
CREATE TYPE "public"."OwnerRole" AS ENUM ('SOLE_OWNER', 'CO_OWNER', 'MANAGING_PARTNER', 'SILENT_PARTNER', 'BREEDING_RIGHTS', 'INVESTOR');

-- AlterTable
ALTER TABLE "public"."AnimalOwner" ADD COLUMN     "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "receiveNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "role" "public"."OwnerRole" NOT NULL DEFAULT 'CO_OWNER';
