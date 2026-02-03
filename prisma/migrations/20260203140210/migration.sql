-- DropForeignKey
ALTER TABLE "marketplace"."MktListingService" DROP CONSTRAINT "MktListingService_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "marketplace"."MktListingService" DROP CONSTRAINT "MktListingService_tenant_id_fkey";

-- AlterTable
ALTER TABLE "marketplace"."MktListingService" ALTER COLUMN "slug" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "marketplace"."MktListingService" ADD CONSTRAINT "MktListingService_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "marketplace"."providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."MktListingService" ADD CONSTRAINT "MktListingService_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
