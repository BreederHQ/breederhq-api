-- ============================================================================
-- Backfill PartyCommPreference with default preferences for all existing parties
-- ============================================================================
-- This script is idempotent and can be run multiple times safely.
-- It creates one row per party per channel with preference=ALLOW and NULL compliance.
-- ON CONFLICT clause ensures we don't duplicate rows if they already exist.
-- ============================================================================

-- Backfill all 5 channels for each existing party
INSERT INTO "PartyCommPreference" (
  "partyId",
  "channel",
  "preference",
  "compliance",
  "complianceSetAt",
  "complianceSource",
  "createdAt",
  "updatedAt"
)
SELECT
  p.id AS "partyId",
  channel_type.channel AS "channel",
  'ALLOW'::"PreferenceLevel" AS "preference",
  NULL::"ComplianceStatus" AS "compliance",
  NULL AS "complianceSetAt",
  NULL AS "complianceSource",
  NOW() AS "createdAt",
  NOW() AS "updatedAt"
FROM
  "Party" p
  CROSS JOIN (
    VALUES
      ('EMAIL'::"CommChannel"),
      ('SMS'::"CommChannel"),
      ('PHONE'::"CommChannel"),
      ('MAIL'::"CommChannel"),
      ('WHATSAPP'::"CommChannel")
  ) AS channel_type(channel)
ON CONFLICT ("partyId", "channel") DO NOTHING;

-- Summary of backfill
DO $$
DECLARE
  total_parties INTEGER;
  total_prefs INTEGER;
  expected_prefs INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_parties FROM "Party";
  SELECT COUNT(*) INTO total_prefs FROM "PartyCommPreference";
  expected_prefs := total_parties * 5;

  RAISE NOTICE '=== Party Communication Preferences Backfill Complete ===';
  RAISE NOTICE 'Total parties: %', total_parties;
  RAISE NOTICE 'Total preference rows: %', total_prefs;
  RAISE NOTICE 'Expected rows (parties × 5 channels): %', expected_prefs;

  IF total_prefs < expected_prefs THEN
    RAISE WARNING 'Preferences count is less than expected. Some parties may be missing preferences.';
  ELSE
    RAISE NOTICE 'Backfill successful! All parties have preferences for all channels.';
  END IF;
END $$;
