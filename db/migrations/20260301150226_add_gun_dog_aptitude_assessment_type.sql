-- migrate:up transaction:false
-- Add GUN_DOG_APTITUDE to the AssessmentType enum for gun dog aptitude testing support
ALTER TYPE public."AssessmentType" ADD VALUE IF NOT EXISTS 'GUN_DOG_APTITUDE';

-- migrate:down
-- PostgreSQL cannot remove enum values; this is a one-way operation
