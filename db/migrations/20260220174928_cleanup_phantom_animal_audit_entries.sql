-- migrate:up
-- Remove phantom audit entries caused by beforeSnap (all fields) vs updated (select subset).
-- These entries always have newValue IS NULL for fields the PATCH endpoint never touches.
DELETE FROM "public"."entity_audit_log"
WHERE "entityType" = 'ANIMAL'
  AND "action" = 'UPDATE'
  AND "newValue" IS NULL
  AND "fieldName" IN (
    'offspringGroupId',
    'collarColorId', 'collarColorName', 'collarColorHex', 'collarAssignedAt', 'collarLocked',
    'buyerPartyId', 'priceCents', 'depositCents',
    'saleInvoiceId', 'contractId', 'contractSignedAt',
    'paidInFullAt', 'healthCertAt', 'microchipAppliedAt', 'pickupAt', 'placedAt',
    'damId', 'sireId',
    'coiPercent', 'coiGenerations', 'coiCalculatedAt',
    'titlePrefix', 'titleSuffix',
    'exchangeCode', 'exchangeCodeExpiresAt',
    'deletedAt',
    'breedingAvailability', 'lineDescription', 'lineTypes', 'primaryLineType',
    'networkSearchVisible'
  );

-- migrate:down
-- Data cleanup is not reversible — the deleted rows were phantom artifacts, not real changes.
