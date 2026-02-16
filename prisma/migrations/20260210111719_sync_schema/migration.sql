-- AlterTable
ALTER TABLE "marketplace"."mkt_listing_breeder_service" RENAME CONSTRAINT "MktListingService_pkey" TO "mkt_listing_breeder_service_pkey";

-- AlterTable
ALTER TABLE "public"."mkt_listing_individual_animal" RENAME CONSTRAINT "direct_animal_listing_pkey" TO "mkt_listing_individual_animal_pkey";

-- RenameForeignKey
ALTER TABLE "marketplace"."mkt_listing_breeder_service" RENAME CONSTRAINT "MktListingService_provider_id_fkey" TO "mkt_listing_breeder_service_provider_id_fkey";

-- RenameForeignKey
ALTER TABLE "marketplace"."mkt_listing_breeder_service" RENAME CONSTRAINT "MktListingService_tenant_id_fkey" TO "mkt_listing_breeder_service_tenant_id_fkey";

-- RenameForeignKey
ALTER TABLE "public"."mkt_listing_individual_animal" RENAME CONSTRAINT "direct_animal_listing_animalId_fkey" TO "mkt_listing_individual_animal_animalId_fkey";

-- RenameForeignKey
ALTER TABLE "public"."mkt_listing_individual_animal" RENAME CONSTRAINT "direct_animal_listing_tenantId_fkey" TO "mkt_listing_individual_animal_tenantId_fkey";

-- RenameIndex
ALTER INDEX "marketplace"."MktListingService_category_idx" RENAME TO "mkt_listing_breeder_service_category_idx";

-- RenameIndex
ALTER INDEX "marketplace"."MktListingService_city_state_idx" RENAME TO "mkt_listing_breeder_service_city_state_idx";

-- RenameIndex
ALTER INDEX "marketplace"."MktListingService_deleted_at_idx" RENAME TO "mkt_listing_breeder_service_deleted_at_idx";

-- RenameIndex
ALTER INDEX "marketplace"."MktListingService_is_featured_featured_until_idx" RENAME TO "mkt_listing_breeder_service_is_featured_featured_until_idx";

-- RenameIndex
ALTER INDEX "marketplace"."MktListingService_provider_id_idx" RENAME TO "mkt_listing_breeder_service_provider_id_idx";

-- RenameIndex
ALTER INDEX "marketplace"."MktListingService_slug_idx" RENAME TO "mkt_listing_breeder_service_slug_idx";

-- RenameIndex
ALTER INDEX "marketplace"."MktListingService_slug_key" RENAME TO "mkt_listing_breeder_service_slug_key";

-- RenameIndex
ALTER INDEX "marketplace"."MktListingService_source_type_idx" RENAME TO "mkt_listing_breeder_service_source_type_idx";

-- RenameIndex
ALTER INDEX "marketplace"."MktListingService_status_idx" RENAME TO "mkt_listing_breeder_service_status_idx";

-- RenameIndex
ALTER INDEX "marketplace"."MktListingService_tenant_id_idx" RENAME TO "mkt_listing_breeder_service_tenant_id_idx";

-- RenameIndex
ALTER INDEX "public"."direct_animal_listing_animalId_idx" RENAME TO "mkt_listing_individual_animal_animalId_idx";

-- RenameIndex
ALTER INDEX "public"."direct_animal_listing_slug_idx" RENAME TO "mkt_listing_individual_animal_slug_idx";

-- RenameIndex
ALTER INDEX "public"."direct_animal_listing_slug_key" RENAME TO "mkt_listing_individual_animal_slug_key";

-- RenameIndex
ALTER INDEX "public"."direct_animal_listing_status_idx" RENAME TO "mkt_listing_individual_animal_status_idx";

-- RenameIndex
ALTER INDEX "public"."direct_animal_listing_tenantId_status_idx" RENAME TO "mkt_listing_individual_animal_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "public"."direct_animal_listing_tenantId_templateType_idx" RENAME TO "mkt_listing_individual_animal_tenantId_templateType_idx";
