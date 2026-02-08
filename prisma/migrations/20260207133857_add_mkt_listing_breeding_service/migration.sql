-- CreateTable
CREATE TABLE "public"."mkt_listing_breeding_service" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" VARCHAR(120),
    "description" TEXT,
    "intent" VARCHAR(32) NOT NULL,
    "feeCents" INTEGER,
    "feeDirection" VARCHAR(32),
    "breedingMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guaranteeType" VARCHAR(32),
    "guaranteeTerms" TEXT,
    "healthCertRequired" BOOLEAN NOT NULL DEFAULT false,
    "cogginsCurrent" BOOLEAN NOT NULL DEFAULT false,
    "cultureRequired" BOOLEAN NOT NULL DEFAULT false,
    "contractRequired" BOOLEAN NOT NULL DEFAULT false,
    "customRequirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availableFrom" TIMESTAMP(3),
    "availableTo" TIMESTAMP(3),
    "blackoutDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxBookingsPerPeriod" INTEGER,
    "acceptingInquiries" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "lastInquiryAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mkt_listing_breeding_service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mkt_breeding_service_animal" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "feeOverride" INTEGER,
    "maxBookings" INTEGER,
    "bookingsClosed" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mkt_breeding_service_animal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mkt_listing_breeding_service_slug_key" ON "public"."mkt_listing_breeding_service"("slug");

-- CreateIndex
CREATE INDEX "mkt_listing_breeding_service_tenantId_status_idx" ON "public"."mkt_listing_breeding_service"("tenantId", "status");

-- CreateIndex
CREATE INDEX "mkt_listing_breeding_service_intent_idx" ON "public"."mkt_listing_breeding_service"("intent");

-- CreateIndex
CREATE INDEX "mkt_breeding_service_animal_serviceId_idx" ON "public"."mkt_breeding_service_animal"("serviceId");

-- CreateIndex
CREATE INDEX "mkt_breeding_service_animal_animalId_idx" ON "public"."mkt_breeding_service_animal"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "mkt_breeding_service_animal_serviceId_animalId_key" ON "public"."mkt_breeding_service_animal"("serviceId", "animalId");

-- AddForeignKey
ALTER TABLE "public"."mkt_listing_breeding_service" ADD CONSTRAINT "mkt_listing_breeding_service_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mkt_breeding_service_animal" ADD CONSTRAINT "mkt_breeding_service_animal_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."mkt_listing_breeding_service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mkt_breeding_service_animal" ADD CONSTRAINT "mkt_breeding_service_animal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
