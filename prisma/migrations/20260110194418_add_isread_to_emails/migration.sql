-- AlterTable
ALTER TABLE "PartyEmail" ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UnlinkedEmail" ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false;
