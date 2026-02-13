-- DropForeignKey
ALTER TABLE "public"."AnimalOwner" DROP CONSTRAINT "AnimalOwner_partyId_fkey";

-- AddForeignKey
ALTER TABLE "public"."AnimalOwner" ADD CONSTRAINT "AnimalOwner_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "public"."Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
