-- CreateTable
CREATE TABLE "public"."DirectAnimalListing" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "templateType" VARCHAR(32) NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" VARCHAR(120),
    "title" VARCHAR(100),
    "summary" TEXT,
    "description" TEXT,
    "dataDrawerConfig" JSONB NOT NULL,
    "listingContent" JSONB,
    "priceModel" VARCHAR(32) NOT NULL,
    "priceCents" INTEGER,
    "priceMinCents" INTEGER,
    "priceMaxCents" INTEGER,
    "locationCity" VARCHAR(100),
    "locationRegion" VARCHAR(100),
    "locationCountry" VARCHAR(2),
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "listed" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "lastInquiryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectAnimalListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalProgram" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" TEXT NOT NULL,
    "templateType" VARCHAR(32) NOT NULL,
    "headline" VARCHAR(120),
    "description" TEXT,
    "coverImageUrl" VARCHAR(500),
    "dataDrawerConfig" JSONB NOT NULL,
    "programContent" JSONB,
    "defaultPriceModel" VARCHAR(32) NOT NULL DEFAULT 'inquire',
    "defaultPriceCents" INTEGER,
    "defaultPriceMinCents" INTEGER,
    "defaultPriceMaxCents" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "listed" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "acceptInquiries" BOOLEAN NOT NULL DEFAULT true,
    "openWaitlist" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "lastInquiryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalProgramParticipant" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "listed" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "headlineOverride" VARCHAR(120),
    "descriptionOverride" TEXT,
    "dataDrawerOverride" JSONB,
    "contentOverride" JSONB,
    "priceModel" VARCHAR(32),
    "priceCents" INTEGER,
    "priceMinCents" INTEGER,
    "priceMaxCents" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "lastInquiryAt" TIMESTAMP(3),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalProgramParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnimalProgramMedia" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalProgramMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectAnimalListing_slug_key" ON "public"."DirectAnimalListing"("slug");

-- CreateIndex
CREATE INDEX "DirectAnimalListing_tenantId_status_idx" ON "public"."DirectAnimalListing"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DirectAnimalListing_tenantId_templateType_idx" ON "public"."DirectAnimalListing"("tenantId", "templateType");

-- CreateIndex
CREATE INDEX "DirectAnimalListing_animalId_idx" ON "public"."DirectAnimalListing"("animalId");

-- CreateIndex
CREATE INDEX "DirectAnimalListing_status_listed_idx" ON "public"."DirectAnimalListing"("status", "listed");

-- CreateIndex
CREATE INDEX "DirectAnimalListing_slug_idx" ON "public"."DirectAnimalListing"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalProgram_slug_key" ON "public"."AnimalProgram"("slug");

-- CreateIndex
CREATE INDEX "AnimalProgram_tenantId_published_idx" ON "public"."AnimalProgram"("tenantId", "published");

-- CreateIndex
CREATE INDEX "AnimalProgram_tenantId_templateType_idx" ON "public"."AnimalProgram"("tenantId", "templateType");

-- CreateIndex
CREATE INDEX "AnimalProgram_slug_idx" ON "public"."AnimalProgram"("slug");

-- CreateIndex
CREATE INDEX "AnimalProgramParticipant_programId_status_idx" ON "public"."AnimalProgramParticipant"("programId", "status");

-- CreateIndex
CREATE INDEX "AnimalProgramParticipant_animalId_idx" ON "public"."AnimalProgramParticipant"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalProgramParticipant_programId_animalId_key" ON "public"."AnimalProgramParticipant"("programId", "animalId");

-- CreateIndex
CREATE INDEX "AnimalProgramMedia_programId_sortOrder_idx" ON "public"."AnimalProgramMedia"("programId", "sortOrder");

-- AddForeignKey
ALTER TABLE "public"."DirectAnimalListing" ADD CONSTRAINT "DirectAnimalListing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DirectAnimalListing" ADD CONSTRAINT "DirectAnimalListing_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalProgram" ADD CONSTRAINT "AnimalProgram_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalProgramParticipant" ADD CONSTRAINT "AnimalProgramParticipant_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."AnimalProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalProgramParticipant" ADD CONSTRAINT "AnimalProgramParticipant_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnimalProgramMedia" ADD CONSTRAINT "AnimalProgramMedia_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."AnimalProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
