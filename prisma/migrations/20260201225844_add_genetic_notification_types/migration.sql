-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."NotificationType" ADD VALUE 'genetic_test_missing';
ALTER TYPE "public"."NotificationType" ADD VALUE 'genetic_test_incomplete';
ALTER TYPE "public"."NotificationType" ADD VALUE 'genetic_test_prebreeding';
ALTER TYPE "public"."NotificationType" ADD VALUE 'genetic_test_carrier_warning';
ALTER TYPE "public"."NotificationType" ADD VALUE 'genetic_test_registration';
ALTER TYPE "public"."NotificationType" ADD VALUE 'genetic_test_recommended';
