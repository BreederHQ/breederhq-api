/*
  Warnings:

  - Made the column `tenantId` on table `Animal` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Contact` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tenantId` on table `Organization` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Animal" DROP CONSTRAINT "Animal_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnimalOwner" DROP CONSTRAINT "AnimalOwner_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnimalPublicListing" DROP CONSTRAINT "AnimalPublicListing_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnimalPublicListing" DROP CONSTRAINT "AnimalPublicListing_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnimalRegistryIdentifier" DROP CONSTRAINT "AnimalRegistryIdentifier_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnimalRegistryIdentifier" DROP CONSTRAINT "AnimalRegistryIdentifier_registryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnimalShare" DROP CONSTRAINT "AnimalShare_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnimalShare" DROP CONSTRAINT "AnimalShare_fromTenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnimalShare" DROP CONSTRAINT "AnimalShare_toTenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BillingAccount" DROP CONSTRAINT "BillingAccount_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Contact" DROP CONSTRAINT "Contact_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomBreed" DROP CONSTRAINT "CustomBreed_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Invitation" DROP CONSTRAINT "Invitation_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Membership" DROP CONSTRAINT "Membership_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Membership" DROP CONSTRAINT "Membership_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Organization" DROP CONSTRAINT "Organization_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Passkey" DROP CONSTRAINT "Passkey_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RecoveryCode" DROP CONSTRAINT "RecoveryCode_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Tag" DROP CONSTRAINT "Tag_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TagAssignment" DROP CONSTRAINT "TagAssignment_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TagAssignment" DROP CONSTRAINT "TagAssignment_tagId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TenantMembership" DROP CONSTRAINT "TenantMembership_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TenantMembership" DROP CONSTRAINT "TenantMembership_userId_fkey";

-- DropIndex
DROP INDEX "public"."Animal_organizationId_microchip_key";

-- AlterTable
ALTER TABLE "Animal" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Contact" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "tenantId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalOwner" ADD CONSTRAINT "AnimalOwner_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalRegistryIdentifier" ADD CONSTRAINT "AnimalRegistryIdentifier_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalRegistryIdentifier" ADD CONSTRAINT "AnimalRegistryIdentifier_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "Registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalShare" ADD CONSTRAINT "AnimalShare_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalShare" ADD CONSTRAINT "AnimalShare_fromTenantId_fkey" FOREIGN KEY ("fromTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalShare" ADD CONSTRAINT "AnimalShare_toTenantId_fkey" FOREIGN KEY ("toTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPublicListing" ADD CONSTRAINT "AnimalPublicListing_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPublicListing" ADD CONSTRAINT "AnimalPublicListing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBreed" ADD CONSTRAINT "CustomBreed_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
