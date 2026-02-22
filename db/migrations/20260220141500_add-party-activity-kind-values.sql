-- migrate:up
ALTER TYPE "PartyActivityKind" ADD VALUE IF NOT EXISTS 'NOTE_DELETED';
ALTER TYPE "PartyActivityKind" ADD VALUE IF NOT EXISTS 'EVENT_UPDATED';
ALTER TYPE "PartyActivityKind" ADD VALUE IF NOT EXISTS 'EVENT_DELETED';
ALTER TYPE "PartyActivityKind" ADD VALUE IF NOT EXISTS 'MILESTONE_UPDATED';
ALTER TYPE "PartyActivityKind" ADD VALUE IF NOT EXISTS 'MILESTONE_DELETED';

-- migrate:down
-- PostgreSQL does not support removing values from an enum.
-- These values are additive and safe to leave in place.
