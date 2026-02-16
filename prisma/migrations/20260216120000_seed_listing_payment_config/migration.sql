-- Seed marketplace-listing-payments platform setting (uses upsert pattern to be idempotent)
INSERT INTO "public"."PlatformSetting" ("namespace", "data", "updatedAt")
VALUES (
  'marketplace-listing-payments',
  '{"enabled":false,"listingFeeCents":499,"listingDurationDays":30,"foundingFreeUntil":null,"foundingWindowEnd":null,"stripePriceId":"","stripeProductId":"","featuredUpgradeEnabled":false,"featuredUpgradeFeeCents":499,"featuredStripePriceId":null}',
  NOW()
)
ON CONFLICT ("namespace") DO NOTHING;

-- Backfill all existing LIVE service listings as founding providers
UPDATE "marketplace"."mkt_listing_breeder_service"
SET "is_founding" = true
WHERE "status" = 'LIVE'
  AND "is_founding" = false;
