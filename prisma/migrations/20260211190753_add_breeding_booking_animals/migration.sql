-- CreateTable
CREATE TABLE "public"."mkt_breeding_booking_animal" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "feeOverride" INTEGER,
    "maxBookings" INTEGER,
    "bookingsClosed" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mkt_breeding_booking_animal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mkt_breeding_booking_animal_bookingId_idx" ON "public"."mkt_breeding_booking_animal"("bookingId");

-- CreateIndex
CREATE INDEX "mkt_breeding_booking_animal_animalId_idx" ON "public"."mkt_breeding_booking_animal"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "mkt_breeding_booking_animal_bookingId_animalId_key" ON "public"."mkt_breeding_booking_animal"("bookingId", "animalId");

-- AddForeignKey
ALTER TABLE "public"."mkt_breeding_booking_animal" ADD CONSTRAINT "mkt_breeding_booking_animal_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."mkt_listing_breeding_booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mkt_breeding_booking_animal" ADD CONSTRAINT "mkt_breeding_booking_animal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
