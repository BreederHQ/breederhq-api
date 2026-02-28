-- migrate:up transaction:false
-- Add compliance-related notification types for Client Health Portal Phase 4
-- These support compliance reminders, verification, and fulfillment notifications

ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'compliance_reminder_30d';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'compliance_reminder_7d';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'compliance_reminder_1d';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'compliance_overdue';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'compliance_fulfilled';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'compliance_verified';
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'compliance_rejected';

-- migrate:down
-- PostgreSQL cannot remove enum values; this is a one-way operation
