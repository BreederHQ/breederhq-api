-- CreateEnum
CREATE TYPE "BreedingListingIntent" AS ENUM ('OFFERING', 'SEEKING', 'LEASE', 'ARRANGEMENT');

-- CreateEnum
CREATE TYPE "BreedingListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BreedingListingFeeDirection" AS ENUM ('I_RECEIVE', 'I_PAY', 'SPLIT', 'NEGOTIABLE');

-- CreateEnum
CREATE TYPE "BreedingInquiryStatus" AS ENUM ('NEW', 'READ', 'REPLIED', 'CONVERTED', 'ARCHIVED', 'SPAM');

-- CreateEnum
CREATE TYPE "BreedingBookingStatus" AS ENUM ('INQUIRY', 'PENDING_REQUIREMENTS', 'APPROVED', 'DEPOSIT_PAID', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BreedingBookingType" AS ENUM ('STUD_SERVICE', 'LEASE_BREEDING', 'CO_OWN', 'AI_SHIPPED', 'NATURAL_COVER');

-- CreateEnum
CREATE TYPE "BreedingProgramStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "lineDescription" TEXT,
ADD COLUMN     "lineTypes" TEXT[],
ADD COLUMN     "primaryLineType" TEXT;

-- CreateTable
CREATE TABLE "BreederProfile" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "registryAffiliations" TEXT[],
    "primaryRegistry" TEXT,
    "breedingLineTypes" TEXT[],
    "breedingPhilosophy" TEXT,
    "requiresHealthTesting" BOOLEAN NOT NULL DEFAULT false,
    "requiresContract" BOOLEAN NOT NULL DEFAULT false,
    "requiredTests" TEXT[],
    "excludedRegistries" TEXT[],
    "excludedLineTypes" TEXT[],
    "excludedAttributes" TEXT[],
    "exclusionNotes" TEXT,
    "showRegistryAffiliations" BOOLEAN NOT NULL DEFAULT true,
    "showBreedingLineTypes" BOOLEAN NOT NULL DEFAULT true,
    "showRequirements" BOOLEAN NOT NULL DEFAULT true,
    "publicBio" TEXT,
    "websiteUrl" TEXT,
    "socialLinks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreederProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingDiscoveryProgram" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "programNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "species" "Species" NOT NULL,
    "programType" TEXT NOT NULL,
    "defaultBreedingMethods" TEXT[],
    "defaultGuaranteeType" TEXT,
    "defaultGuaranteeTerms" TEXT,
    "defaultRequiresHealthTesting" BOOLEAN NOT NULL DEFAULT false,
    "defaultRequiredTests" TEXT[],
    "defaultRequiresContract" BOOLEAN NOT NULL DEFAULT false,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicSlug" TEXT,
    "publicEnabledAt" TIMESTAMP(3),
    "publicHeadline" TEXT,
    "publicDescription" TEXT,
    "media" TEXT[],
    "locationCity" TEXT,
    "locationState" TEXT,
    "locationCountry" TEXT,
    "status" "BreedingProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingDiscoveryProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingListing" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "listingNumber" TEXT NOT NULL,
    "animalId" INTEGER NOT NULL,
    "programId" INTEGER,
    "species" "Species" NOT NULL,
    "breed" TEXT,
    "sex" "Sex" NOT NULL,
    "intent" "BreedingListingIntent" NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "media" TEXT[],
    "feeCents" INTEGER,
    "feeDirection" "BreedingListingFeeDirection",
    "feeNotes" TEXT,
    "availableFrom" TIMESTAMP(3),
    "availableTo" TIMESTAMP(3),
    "seasonName" TEXT,
    "breedingMethods" TEXT[],
    "maxBookings" INTEGER,
    "currentBookings" INTEGER NOT NULL DEFAULT 0,
    "guaranteeType" TEXT,
    "guaranteeTerms" TEXT,
    "requiresHealthTesting" BOOLEAN NOT NULL DEFAULT false,
    "requiredTests" TEXT[],
    "requiresContract" BOOLEAN NOT NULL DEFAULT false,
    "additionalRequirements" TEXT,
    "status" "BreedingListingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicSlug" TEXT,
    "publicEnabledAt" TIMESTAMP(3),
    "publicShowPedigree" BOOLEAN NOT NULL DEFAULT true,
    "publicPedigreeDepth" INTEGER NOT NULL DEFAULT 2,
    "publicShowTitles" BOOLEAN NOT NULL DEFAULT true,
    "publicShowHealthTesting" BOOLEAN NOT NULL DEFAULT true,
    "publicShowLineType" BOOLEAN NOT NULL DEFAULT true,
    "publicShowProducingStats" BOOLEAN NOT NULL DEFAULT false,
    "publicShowBreederName" BOOLEAN NOT NULL DEFAULT true,
    "publicShowBreederLocation" BOOLEAN NOT NULL DEFAULT true,
    "publicShowFee" BOOLEAN NOT NULL DEFAULT true,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "acceptInquiries" BOOLEAN NOT NULL DEFAULT true,
    "inquiryEmail" TEXT,
    "inquiryPhone" TEXT,
    "inquiryInstructions" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "bookingCount" INTEGER NOT NULL DEFAULT 0,
    "locationCity" TEXT,
    "locationState" TEXT,
    "locationCountry" TEXT,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,

    CONSTRAINT "BreedingListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingInquiry" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "listingId" INTEGER NOT NULL,
    "inquirerName" TEXT NOT NULL,
    "inquirerEmail" TEXT NOT NULL,
    "inquirerPhone" TEXT,
    "inquirerType" TEXT NOT NULL,
    "isBreeder" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL,
    "interestedInMethod" TEXT,
    "status" "BreedingInquiryStatus" NOT NULL DEFAULT 'NEW',
    "readAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "convertedToUserId" INTEGER,
    "convertedToBookingId" INTEGER,
    "convertedAt" TIMESTAMP(3),
    "referrerUrl" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreedingInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingBooking" (
    "id" SERIAL NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "sourceListingId" INTEGER,
    "sourceInquiryId" INTEGER,
    "offeringTenantId" INTEGER NOT NULL,
    "offeringAnimalId" INTEGER NOT NULL,
    "seekingPartyId" INTEGER NOT NULL,
    "seekingTenantId" INTEGER,
    "seekingAnimalId" INTEGER,
    "externalAnimalName" TEXT,
    "externalAnimalReg" TEXT,
    "externalAnimalBreed" TEXT,
    "externalAnimalSex" TEXT,
    "species" "Species" NOT NULL,
    "bookingType" "BreedingBookingType" NOT NULL,
    "preferredMethod" TEXT,
    "preferredDateStart" TIMESTAMP(3),
    "preferredDateEnd" TIMESTAMP(3),
    "scheduledDate" TIMESTAMP(3),
    "shippingRequired" BOOLEAN NOT NULL DEFAULT false,
    "shippingAddress" TEXT,
    "agreedFeeCents" INTEGER NOT NULL,
    "depositCents" INTEGER NOT NULL DEFAULT 0,
    "totalPaidCents" INTEGER NOT NULL DEFAULT 0,
    "feeDirection" "BreedingListingFeeDirection" NOT NULL,
    "status" "BreedingBookingStatus" NOT NULL DEFAULT 'INQUIRY',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requirements" JSONB,
    "requirementsConfig" TEXT,
    "guaranteeType" TEXT,
    "breedingPlanId" INTEGER,
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "BreedingBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BreederProfile_tenantId_key" ON "BreederProfile"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingDiscoveryProgram_programNumber_key" ON "BreedingDiscoveryProgram"("programNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingDiscoveryProgram_publicSlug_key" ON "BreedingDiscoveryProgram"("publicSlug");

-- CreateIndex
CREATE INDEX "BreedingDiscoveryProgram_tenantId_status_idx" ON "BreedingDiscoveryProgram"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BreedingDiscoveryProgram_publicEnabled_status_idx" ON "BreedingDiscoveryProgram"("publicEnabled", "status");

-- CreateIndex
CREATE INDEX "BreedingDiscoveryProgram_publicSlug_idx" ON "BreedingDiscoveryProgram"("publicSlug");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingListing_listingNumber_key" ON "BreedingListing"("listingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingListing_publicSlug_key" ON "BreedingListing"("publicSlug");

-- CreateIndex
CREATE INDEX "BreedingListing_tenantId_status_idx" ON "BreedingListing"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BreedingListing_species_breed_status_idx" ON "BreedingListing"("species", "breed", "status");

-- CreateIndex
CREATE INDEX "BreedingListing_species_intent_status_idx" ON "BreedingListing"("species", "intent", "status");

-- CreateIndex
CREATE INDEX "BreedingListing_publicEnabled_status_idx" ON "BreedingListing"("publicEnabled", "status");

-- CreateIndex
CREATE INDEX "BreedingListing_publicSlug_idx" ON "BreedingListing"("publicSlug");

-- CreateIndex
CREATE INDEX "BreedingListing_locationState_species_idx" ON "BreedingListing"("locationState", "species");

-- CreateIndex
CREATE INDEX "BreedingListing_animalId_idx" ON "BreedingListing"("animalId");

-- CreateIndex
CREATE INDEX "BreedingListing_programId_idx" ON "BreedingListing"("programId");

-- CreateIndex
CREATE INDEX "BreedingInquiry_tenantId_status_idx" ON "BreedingInquiry"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BreedingInquiry_listingId_idx" ON "BreedingInquiry"("listingId");

-- CreateIndex
CREATE INDEX "BreedingInquiry_inquirerEmail_idx" ON "BreedingInquiry"("inquirerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingBooking_bookingNumber_key" ON "BreedingBooking"("bookingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingBooking_breedingPlanId_key" ON "BreedingBooking"("breedingPlanId");

-- CreateIndex
CREATE INDEX "BreedingBooking_offeringTenantId_status_idx" ON "BreedingBooking"("offeringTenantId", "status");

-- CreateIndex
CREATE INDEX "BreedingBooking_seekingTenantId_status_idx" ON "BreedingBooking"("seekingTenantId", "status");

-- CreateIndex
CREATE INDEX "BreedingBooking_sourceListingId_idx" ON "BreedingBooking"("sourceListingId");

-- CreateIndex
CREATE INDEX "BreedingBooking_seekingPartyId_idx" ON "BreedingBooking"("seekingPartyId");

-- CreateIndex
CREATE INDEX "BreedingBooking_offeringAnimalId_idx" ON "BreedingBooking"("offeringAnimalId");

-- CreateIndex
CREATE INDEX "Animal_tenantId_species_primaryLineType_idx" ON "Animal"("tenantId", "species", "primaryLineType");

-- AddForeignKey
ALTER TABLE "BreederProfile" ADD CONSTRAINT "BreederProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingDiscoveryProgram" ADD CONSTRAINT "BreedingDiscoveryProgram_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingListing" ADD CONSTRAINT "BreedingListing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingListing" ADD CONSTRAINT "BreedingListing_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingListing" ADD CONSTRAINT "BreedingListing_programId_fkey" FOREIGN KEY ("programId") REFERENCES "BreedingDiscoveryProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingInquiry" ADD CONSTRAINT "BreedingInquiry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingInquiry" ADD CONSTRAINT "BreedingInquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "BreedingListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingBooking" ADD CONSTRAINT "BreedingBooking_sourceListingId_fkey" FOREIGN KEY ("sourceListingId") REFERENCES "BreedingListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingBooking" ADD CONSTRAINT "BreedingBooking_offeringTenantId_fkey" FOREIGN KEY ("offeringTenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingBooking" ADD CONSTRAINT "BreedingBooking_offeringAnimalId_fkey" FOREIGN KEY ("offeringAnimalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingBooking" ADD CONSTRAINT "BreedingBooking_seekingPartyId_fkey" FOREIGN KEY ("seekingPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingBooking" ADD CONSTRAINT "BreedingBooking_seekingTenantId_fkey" FOREIGN KEY ("seekingTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingBooking" ADD CONSTRAINT "BreedingBooking_seekingAnimalId_fkey" FOREIGN KEY ("seekingAnimalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingBooking" ADD CONSTRAINT "BreedingBooking_breedingPlanId_fkey" FOREIGN KEY ("breedingPlanId") REFERENCES "BreedingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
