-- Step 6A: Attachments Party-only migration
-- Remove legacy contactId column from Attachment, keeping only attachmentPartyId
-- This migration is idempotent and safe to run after db push

-- Drop index on contactId if it exists
DROP INDEX IF EXISTS "Attachment_contactId_idx";

-- Drop foreign key constraint from Attachment.contactId to Contact.id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Attachment_contactId_fkey'
  ) THEN
    ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_contactId_fkey";
  END IF;
END $$;

-- Drop contactId column if it exists
ALTER TABLE "Attachment" DROP COLUMN IF EXISTS "contactId";

-- Ensure attachmentPartyId column exists (should already exist from Step 5)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Attachment' AND column_name = 'attachmentPartyId'
  ) THEN
    ALTER TABLE "Attachment" ADD COLUMN "attachmentPartyId" INTEGER;
  END IF;
END $$;

-- Ensure index on attachmentPartyId exists
CREATE INDEX IF NOT EXISTS "Attachment_attachmentPartyId_idx" ON "Attachment"("attachmentPartyId");

-- Ensure foreign key from Attachment.attachmentPartyId to Party.id exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Attachment_attachmentPartyId_fkey'
  ) THEN
    ALTER TABLE "Attachment"
      ADD CONSTRAINT "Attachment_attachmentPartyId_fkey"
      FOREIGN KEY ("attachmentPartyId")
      REFERENCES "Party"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
