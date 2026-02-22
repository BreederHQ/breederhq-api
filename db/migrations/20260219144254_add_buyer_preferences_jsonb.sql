-- migrate:up
ALTER TABLE "public"."WaitlistEntry"
  ADD COLUMN "buyerPreferences" JSONB DEFAULT '{}';

COMMENT ON COLUMN "public"."WaitlistEntry"."buyerPreferences" IS
  'Structured buyer prefs: sexPref, purpose, colorPrefs, timeline, registrationRequired';

-- migrate:down
ALTER TABLE "public"."WaitlistEntry" DROP COLUMN IF EXISTS "buyerPreferences";
