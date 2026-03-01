-- migrate:up
ALTER TABLE "public"."AssessmentResult" ALTER COLUMN "assignmentId" DROP NOT NULL;

ALTER TABLE "public"."AssessmentResult" DROP CONSTRAINT IF EXISTS "AssessmentResult_assignmentId_fkey";

ALTER TABLE "public"."AssessmentResult"
  ADD CONSTRAINT "AssessmentResult_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "public"."RearingProtocolAssignment"("id")
  ON DELETE SET NULL;

-- migrate:down
DELETE FROM "public"."AssessmentResult" WHERE "assignmentId" IS NULL;

ALTER TABLE "public"."AssessmentResult" DROP CONSTRAINT IF EXISTS "AssessmentResult_assignmentId_fkey";

ALTER TABLE "public"."AssessmentResult"
  ADD CONSTRAINT "AssessmentResult_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "public"."RearingProtocolAssignment"("id")
  ON DELETE CASCADE;

ALTER TABLE "public"."AssessmentResult" ALTER COLUMN "assignmentId" SET NOT NULL;
