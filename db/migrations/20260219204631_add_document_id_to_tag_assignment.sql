-- migrate:up

-- Add documentId to TagAssignment for tagging documents and media.
-- Both DOCUMENT and MEDIA tag modules share this FK column; the
-- tag's module enum value differentiates the namespace.
ALTER TABLE "public"."TagAssignment" ADD COLUMN "documentId" INTEGER;

ALTER TABLE "public"."TagAssignment"
  ADD CONSTRAINT "TagAssignment_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id")
  ON DELETE CASCADE;

-- Unique constraint: a tag can only be assigned to a document once.
-- Partial index (WHERE documentId IS NOT NULL) avoids conflicting with
-- other nullable FK columns on the same table.
CREATE UNIQUE INDEX "TagAssignment_tagId_documentId_key"
  ON "public"."TagAssignment"("tagId", "documentId")
  WHERE "documentId" IS NOT NULL;

CREATE INDEX "idx_TagAssignment_documentId"
  ON "public"."TagAssignment"("documentId");

-- migrate:down
DROP INDEX IF EXISTS "idx_TagAssignment_documentId";
DROP INDEX IF EXISTS "TagAssignment_tagId_documentId_key";
ALTER TABLE "public"."TagAssignment" DROP CONSTRAINT IF EXISTS "TagAssignment_documentId_fkey";
ALTER TABLE "public"."TagAssignment" DROP COLUMN IF EXISTS "documentId";
