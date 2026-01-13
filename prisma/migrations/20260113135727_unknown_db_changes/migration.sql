/*
  Warnings:

  - You are about to drop the column `user_id` on the `saved_listings` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[bhq_user_id,listing_id]` on the table `saved_listings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bhq_user_id` to the `saved_listings` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "marketplace"."saved_listings" DROP CONSTRAINT "saved_listings_user_id_fkey";

-- DropIndex
DROP INDEX "marketplace"."saved_listings_user_id_listing_id_key";

-- DropIndex
DROP INDEX "marketplace"."saved_listings_user_id_saved_at_idx";

-- AlterTable
ALTER TABLE "marketplace"."saved_listings" DROP COLUMN "user_id",
ADD COLUMN     "bhq_user_id" VARCHAR(36) NOT NULL;

-- CreateIndex
CREATE INDEX "saved_listings_bhq_user_id_saved_at_idx" ON "marketplace"."saved_listings"("bhq_user_id", "saved_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "saved_listings_bhq_user_id_listing_id_key" ON "marketplace"."saved_listings"("bhq_user_id", "listing_id");

-- AddForeignKey
ALTER TABLE "marketplace"."saved_listings" ADD CONSTRAINT "saved_listings_bhq_user_id_fkey" FOREIGN KEY ("bhq_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
