-- migrate:up transaction:false

-- Add DOCUMENT and MEDIA to TagModule enum for document/media tagging support.
-- Both modules use the same documentId FK on TagAssignment; the tag's module
-- determines whether it is a "document tag" or a "media tag."
ALTER TYPE "TagModule" ADD VALUE IF NOT EXISTS 'DOCUMENT';
ALTER TYPE "TagModule" ADD VALUE IF NOT EXISTS 'MEDIA';

-- migrate:down
-- PostgreSQL cannot remove enum values; they remain unused if rolled back.
