-- migrate:up transaction:false

-- Add 'contact' to DocumentScope enum so contacts can have general documents
-- (not just contracts). The Document table already has nullable FK columns for
-- scoping; we add partyId for contact/org association.
ALTER TYPE "DocumentScope" ADD VALUE IF NOT EXISTS 'contact';

-- migrate:down
-- PostgreSQL cannot remove enum values; the value remains unused if rolled back.
