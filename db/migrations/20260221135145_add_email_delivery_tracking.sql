-- migrate:up transaction:false

-- Extend EmailSendStatus enum with delivery tracking values
ALTER TYPE "public"."EmailSendStatus" ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE "public"."EmailSendStatus" ADD VALUE IF NOT EXISTS 'bounced';
ALTER TYPE "public"."EmailSendStatus" ADD VALUE IF NOT EXISTS 'complained';
ALTER TYPE "public"."EmailSendStatus" ADD VALUE IF NOT EXISTS 'deferred';

-- Add delivery tracking and retry columns to EmailSendLog
ALTER TABLE "public"."EmailSendLog"
  ADD COLUMN IF NOT EXISTS "retryCount" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nextRetryAt" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "lastEventAt" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "deliveryEvents" jsonb;

-- Partial index for retry job: efficiently find failed emails with scheduled retries
CREATE INDEX IF NOT EXISTS "idx_email_send_log_retry"
  ON "public"."EmailSendLog" ("status", "nextRetryAt")
  WHERE "status" = 'failed' AND "nextRetryAt" IS NOT NULL;

-- migrate:down

ALTER TABLE "public"."EmailSendLog"
  DROP COLUMN IF EXISTS "retryCount",
  DROP COLUMN IF EXISTS "nextRetryAt",
  DROP COLUMN IF EXISTS "lastEventAt",
  DROP COLUMN IF EXISTS "deliveryEvents";

DROP INDEX IF EXISTS "idx_email_send_log_retry";
