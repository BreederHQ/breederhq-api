-- migrate:up

-- Add partyId to Document for contact/organization document association.
-- This allows documents to be scoped to a contact or organization via the
-- Party model, enabling the Contacts module to manage general documents.
ALTER TABLE "public"."Document" ADD COLUMN "partyId" INTEGER;

ALTER TABLE "public"."Document"
  ADD CONSTRAINT "Document_partyId_fkey"
  FOREIGN KEY ("partyId") REFERENCES "public"."Party"("id")
  ON DELETE SET NULL;

CREATE INDEX "idx_Document_partyId" ON "public"."Document"("partyId");

-- migrate:down
DROP INDEX IF EXISTS "idx_Document_partyId";
ALTER TABLE "public"."Document" DROP CONSTRAINT IF EXISTS "Document_partyId_fkey";
ALTER TABLE "public"."Document" DROP COLUMN IF EXISTS "partyId";
