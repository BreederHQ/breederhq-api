-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_senderPartyId_fkey";

-- AlterTable
ALTER TABLE "public"."Message" ALTER COLUMN "senderPartyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderPartyId_fkey" FOREIGN KEY ("senderPartyId") REFERENCES "public"."Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
