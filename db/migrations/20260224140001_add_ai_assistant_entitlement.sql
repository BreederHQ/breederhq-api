-- migrate:up transaction:false
-- Add AI_ASSISTANT to EntitlementKey enum.
-- This gates the in-app AI Help Assistant behind Pro/Enterprise tiers.

ALTER TYPE "public"."EntitlementKey" ADD VALUE IF NOT EXISTS 'AI_ASSISTANT';

-- migrate:down
-- PostgreSQL does not support removing enum values. This addition is
-- backward-compatible and safe to leave in place.
