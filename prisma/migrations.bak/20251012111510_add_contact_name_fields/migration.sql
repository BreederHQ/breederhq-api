-- Add missing name fields on Contact
ALTER TABLE "Contact"
  ADD COLUMN IF NOT EXISTS "first_name" TEXT,
  ADD COLUMN IF NOT EXISTS "last_name"  TEXT,
  ADD COLUMN IF NOT EXISTS "nickname"   TEXT;

-- Helpful search indexes
CREATE INDEX IF NOT EXISTS "Contact_last_name_idx"  ON "Contact" ("last_name");
CREATE INDEX IF NOT EXISTS "Contact_first_name_idx" ON "Contact" ("first_name");
CREATE INDEX IF NOT EXISTS "Contact_nickname_idx"   ON "Contact" ("nickname");
