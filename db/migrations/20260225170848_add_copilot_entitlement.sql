-- migrate:up transaction:false
-- Add COPILOT to EntitlementKey enum for AI Copilot feature gating
ALTER TYPE "public"."EntitlementKey" ADD VALUE IF NOT EXISTS 'COPILOT';

-- migrate:down
-- PostgreSQL cannot remove enum values; this is a one-way operation
