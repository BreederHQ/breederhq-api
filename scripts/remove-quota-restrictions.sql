-- ============================================================================
-- Script: Remove All Quota Restrictions from Production Tenants
-- Purpose: Set all quota limits to unlimited (NULL) for all tenants
-- Date: 2026-01-25
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- Step 1: Update ProductEntitlements to remove quota limits
-- ────────────────────────────────────────────────────────────────────────────
-- This sets all quota entitlements on products to unlimited (NULL)

UPDATE "ProductEntitlement"
SET "limitValue" = NULL
WHERE "entitlementKey" IN (
  'ANIMAL_QUOTA',
  'CONTACT_QUOTA',
  'PORTAL_USER_QUOTA',
  'BREEDING_PLAN_QUOTA',
  'MARKETPLACE_LISTING_QUOTA',
  'STORAGE_QUOTA_GB',
  'SMS_QUOTA'
);

-- ────────────────────────────────────────────────────────────────────────────
-- Step 2: Update UsageSnapshot to remove quota limits for all tenants
-- ────────────────────────────────────────────────────────────────────────────
-- This removes the cached limit from the usage tracking table

UPDATE "UsageSnapshot"
SET "limit" = NULL
WHERE "metricKey" IN (
  'ANIMAL_COUNT',
  'CONTACT_COUNT',
  'PORTAL_USER_COUNT',
  'BREEDING_PLAN_COUNT',
  'MARKETPLACE_LISTING_COUNT',
  'STORAGE_BYTES',
  'SMS_SENT'
);

-- ────────────────────────────────────────────────────────────────────────────
-- Verification Queries
-- ────────────────────────────────────────────────────────────────────────────

-- Check ProductEntitlements (should show limitValue = NULL for all quota keys)
SELECT
  p."name" as product_name,
  pe."entitlementKey",
  pe."limitValue"
FROM "ProductEntitlement" pe
JOIN "Product" p ON p."id" = pe."productId"
WHERE pe."entitlementKey" IN (
  'ANIMAL_QUOTA',
  'CONTACT_QUOTA',
  'PORTAL_USER_QUOTA',
  'BREEDING_PLAN_QUOTA',
  'MARKETPLACE_LISTING_QUOTA',
  'STORAGE_QUOTA_GB',
  'SMS_QUOTA'
)
ORDER BY p."name", pe."entitlementKey";

-- Check UsageSnapshot (should show limit = NULL for all tenants)
SELECT
  t."name" as tenant_name,
  us."metricKey",
  us."currentValue",
  us."limit"
FROM "UsageSnapshot" us
JOIN "Tenant" t ON t."id" = us."tenantId"
WHERE us."metricKey" IN (
  'ANIMAL_COUNT',
  'CONTACT_COUNT',
  'PORTAL_USER_COUNT',
  'BREEDING_PLAN_COUNT',
  'MARKETPLACE_LISTING_COUNT',
  'STORAGE_BYTES',
  'SMS_SENT'
)
ORDER BY t."name", us."metricKey";

COMMIT;

-- ============================================================================
-- Results Summary
-- ============================================================================
-- All quota limits have been set to unlimited (NULL) for:
--   1. All products in ProductEntitlement table
--   2. All tenant usage snapshots in UsageSnapshot table
--
-- This means all tenants can now create unlimited:
--   - Animals
--   - Contacts
--   - Portal Users
--   - Breeding Plans
--   - Marketplace Listings
--   - Storage (GB)
--   - SMS messages
-- ============================================================================
