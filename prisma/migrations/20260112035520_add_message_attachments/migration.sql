-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentBytes" INTEGER,
ADD COLUMN     "attachmentFilename" TEXT,
ADD COLUMN     "attachmentKey" TEXT,
ADD COLUMN     "attachmentMime" TEXT;
