-- AlterTable
ALTER TABLE "public"."mkt_listing_breeder_service" ADD COLUMN     "bookingsClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bookingsReceived" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "breedingMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "defaultGuarantee" "public"."BreedingGuaranteeType",
ADD COLUMN     "horseServiceData" JSONB,
ADD COLUMN     "maxBookings" INTEGER,
ADD COLUMN     "seasonEnd" TIMESTAMP(3),
ADD COLUMN     "seasonName" VARCHAR(100),
ADD COLUMN     "seasonStart" TIMESTAMP(3),
ADD COLUMN     "stallionId" INTEGER;

-- CreateIndex
CREATE INDEX "mkt_listing_breeder_service_stallionId_idx" ON "public"."mkt_listing_breeder_service"("stallionId");

-- AddForeignKey
ALTER TABLE "public"."mkt_listing_breeder_service" ADD CONSTRAINT "mkt_listing_breeder_service_stallionId_fkey" FOREIGN KEY ("stallionId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
