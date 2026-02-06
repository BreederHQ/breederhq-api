-- AddForeignKey
ALTER TABLE "marketplace"."message_threads" ADD CONSTRAINT "message_threads_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace"."MktListingService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
