-- AlterTable
ALTER TABLE "public"."mkt_listing_breeder_service" ADD COLUMN     "bookingsReceived" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxBookings" INTEGER,
ADD COLUMN     "stallionId" INTEGER;

-- CreateIndex
CREATE INDEX "mkt_listing_breeder_service_stallionId_idx" ON "public"."mkt_listing_breeder_service"("stallionId");

-- AddForeignKey
ALTER TABLE "public"."mkt_listing_breeder_service" ADD CONSTRAINT "mkt_listing_breeder_service_stallionId_fkey" FOREIGN KEY ("stallionId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
