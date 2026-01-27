/**
 * Centralized Test Tenant Helpers
 *
 * Provides unified tenant creation, teardown, and stale cleanup for all test files.
 * Use these helpers instead of copy-pasting tenant creation logic.
 *
 * Features:
 * - Unique tenant slugs with consistent prefix + timestamp format
 * - Comprehensive teardown handling FK constraints
 * - Stale tenant cleanup for local dev resilience
 */

import { PrismaClient } from "@prisma/client";

// Singleton Prisma client for test helpers
let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

/**
 * Standard tenant slug prefixes for each test file.
 * Add new prefixes as needed when creating new test files.
 */
export const TENANT_PREFIXES = {
  partyApiContracts: "party-api-test",
  partyMigrationRegression: "party-migration-test",
  animalPublicListing: "animal-listing-test",
  invoiceBuyerEnforcement: "invoice-buyer-test",
  traitDefinitions: "trait-def-test",
} as const;

export type TenantPrefix = (typeof TENANT_PREFIXES)[keyof typeof TENANT_PREFIXES];

/**
 * Creates a unique tenant slug using the standard format: prefix-timestamp
 * @param prefix - One of the standard prefixes from TENANT_PREFIXES
 * @returns Unique slug string
 */
export function createTenantSlug(prefix: TenantPrefix | string): string {
  return `${prefix}-${Date.now()}`;
}

/**
 * Creates a test tenant with a unique slug
 * @param name - Tenant name (human readable)
 * @param prefix - Slug prefix from TENANT_PREFIXES
 * @returns Created tenant with id and slug
 */
export async function createTestTenant(
  name: string,
  prefix: TenantPrefix | string
): Promise<{ id: number; slug: string }> {
  const prisma = getPrisma();
  const slug = createTenantSlug(prefix);

  // Import the assignUniqueSlug helper
  const { assignUniqueSlug } = await import('../../src/services/inbound-email-service.js');
  const inboundEmailSlug = await assignUniqueSlug(name, prisma);

  const tenant = await prisma.tenant.create({
    data: { name, slug, inboundEmailSlug },
    select: { id: true, slug: true },
  });

  if (!tenant.slug) {
    throw new Error('Tenant created without slug');
  }

  return { id: tenant.id, slug: tenant.slug };
}

/**
 * Comprehensive tenant teardown that handles all FK constraints.
 *
 * Delete order matters due to FK constraints:
 * 1. Invoice line items (FK to Invoice)
 * 2. Invoices (FK to Party, OffspringGroup)
 * 3. AnimalOwner (FK to Animal, Party)
 * 4. AnimalPublicListing (FK to Animal)
 * 5. BreedingAttempt (FK to BreedingPlan, Party)
 * 6. Offspring (FK to OffspringGroup, Party)
 * 7. OffspringGroupBuyer (FK to OffspringGroup, Party)
 * 8. WaitlistEntry (FK to Party)
 * 9. OffspringGroup (FK to BreedingPlan)
 * 10. BreedingPlan (FK to Animal)
 * 11. Contact - unlink partyId first (Restrict constraint)
 * 12. Organization (Cascade from Party)
 * 13. Animal
 * 14. Party
 * 15. Tenant
 *
 * @param tenantId - Tenant ID to delete
 * @param prismaClient - Optional Prisma client (uses singleton if not provided)
 */
export async function teardownTestTenant(
  tenantId: number,
  prismaClient?: PrismaClient
): Promise<void> {
  const prisma = prismaClient ?? getPrisma();

  // 1. Invoice line items
  await prisma.invoiceLineItem.deleteMany({ where: { tenantId } });

  // 2. Invoices
  await prisma.invoice.deleteMany({ where: { tenantId } });

  // 3. Animal owners (partyId required but onDelete: SetNull - delete first)
  await prisma.animalOwner.deleteMany({
    where: { animal: { tenantId } },
  });

  // 4. Animal public listings
  await prisma.animalPublicListing.deleteMany({ where: { tenantId } });

  // 4b. Animal trait values (FK to Animal, TraitDefinition)
  await prisma.animalTraitValue.deleteMany({ where: { tenantId } });

  // 5. Breeding attempts
  await prisma.breedingAttempt.deleteMany({
    where: { plan: { tenantId } },
  });

  // 6. Offspring
  await prisma.offspring.deleteMany({ where: { tenantId } });

  // 7. Offspring group buyers
  await prisma.offspringGroupBuyer.deleteMany({ where: { tenantId } });

  // 8. Waitlist entries
  await prisma.waitlistEntry.deleteMany({ where: { tenantId } });

  // 9. Offspring groups
  await prisma.offspringGroup.deleteMany({ where: { tenantId } });

  // 10. Breeding plans
  await prisma.breedingPlan.deleteMany({ where: { tenantId } });

  // 11. Contacts - unlink partyId first (Restrict constraint), then delete
  await prisma.contact.updateMany({
    where: { tenantId },
    data: { partyId: null },
  });
  await prisma.contact.deleteMany({ where: { tenantId } });

  // 12. Organizations (Cascade from Party deletion, but delete explicitly for safety)
  await prisma.organization.deleteMany({ where: { tenantId } });

  // 13. Animals
  await prisma.animal.deleteMany({ where: { tenantId } });

  // 14. Parties
  await prisma.party.deleteMany({ where: { tenantId } });

  // 15. Tenant itself
  await prisma.tenant.delete({ where: { id: tenantId } });
}

/**
 * Cleans up stale test tenants older than the specified age.
 *
 * Use this at the start of test files to clean up orphaned test data
 * from previous interrupted test runs. Only affects tenants matching
 * the test slug prefix pattern.
 *
 * @param prefix - Tenant slug prefix to match (e.g., "party-api-test")
 * @param maxAgeHours - Maximum age in hours before tenant is considered stale (default: 24)
 * @param prismaClient - Optional Prisma client (uses singleton if not provided)
 * @returns Number of stale tenants cleaned up
 */
export async function cleanupStaleTenants(
  prefix: TenantPrefix | string,
  maxAgeHours: number = 24,
  prismaClient?: PrismaClient
): Promise<number> {
  const prisma = prismaClient ?? getPrisma();

  // Calculate cutoff timestamp
  const cutoffMs = Date.now() - maxAgeHours * 60 * 60 * 1000;

  // Find stale tenants matching prefix pattern
  // Slug format is: prefix-timestamp (e.g., "party-api-test-1704312345678")
  const staleTenants = await prisma.tenant.findMany({
    where: {
      slug: { startsWith: `${prefix}-` },
    },
    select: { id: true, slug: true },
  });

  let cleanedCount = 0;

  for (const tenant of staleTenants) {
    // Extract timestamp from slug
    const timestampStr = tenant.slug.replace(`${prefix}-`, "");
    const timestamp = parseInt(timestampStr, 10);

    // Skip if timestamp is invalid or tenant is not stale
    if (isNaN(timestamp) || timestamp > cutoffMs) {
      continue;
    }

    try {
      await teardownTestTenant(tenant.id, prisma);
      cleanedCount++;
      console.log(`  [cleanup] Removed stale tenant: ${tenant.slug}`);
    } catch (error) {
      // Log but don't fail - stale cleanup is best-effort
      console.warn(`  [cleanup] Failed to remove stale tenant ${tenant.slug}:`, error);
    }
  }

  return cleanedCount;
}

/**
 * Disconnects the singleton Prisma client.
 * Call this in after() hooks to clean up connections.
 */
export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}
