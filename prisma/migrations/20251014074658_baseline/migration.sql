@'
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS public;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "public"."AnimalStatus" AS ENUM ('ACTIVE', 'BREEDING', 'UNAVAILABLE', 'RETIRED', 'DECEASED', 'PROSPECT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "public"."MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "public"."OwnerPartyType" AS ENUM ('Organization', 'Contact');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "public"."Sex" AS ENUM ('FEMALE', 'MALE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "public"."ShareScope" AS ENUM ('VIEW', 'BREED_PLAN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "public"."ShareStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "public"."Species" AS ENUM ('DOG', 'CAT', 'HORSE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "public"."TagModule" AS ENUM ('CONTACT', 'ORGANIZATION', 'ANIMAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "public"."TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'BILLING', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "public"."VerificationPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD', 'INVITE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "public"."Animal" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER,
    "name" TEXT NOT NULL,
    "species" "public"."Species" NOT NULL,
    "sex" "public"."Sex" NOT NULL,
    "status" "public"."AnimalStatus" NOT NULL DEFAULT 'ACTIVE',
    "birthDate" TIMESTAMP(3),
    "microchip" TEXT,
    "notes" TEXT,
    "breed" TEXT,
    "canonicalBreedId" INTEGER,
    "customBreedId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" INTEGER NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalOwner" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "partyType" "public"."OwnerPartyType" NOT NULL,
    "organizationId" INTEGER,
    "contactId" INTEGER,
    "percent" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalPublicListing" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "isListed" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT,
    "urlSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalPublicListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalRegistryIdentifier" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "registryId" INTEGER NOT NULL,
    "identifier" TEXT NOT NULL,
    "registrarOfRecord" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalRegistryIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalShare" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "fromTenantId" INTEGER NOT NULL,
    "toTenantId" INTEGER NOT NULL,
    "scope" "public"."ShareScope" NOT NULL DEFAULT 'VIEW',
    "status" "public"."ShareStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillingAccount" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "provider" TEXT,
    "customerId" TEXT,
    "subscriptionId" TEXT,
    "plan" TEXT,
    "status" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contact" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER,
    "display_name" TEXT NOT NULL,
    "email" CITEXT,
    "street" TEXT,
    "street2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" CHAR(2),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "phoneE164" VARCHAR(32),
    "whatsappE164" VARCHAR(32),
    "first_name" TEXT,
    "last_name" TEXT,
    "nickname" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomBreed" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "species" "public"."Species" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomBreed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "role" "public"."MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Membership" (
    "userId" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "role" "public"."MembershipRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId","organizationId")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "street" TEXT,
    "street2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" INTEGER NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Passkey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Registry" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "url" TEXT,
    "country" TEXT,
    "species" "public"."Species",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "module" "public"."TagModule" NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" INTEGER NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TagAssignment" (
    "id" SERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "organizationId" INTEGER,
    "animalId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "primaryEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TenantMembership" (
    "userId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "role" "public"."TenantRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("userId","tenantId")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "contactId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "defaultTenantId" INTEGER,
    "city" TEXT,
    "country" CHAR(2),
    "phoneE164" VARCHAR(32),
    "postalCode" TEXT,
    "state" TEXT,
    "street" TEXT,
    "street2" TEXT,
    "whatsappE164" VARCHAR(32),
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "passwordUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT,
    "expires" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purpose" "public"."VerificationPurpose" NOT NULL DEFAULT 'VERIFY_EMAIL',
    "tokenHash" TEXT NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","tokenHash")
);

-- CreateIndex
CREATE INDEX "Animal_archived_idx" ON "public"."Animal"("archived" ASC);

-- CreateIndex
CREATE INDEX "Animal_organizationId_idx" ON "public"."Animal"("organizationId" ASC);

-- CreateIndex
CREATE INDEX "Animal_species_idx" ON "public"."Animal"("species" ASC);

-- CreateIndex
CREATE INDEX "Animal_status_idx" ON "public"."Animal"("status" ASC);

-- CreateIndex
CREATE INDEX "Animal_tenantId_idx" ON "public"."Animal"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Animal_tenantId_microchip_key" ON "public"."Animal"("tenantId" ASC, "microchip" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalOwner_animalId_contactId_key" ON "public"."AnimalOwner"("animalId" ASC, "contactId" ASC);

-- CreateIndex
CREATE INDEX "AnimalOwner_animalId_idx" ON "public"."AnimalOwner"("animalId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalOwner_animalId_organizationId_key" ON "public"."AnimalOwner"("animalId" ASC, "organizationId" ASC);

-- CreateIndex
CREATE INDEX "AnimalOwner_contactId_idx" ON "public"."AnimalOwner"("contactId" ASC);

-- CreateIndex
CREATE INDEX "AnimalOwner_organizationId_idx" ON "public"."AnimalOwner"("organizationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalPublicListing_animalId_key" ON "public"."AnimalPublicListing"("animalId" ASC);

-- CreateIndex
CREATE INDEX "AnimalPublicListing_tenantId_idx" ON "public"."AnimalPublicListing"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalPublicListing_urlSlug_key" ON "public"."AnimalPublicListing"("urlSlug" ASC);

-- CreateIndex
CREATE INDEX "AnimalRegistryIdentifier_animalId_idx" ON "public"."AnimalRegistryIdentifier"("animalId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalRegistryIdentifier_registryId_identifier_key" ON "public"."AnimalRegistryIdentifier"("registryId" ASC, "identifier" ASC);

-- CreateIndex
CREATE INDEX "AnimalRegistryIdentifier_registryId_idx" ON "public"."AnimalRegistryIdentifier"("registryId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalShare_animalId_toTenantId_key" ON "public"."AnimalShare"("animalId" ASC, "toTenantId" ASC);

-- CreateIndex
CREATE INDEX "AnimalShare_fromTenantId_idx" ON "public"."AnimalShare"("fromTenantId" ASC);

-- CreateIndex
CREATE INDEX "AnimalShare_toTenantId_idx" ON "public"."AnimalShare"("toTenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_tenantId_key" ON "public"."BillingAccount"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "Contact_archived_idx" ON "public"."Contact"("archived" ASC);

-- CreateIndex
CREATE INDEX "Contact_display_name_idx" ON "public"."Contact"("display_name" ASC);

-- CreateIndex
CREATE INDEX "Contact_first_name_idx" ON "public"."Contact"("first_name" ASC);

-- CreateIndex
CREATE INDEX "Contact_last_name_idx" ON "public"."Contact"("last_name" ASC);

-- CreateIndex
CREATE INDEX "Contact_nickname_idx" ON "public"."Contact"("nickname" ASC);

-- CreateIndex
CREATE INDEX "Contact_organizationId_idx" ON "public"."Contact"("organizationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_tenantId_email_key" ON "public"."Contact"("tenantId" ASC, "email" ASC);

-- CreateIndex
CREATE INDEX "Contact_tenantId_idx" ON "public"."Contact"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "CustomBreed_organizationId_species_idx" ON "public"."CustomBreed"("organizationId" ASC, "species" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CustomBreed_organizationId_species_name_key" ON "public"."CustomBreed"("organizationId" ASC, "species" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "public"."Invitation"("email" ASC);

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "public"."Invitation"("organizationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "public"."Invitation"("token" ASC);

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "public"."Membership"("organizationId" ASC);

-- CreateIndex
CREATE INDEX "Organization_archived_idx" ON "public"."Organization"("archived" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_id_tenantId_key" ON "public"."Organization"("id" ASC, "tenantId" ASC);

-- CreateIndex
CREATE INDEX "Organization_name_idx" ON "public"."Organization"("name" ASC);

-- CreateIndex
CREATE INDEX "Organization_tenantId_idx" ON "public"."Organization"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_tenantId_name_key" ON "public"."Organization"("tenantId" ASC, "name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "public"."Passkey"("credentialId" ASC);

-- CreateIndex
CREATE INDEX "Passkey_userId_idx" ON "public"."Passkey"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCode_code_key" ON "public"."RecoveryCode"("code" ASC);

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_idx" ON "public"."RecoveryCode"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Registry_code_key" ON "public"."Registry"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken" ASC);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId" ASC);

-- CreateIndex
CREATE INDEX "Tag_tenantId_module_idx" ON "public"."Tag"("tenantId" ASC, "module" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_tenantId_module_name_key" ON "public"."Tag"("tenantId" ASC, "module" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "TagAssignment_animalId_idx" ON "public"."TagAssignment"("animalId" ASC);

-- CreateIndex
CREATE INDEX "TagAssignment_contactId_idx" ON "public"."TagAssignment"("contactId" ASC);

-- CreateIndex
CREATE INDEX "TagAssignment_organizationId_idx" ON "public"."TagAssignment"("organizationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_animalId_key" ON "public"."TagAssignment"("tagId" ASC, "animalId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_contactId_key" ON "public"."TagAssignment"("tagId" ASC, "contactId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_organizationId_key" ON "public"."TagAssignment"("tagId" ASC, "organizationId" ASC);

-- CreateIndex
CREATE INDEX "Tenant_name_idx" ON "public"."Tenant"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "public"."Tenant"("slug" ASC);

-- CreateIndex
CREATE INDEX "TenantMembership_tenantId_idx" ON "public"."TenantMembership"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "User_contactId_idx" ON "public"."User"("contactId" ASC);

-- CreateIndex
CREATE INDEX "User_country_idx" ON "public"."User"("country" ASC);

-- CreateIndex
CREATE INDEX "User_defaultTenantId_idx" ON "public"."User"("defaultTenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE INDEX "User_phoneE164_idx" ON "public"."User"("phoneE164" ASC);

-- CreateIndex
CREATE INDEX "User_whatsappE164_idx" ON "public"."User"("whatsappE164" ASC);

-- CreateIndex
CREATE INDEX "VerificationToken_identifier_purpose_idx" ON "public"."VerificationToken"("identifier" ASC, "purpose" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "public"."VerificationToken"("tokenHash" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token" ASC);

-- AddForeignKey
ALTER TABLE "public"."Animal" ADD CONSTRAINT "Animal_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "public"."Organization"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Animal" ADD CONSTRAINT "Animal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalOwner" ADD CONSTRAINT "AnimalOwner_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalOwner" ADD CONSTRAINT "AnimalOwner_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalOwner" ADD CONSTRAINT "AnimalOwner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalPublicListing" ADD CONSTRAINT "AnimalPublicListing_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalPublicListing" ADD CONSTRAINT "AnimalPublicListing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalRegistryIdentifier" ADD CONSTRAINT "AnimalRegistryIdentifier_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalRegistryIdentifier" ADD CONSTRAINT "AnimalRegistryIdentifier_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "public"."Registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalShare" ADD CONSTRAINT "AnimalShare_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalShare" ADD CONSTRAINT "AnimalShare_fromTenantId_fkey" FOREIGN KEY ("fromTenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalShare" ADD CONSTRAINT "AnimalShare_toTenantId_fkey" FOREIGN KEY ("toTenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingAccount" ADD CONSTRAINT "BillingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "public"."Organization"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomBreed" ADD CONSTRAINT "CustomBreed_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Organization" ADD CONSTRAINT "Organization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tag" ADD CONSTRAINT "Tag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagAssignment" ADD CONSTRAINT "TagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_defaultTenantId_fkey" FOREIGN KEY ("defaultTenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
'@ | Set-Content -Encoding UTF8 prisma/migrations/20251014074658_baseline/migration.sql
