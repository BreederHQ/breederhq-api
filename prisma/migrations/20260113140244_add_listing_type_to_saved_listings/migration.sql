/*
  Warnings:

  - A unique constraint covering the columns `[bhq_user_id,listing_type,listing_id]` on the table `saved_listings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `listing_type` to the `saved_listings` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "marketplace"."saved_listings" DROP CONSTRAINT "saved_listings_listing_id_fkey";

-- DropIndex
DROP INDEX "marketplace"."saved_listings_bhq_user_id_listing_id_key";

-- DropIndex
DROP INDEX "marketplace"."saved_listings_listing_id_idx";

-- AlterTable
ALTER TABLE "marketplace"."saved_listings" ADD COLUMN     "listing_type" VARCHAR(20) NOT NULL;

-- CreateIndex
CREATE INDEX "saved_listings_listing_type_listing_id_idx" ON "marketplace"."saved_listings"("listing_type", "listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_listings_bhq_user_id_listing_type_listing_id_key" ON "marketplace"."saved_listings"("bhq_user_id", "listing_type", "listing_id");
