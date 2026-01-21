-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."MilestoneType" ADD VALUE 'UDDER_DEVELOPMENT';
ALTER TYPE "public"."MilestoneType" ADD VALUE 'UDDER_FULL';
ALTER TYPE "public"."MilestoneType" ADD VALUE 'WAX_APPEARANCE';
ALTER TYPE "public"."MilestoneType" ADD VALUE 'VULVAR_RELAXATION';
ALTER TYPE "public"."MilestoneType" ADD VALUE 'TAILHEAD_RELAXATION';
ALTER TYPE "public"."MilestoneType" ADD VALUE 'MILK_CALCIUM_TEST';
