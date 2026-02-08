/*
  Warnings:

  - You are about to drop the `admin_action_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `listing_reports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AccountingIntegration` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AnimalShare` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BreedingPlanShare` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Invitation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LineageInfoRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Passkey` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecoveryCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Referral` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReferralCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SystemConfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."AccountingIntegration" DROP CONSTRAINT "AccountingIntegration_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnimalShare" DROP CONSTRAINT "AnimalShare_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnimalShare" DROP CONSTRAINT "AnimalShare_fromTenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnimalShare" DROP CONSTRAINT "AnimalShare_toTenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BreedingPlanShare" DROP CONSTRAINT "BreedingPlanShare_fromTenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BreedingPlanShare" DROP CONSTRAINT "BreedingPlanShare_planId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BreedingPlanShare" DROP CONSTRAINT "BreedingPlanShare_toTenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Invitation" DROP CONSTRAINT "Invitation_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LineageInfoRequest" DROP CONSTRAINT "LineageInfoRequest_requestingTenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LineageInfoRequest" DROP CONSTRAINT "LineageInfoRequest_requestingUserId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LineageInfoRequest" DROP CONSTRAINT "LineageInfoRequest_targetIdentityId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LineageInfoRequest" DROP CONSTRAINT "LineageInfoRequest_targetTenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Passkey" DROP CONSTRAINT "Passkey_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RecoveryCode" DROP CONSTRAINT "RecoveryCode_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Referral" DROP CONSTRAINT "Referral_codeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Referral" DROP CONSTRAINT "Referral_refereeTenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Referral" DROP CONSTRAINT "Referral_referrerTenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReferralCode" DROP CONSTRAINT "ReferralCode_referrerTenantId_fkey";

-- DropTable
DROP TABLE "marketplace"."admin_action_logs";

-- DropTable
DROP TABLE "marketplace"."listing_reports";

-- DropTable
DROP TABLE "public"."AccountingIntegration";

-- DropTable
DROP TABLE "public"."AnimalShare";

-- DropTable
DROP TABLE "public"."BreedingPlanShare";

-- DropTable
DROP TABLE "public"."Invitation";

-- DropTable
DROP TABLE "public"."LineageInfoRequest";

-- DropTable
DROP TABLE "public"."Passkey";

-- DropTable
DROP TABLE "public"."RecoveryCode";

-- DropTable
DROP TABLE "public"."Referral";

-- DropTable
DROP TABLE "public"."ReferralCode";

-- DropTable
DROP TABLE "public"."SystemConfig";

-- DropEnum
DROP TYPE "public"."LineageAccessLevel";

-- DropEnum
DROP TYPE "public"."LineageRequestStatus";
