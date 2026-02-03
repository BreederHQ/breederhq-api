-- Unify service listings into single table: MktListingService
-- Consolidates MktListingProviderService and MktListingBreederService
-- Uses source_type discriminator: 'PROVIDER' or 'BREEDER'

-- Create enum for source type
CREATE TYPE "marketplace"."ServiceSourceType" AS ENUM ('PROVIDER', 'BREEDER');

-- Create unified service listings table
CREATE TABLE "marketplace"."MktListingService" (
    "id" SERIAL PRIMARY KEY,
    "source_type" "marketplace"."ServiceSourceType" NOT NULL,

    -- Source references (one will be NULL based on source_type)
    "provider_id" INTEGER,
    "tenant_id" INTEGER,

    -- Listing details
    "slug" VARCHAR(255) NOT NULL UNIQUE,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,

    -- Service categorization
    "category" VARCHAR(100) NOT NULL,
    "subcategory" VARCHAR(100),
    "custom_service_type" VARCHAR(50),

    -- Pricing
    "price_cents" BIGINT,
    "price_type" VARCHAR(50),
    "price_text" VARCHAR(100),

    -- Media
    "images" JSONB,
    "cover_image_url" VARCHAR(500),

    -- Location
    "city" VARCHAR(100),
    "state" VARCHAR(50),
    "zip" VARCHAR(20),
    "country" VARCHAR(2),
    "latitude" DECIMAL(10, 8),
    "longitude" DECIMAL(11, 8),

    -- Service details
    "duration" VARCHAR(100),
    "availability" TEXT,

    -- SEO
    "meta_description" TEXT,
    "keywords" TEXT,

    -- Stats
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "inquiry_count" INTEGER NOT NULL DEFAULT 0,
    "booking_count" INTEGER NOT NULL DEFAULT 0,

    -- Status
    "status" "public"."MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),

    -- Moderation
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagged_at" TIMESTAMP(3),

    -- Timestamps
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    -- Constraints
    CONSTRAINT "provider_xor_tenant" CHECK (
        (source_type = 'PROVIDER' AND provider_id IS NOT NULL AND tenant_id IS NULL) OR
        (source_type = 'BREEDER' AND tenant_id IS NOT NULL AND provider_id IS NULL)
    ),

    -- Foreign keys
    CONSTRAINT "MktListingService_provider_id_fkey"
        FOREIGN KEY ("provider_id")
        REFERENCES "marketplace"."providers"("id")
        ON DELETE CASCADE,

    CONSTRAINT "MktListingService_tenant_id_fkey"
        FOREIGN KEY ("tenant_id")
        REFERENCES "public"."Tenant"("id")
        ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX "MktListingService_provider_id_idx" ON "marketplace"."MktListingService"("provider_id");
CREATE INDEX "MktListingService_tenant_id_idx" ON "marketplace"."MktListingService"("tenant_id");
CREATE INDEX "MktListingService_slug_idx" ON "marketplace"."MktListingService"("slug");
CREATE INDEX "MktListingService_status_idx" ON "marketplace"."MktListingService"("status");
CREATE INDEX "MktListingService_category_idx" ON "marketplace"."MktListingService"("category");
CREATE INDEX "MktListingService_city_state_idx" ON "marketplace"."MktListingService"("city", "state");
CREATE INDEX "MktListingService_source_type_idx" ON "marketplace"."MktListingService"("source_type");
CREATE INDEX "MktListingService_deleted_at_idx" ON "marketplace"."MktListingService"("deleted_at");

-- Migrate data from MktListingProviderService (provider listings)
INSERT INTO "marketplace"."MktListingService" (
    "source_type",
    "provider_id",
    "tenant_id",
    "slug",
    "title",
    "description",
    "category",
    "subcategory",
    "custom_service_type",
    "price_cents",
    "price_type",
    "price_text",
    "images",
    "cover_image_url",
    "city",
    "state",
    "zip",
    "country",
    "latitude",
    "longitude",
    "duration",
    "availability",
    "meta_description",
    "keywords",
    "view_count",
    "inquiry_count",
    "booking_count",
    "status",
    "published_at",
    "paused_at",
    "flagged",
    "flagged_at",
    "created_at",
    "updated_at",
    "deleted_at"
)
SELECT
    'PROVIDER'::marketplace."ServiceSourceType",
    "provider_id",
    NULL,
    "slug",
    "title",
    "description",
    "category",
    "subcategory",
    "custom_service_type",
    "price_cents",
    "price_type",
    "price_text",
    "images",
    "cover_image_url",
    "city",
    "state",
    "zip",
    "country",
    "latitude",
    "longitude",
    "duration",
    "availability",
    "meta_description",
    "keywords",
    "view_count",
    "inquiry_count",
    "booking_count",
    "status",
    "published_at",
    "paused_at",
    "flagged",
    "flagged_at",
    "created_at",
    "updated_at",
    "deleted_at"
FROM "marketplace"."service_listings";

-- Migrate data from MktListingBreederService (breeder listings)
INSERT INTO "marketplace"."MktListingService" (
    "source_type",
    "provider_id",
    "tenant_id",
    "slug",
    "title",
    "description",
    "category",
    "subcategory",
    "custom_service_type",
    "price_cents",
    "price_type",
    "price_text",
    "images",
    "cover_image_url",
    "city",
    "state",
    "zip",
    "country",
    "latitude",
    "longitude",
    "duration",
    "availability",
    "meta_description",
    "keywords",
    "view_count",
    "inquiry_count",
    "booking_count",
    "status",
    "published_at",
    "paused_at",
    "flagged",
    "flagged_at",
    "created_at",
    "updated_at",
    "deleted_at"
)
SELECT
    'BREEDER'::marketplace."ServiceSourceType",
    NULL,
    "tenantId",
    COALESCE("slug", 'breeder-svc-' || "id"),
    "title",
    "description",
    "listingType", -- Maps to category
    "category", -- Maps to subcategory
    NULL, -- custom_service_type doesn't exist in breeder table
    "priceCents",
    "priceType",
    NULL, -- price_text doesn't exist in breeder table
    "images",
    NULL, -- cover_image_url doesn't exist in breeder table
    "city",
    "state",
    "zip",
    "country",
    NULL, -- latitude doesn't exist in breeder table
    NULL, -- longitude doesn't exist in breeder table
    NULL, -- duration doesn't exist in breeder table
    NULL, -- availability doesn't exist in breeder table
    NULL, -- meta_description doesn't exist in breeder table
    NULL, -- keywords doesn't exist in breeder table
    "viewCount",
    "inquiryCount",
    0, -- booking_count doesn't exist in breeder table
    "status",
    "publishedAt",
    NULL, -- paused_at doesn't exist in breeder table
    false, -- flagged doesn't exist in breeder table
    NULL, -- flagged_at doesn't exist in breeder table
    "createdAt",
    "updatedAt",
    NULL -- deleted_at doesn't exist in breeder table (breeder services don't soft delete)
FROM "public"."mkt_listing_breeder_service";

-- Note: Foreign key updates for related tables will be handled separately
-- Old tables (MktListingProviderService, MktListingBreederService) will be dropped after verification
