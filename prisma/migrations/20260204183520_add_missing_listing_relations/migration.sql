-- AddForeignKey
ALTER TABLE "marketplace"."transactions" ADD CONSTRAINT "transactions_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace"."MktListingService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."service_tag_assignments" ADD CONSTRAINT "service_tag_assignments_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace"."MktListingService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
