/*
  Warnings:

  - You are about to drop the `ServiceProviderProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mkt_breeding_service_animal` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ServiceProviderProfile" DROP CONSTRAINT "ServiceProviderProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."mkt_breeding_service_animal" DROP CONSTRAINT "mkt_breeding_service_animal_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."mkt_breeding_service_animal" DROP CONSTRAINT "mkt_breeding_service_animal_serviceId_fkey";

-- DropTable
DROP TABLE "public"."ServiceProviderProfile";

-- DropTable
DROP TABLE "public"."mkt_breeding_service_animal";
