-- migrate:up
-- Seed COPILOT entitlements: Pro gets 15/day, Enterprise gets 50/day
INSERT INTO "public"."ProductEntitlement" ("productId", "entitlementKey", "limitValue", "createdAt")
SELECT p.id, 'COPILOT'::"EntitlementKey", 15, NOW()
FROM "public"."Product" p WHERE p.name ILIKE '%pro%' AND p.active = true
ON CONFLICT ("productId", "entitlementKey") DO NOTHING;

INSERT INTO "public"."ProductEntitlement" ("productId", "entitlementKey", "limitValue", "createdAt")
SELECT p.id, 'COPILOT'::"EntitlementKey", 50, NOW()
FROM "public"."Product" p WHERE p.name ILIKE '%enterprise%' AND p.active = true
ON CONFLICT ("productId", "entitlementKey") DO NOTHING;

-- migrate:down
DELETE FROM "public"."ProductEntitlement" WHERE "entitlementKey" = 'COPILOT'::"EntitlementKey";
