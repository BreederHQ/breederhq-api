-- AlterTable
ALTER TABLE "marketplace"."messages" ADD COLUMN     "sender_type" TEXT NOT NULL DEFAULT 'client';
