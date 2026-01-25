/**
 * Duplicate Tenant #4 from DEV to PROD
 *
 * This script copies all data for tenant #4 from the development database to production,
 * including the user luke.skywalker@tester.com and all related animals, contacts, breeding plans, etc.
 *
 * Usage:
 *   DRY RUN (recommended first):
 *     npx tsx scripts/migrations/duplicate-tenant-dev-to-prod.ts --dry-run
 *
 *   ACTUAL EXECUTION:
 *     npx tsx scripts/migrations/duplicate-tenant-dev-to-prod.ts --execute
 *
 * Environment variables required:
 *   DEV_DATABASE_URL - Development database connection string
 *   PROD_DATABASE_URL - Production database connection string (or DATABASE_URL for prod)
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const SOURCE_TENANT_ID = 4;
const TARGET_TENANT_ID = 4; // Can be different if you want a new tenant ID in prod
const TARGET_USER_EMAIL = 'luke.skywalker@tester.local';
const TARGET_USER_PASSWORD = 'Testing123!'; // Will be hashed

// Check command line args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');

if (!isDryRun && !isExecute) {
  console.error('\n❌ ERROR: You must specify either --dry-run or --execute\n');
  console.log('Usage:');
  console.log('  npx tsx scripts/migrations/duplicate-tenant-dev-to-prod.ts --dry-run');
  console.log('  npx tsx scripts/migrations/duplicate-tenant-dev-to-prod.ts --execute\n');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE CONNECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const devDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DEV_DATABASE_URL || '',
    },
  },
});

const prodDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || '',
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ID MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

interface IdMap {
  [key: string]: Map<number, number>; // oldId -> newId
}

const idMaps: IdMap = {};

function createIdMap(tableName: string): Map<number, number> {
  if (!idMaps[tableName]) {
    idMaps[tableName] = new Map();
  }
  return idMaps[tableName];
}

function mapId(tableName: string, oldId: number | null | undefined): number | null {
  if (oldId === null || oldId === undefined) return null;
  const map = idMaps[tableName];
  if (!map) return oldId;
  return map.get(oldId) ?? oldId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function log(message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const icons = {
    info: '📋',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };
  console.log(`${icons[level]} ${message}`);
}

async function ensureTenant() {
  log(`Checking if tenant #${TARGET_TENANT_ID} exists in prod...`);

  const devTenant = await devDb.tenant.findUnique({
    where: { id: SOURCE_TENANT_ID },
  });

  if (!devTenant) {
    throw new Error(`Source tenant #${SOURCE_TENANT_ID} not found in dev database!`);
  }

  log(`Found source tenant in dev: "${devTenant.name}"`, 'success');

  const prodTenant = await prodDb.tenant.findUnique({
    where: { id: TARGET_TENANT_ID },
  });

  if (prodTenant) {
    log(`Tenant #${TARGET_TENANT_ID} already exists in prod: "${prodTenant.name}"`, 'warning');
    log('Will use existing tenant and add/update data');
    return prodTenant;
  }

  log(`Tenant #${TARGET_TENANT_ID} does not exist in prod`, 'info');

  if (isDryRun) {
    log('[DRY RUN] Would create tenant with data:', 'info');
    console.log(JSON.stringify(devTenant, null, 2));
    return devTenant;
  }

  log('Creating tenant in prod...', 'info');
  const newTenant = await prodDb.tenant.create({
    data: {
      id: TARGET_TENANT_ID,
      name: devTenant.name,
      slug: devTenant.slug,
      primaryEmail: devTenant.primaryEmail,
      city: devTenant.city,
      region: devTenant.region,
      country: devTenant.country,
      operationType: devTenant.operationType,
      marketplacePaymentMode: devTenant.marketplacePaymentMode,
      stripeConnectAccountId: null, // Don't copy Stripe IDs
      stripeConnectOnboardingComplete: false,
      stripeConnectPayoutsEnabled: false,
    },
  });

  log(`Created tenant #${TARGET_TENANT_ID}: "${newTenant.name}"`, 'success');
  return newTenant;
}

async function ensureUser() {
  log(`Checking if user ${TARGET_USER_EMAIL} exists in prod...`);

  const devUser = await devDb.user.findUnique({
    where: { email: TARGET_USER_EMAIL },
  });

  if (!devUser) {
    throw new Error(`User ${TARGET_USER_EMAIL} not found in dev database!`);
  }

  log(`Found user in dev: ${devUser.firstName} ${devUser.lastName}`, 'success');

  const prodUser = await prodDb.user.findUnique({
    where: { email: TARGET_USER_EMAIL },
  });

  if (prodUser) {
    log('User already exists in prod', 'warning');
    return prodUser;
  }

  log('User does not exist in prod', 'info');

  if (isDryRun) {
    log('[DRY RUN] Would create user with data:', 'info');
    console.log(JSON.stringify({ ...devUser, passwordHash: '[REDACTED]' }, null, 2));
    return devUser;
  }

  log('Creating user in prod...', 'info');
  const passwordHash = await bcrypt.hash(TARGET_USER_PASSWORD, 10);

  const newUser = await prodDb.user.create({
    data: {
      id: devUser.id, // Keep same ID for consistency
      email: devUser.email,
      name: devUser.name,
      firstName: devUser.firstName,
      lastName: devUser.lastName,
      nickname: devUser.nickname,
      image: devUser.image,
      passwordHash,
      phoneE164: devUser.phoneE164,
      whatsappE164: devUser.whatsappE164,
      street: devUser.street,
      street2: devUser.street2,
      city: devUser.city,
      state: devUser.state,
      postalCode: devUser.postalCode,
      country: devUser.country,
      role: devUser.role,
      emailVerifiedAt: new Date(), // Verify email immediately
      defaultTenantId: TARGET_TENANT_ID,
    },
  });

  log(`Created user: ${newUser.email}`, 'success');
  return newUser;
}

async function ensureTenantMembership(userId: string) {
  log('Checking tenant membership...', 'info');

  const devMembership = await devDb.tenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId: SOURCE_TENANT_ID,
      },
    },
  });

  if (!devMembership) {
    log('No membership found in dev, will create OWNER membership in prod', 'warning');
  }

  const prodMembership = await prodDb.tenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId: TARGET_TENANT_ID,
      },
    },
  });

  if (prodMembership) {
    log('Membership already exists in prod', 'success');
    return prodMembership;
  }

  if (isDryRun) {
    log('[DRY RUN] Would create tenant membership', 'info');
    return null;
  }

  log('Creating tenant membership...', 'info');
  const newMembership = await prodDb.tenantMembership.create({
    data: {
      userId,
      tenantId: TARGET_TENANT_ID,
      role: devMembership?.role || 'OWNER',
      membershipRole: devMembership?.membershipRole || 'STAFF',
      membershipStatus: devMembership?.membershipStatus || 'ACTIVE',
      partyId: devMembership?.partyId,
    },
  });

  log('Created tenant membership', 'success');
  return newMembership;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA COPYING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Copy table with tenant-scoped data
 * This is a generic function that handles the common pattern
 */
async function copyTenantTable<T extends { id: number; tenantId: number }>(
  tableName: string,
  devModel: any,
  prodModel: any,
  dataTransformer?: (item: T, idMaps: IdMap) => any
) {
  log(`\n📦 Copying ${tableName}...`, 'info');

  const items = await devModel.findMany({
    where: { tenantId: SOURCE_TENANT_ID },
  });

  log(`Found ${items.length} ${tableName} records in dev`);

  if (items.length === 0) {
    log(`No ${tableName} to copy`, 'info');
    return;
  }

  if (isDryRun) {
    log(`[DRY RUN] Would copy ${items.length} ${tableName} records`, 'info');
    if (items.length > 0) {
      // Handle BigInt serialization
      const sample = JSON.stringify(items[0], (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      , 2);
      console.log('Sample record:', sample);
    }
    return;
  }

  const idMap = createIdMap(tableName);
  let copied = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      // Transform the data
      const { id, createdAt, updatedAt, ...data } = item;
      let transformedData = {
        ...data,
        tenantId: TARGET_TENANT_ID,
      };

      // Apply custom transformer if provided
      if (dataTransformer) {
        transformedData = dataTransformer(item, idMaps);
      }

      // Create in prod
      const newRecord = await prodModel.create({
        data: transformedData,
      });

      // Store ID mapping
      idMap.set(id, newRecord.id);
      copied++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation - record already exists
        // Try to find the existing record and update ID mapping
        try {
          // Try to find by unique constraints (this is table-specific)
          // For most tables, we can query by tenantId and some unique field
          const existingRecord = await prodModel.findFirst({
            where: { tenantId: TARGET_TENANT_ID, id: item.id },
          });

          if (existingRecord) {
            idMap.set(item.id, existingRecord.id);
          }
        } catch (lookupError) {
          // Ignore lookup errors
        }
        skipped++;
      } else if (error.code === 'P2003') {
        // Foreign key constraint - referenced record doesn't exist
        // This is OK - skip this record and continue
        log(`Skipping ${tableName} record ${item.id}: missing foreign key reference`, 'warning');
        skipped++;
      } else {
        log(`Error copying ${tableName} record ${item.id}: ${error.message}`, 'error');
        throw error;
      }
    }
  }

  log(`Copied ${copied} ${tableName} records (${skipped} skipped)`, 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n═════════════════════════════════════════════════════════════');
  console.log(`  Tenant #${SOURCE_TENANT_ID} Duplication: DEV → PROD`);
  console.log('═════════════════════════════════════════════════════════════');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no changes)' : '⚡ EXECUTE (will make changes)'}`);
  console.log('═════════════════════════════════════════════════════════════\n');

  if (isDryRun) {
    log('DRY RUN MODE: No changes will be made to the database', 'warning');
    log('Review the output, then run with --execute to apply changes\n', 'warning');
  }

  try {
    // Step 1: Ensure tenant exists
    log('\n【 STEP 1: Tenant Setup 】', 'info');
    await ensureTenant();

    // Step 2: Ensure user exists
    log('\n【 STEP 2: User Setup 】', 'info');
    const user = await ensureUser();

    // Step 3: Ensure tenant membership
    log('\n【 STEP 3: Tenant Membership 】', 'info');
    await ensureTenantMembership(user.id);

    // Step 4: Copy Party/Contact data (needed for foreign keys)
    log('\n【 STEP 4: Contacts & Organizations 】', 'info');

    await copyTenantTable('Party', devDb.party, prodDb.party);
    await copyTenantTable('Organization', devDb.organization, prodDb.organization, (item) => {
      const { id, createdAt, updatedAt, partyId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        partyId: mapId('Party', partyId),
      };
    });
    await copyTenantTable('Contact', devDb.contact, prodDb.contact, (item) => {
      const { id, createdAt, updatedAt, partyId, organizationId, ...data } = item as any;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        partyId: mapId('Party', partyId),
        organizationId: mapId('Organization', organizationId),
      };
    });

    // Step 5: Copy Animal data (TWO-PASS: first without parents, then update parents)
    log('\n【 STEP 5: Animals & Related Data 】', 'info');

    // PASS 1: Create all animals WITHOUT parent references
    log('📦 Copying Animal (Pass 1: Creating animals without parents)...', 'info');
    const devAnimals = await devDb.animal.findMany({
      where: { tenantId: SOURCE_TENANT_ID },
    });

    log(`Found ${devAnimals.length} Animal records in dev`);

    if (isDryRun) {
      log(`[DRY RUN] Would copy ${devAnimals.length} Animal records (2-pass)`, 'info');
    } else {
      const animalIdMap = createIdMap('Animal');
      let copied = 0;

      for (const item of devAnimals) {
        const { id, createdAt, updatedAt, damId, sireId, damPartyId, sirePartyId, currentOwnerPartyId, ...data } = item as any;
        const transformedData = {
          ...data,
          tenantId: TARGET_TENANT_ID,
          damId: null, // Temporarily null - will update in pass 2
          sireId: null, // Temporarily null - will update in pass 2
        };

        try {
          const newRecord = await prodDb.animal.create({
            data: transformedData,
          });
          animalIdMap.set(id, newRecord.id);
          copied++;
        } catch (error: any) {
          if (error.code !== 'P2002') {
            log(`Error copying Animal record ${item.id}: ${error.message}`, 'error');
            throw error;
          }
        }
      }

      log(`✅ Created ${copied} Animal records`);

      // PASS 2: Update parent references
      log('\n📦 Copying Animal (Pass 2: Updating parent references)...', 'info');
      let updated = 0;

      for (const item of devAnimals) {
        const newAnimalId = animalIdMap.get(item.id);
        if (!newAnimalId) continue;

        const newDamId = item.damId ? animalIdMap.get(item.damId) : null;
        const newSireId = item.sireId ? animalIdMap.get(item.sireId) : null;

        if (newDamId || newSireId) {
          try {
            await prodDb.animal.update({
              where: { id: newAnimalId },
              data: {
                damId: newDamId,
                sireId: newSireId,
              },
            });
            updated++;
          } catch (error: any) {
            log(`Warning: Could not update parents for animal ${newAnimalId}: ${error.message}`, 'warning');
          }
        }
      }

      log(`✅ Updated ${updated} Animal parent references`);
    }

    await copyTenantTable('AnimalTraitValue', devDb.animalTraitValue, prodDb.animalTraitValue, (item) => {
      const { id, createdAt, updatedAt, animalId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        animalId: mapId('Animal', animalId),
      };
    });

    await copyTenantTable('AnimalTraitEntry', devDb.animalTraitEntry, prodDb.animalTraitEntry, (item) => {
      const { id, createdAt, updatedAt, animalId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        animalId: mapId('Animal', animalId),
      };
    });

    await copyTenantTable('VaccinationRecord', devDb.vaccinationRecord, prodDb.vaccinationRecord, (item) => {
      const { id, createdAt, updatedAt, animalId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        animalId: mapId('Animal', animalId),
      };
    });

    await copyTenantTable('HealthEvent', devDb.healthEvent, prodDb.healthEvent, (item) => {
      const { id, createdAt, updatedAt, animalId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        animalId: mapId('Animal', animalId),
      };
    });

    await copyTenantTable('AnimalTitle', devDb.animalTitle, prodDb.animalTitle, (item) => {
      const { id, createdAt, updatedAt, animalId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        animalId: mapId('Animal', animalId),
      };
    });

    await copyTenantTable('CompetitionEntry', devDb.competitionEntry, prodDb.competitionEntry, (item) => {
      const { id, createdAt, updatedAt, animalId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        animalId: mapId('Animal', animalId),
      };
    });

    // Step 6: Copy Breeding Plans
    log('\n【 STEP 6: Breeding Plans 】', 'info');

    await copyTenantTable('BreedingPlan', devDb.breedingPlan, prodDb.breedingPlan, (item) => {
      const { id, createdAt, updatedAt, damId, sireId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        damId: mapId('Animal', damId),
        sireId: mapId('Animal', sireId),
      };
    });

    await copyTenantTable('BreedingPlanBuyer', devDb.breedingPlanBuyer, prodDb.breedingPlanBuyer, (item) => {
      const { id, createdAt, updatedAt, planId, partyId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        planId: mapId('BreedingPlan', planId),
        partyId: mapId('Party', partyId),
      };
    });

    await copyTenantTable('BreedingPlanEvent', devDb.breedingPlanEvent, prodDb.breedingPlanEvent, (item) => {
      const { id, createdAt, updatedAt, planId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        planId: mapId('BreedingPlan', planId),
      };
    });

    await copyTenantTable('ReproductiveCycle', devDb.reproductiveCycle, prodDb.reproductiveCycle, (item) => {
      const { id, createdAt, updatedAt, planId, ...data } = item as any;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        // Note: planId field removed from schema - excluding it
      };
    });

    await copyTenantTable('BreedingAttempt', devDb.breedingAttempt, prodDb.breedingAttempt, (item) => {
      const { id, createdAt, updatedAt, planId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        planId: mapId('BreedingPlan', planId),
      };
    });

    await copyTenantTable('PregnancyCheck', devDb.pregnancyCheck, prodDb.pregnancyCheck, (item) => {
      const { id, createdAt, updatedAt, planId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        planId: mapId('BreedingPlan', planId),
      };
    });

    // Step 7: Copy Offspring Groups
    log('\n【 STEP 7: Offspring Groups 】', 'info');

    await copyTenantTable('OffspringGroup', devDb.offspringGroup, prodDb.offspringGroup, (item) => {
      const { id, createdAt, updatedAt, planId, damId, sireId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        planId: mapId('BreedingPlan', planId),
        damId: mapId('Animal', damId),
        sireId: mapId('Animal', sireId),
      };
    });

    await copyTenantTable('Offspring', devDb.offspring, prodDb.offspring, (item) => {
      const { id, createdAt, updatedAt, groupId, animalId, ...data } = item as any;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        groupId: mapId('OffspringGroup', groupId),
        // Note: animalId field removed from schema - excluding it
      };
    });

    await copyTenantTable('OffspringGroupBuyer', devDb.offspringGroupBuyer, prodDb.offspringGroupBuyer, (item) => {
      const { id, createdAt, updatedAt, groupId, partyId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        groupId: mapId('OffspringGroup', groupId),
        partyId: mapId('Party', partyId),
      };
    });

    // Step 8: Copy Tags
    log('\n【 STEP 8: Tags 】', 'info');
    await copyTenantTable('Tag', devDb.tag, prodDb.tag);

    // Step 9: Copy Documents & Attachments
    log('\n【 STEP 9: Documents & Attachments 】', 'info');

    await copyTenantTable('Document', devDb.document, prodDb.document, (item) => {
      const { id, createdAt, updatedAt, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
      };
    });

    await copyTenantTable('DocumentBundle', devDb.documentBundle, prodDb.documentBundle, (item) => {
      const { id, createdAt, updatedAt, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
      };
    });

    await copyTenantTable('Attachment', devDb.attachment, prodDb.attachment, (item) => {
      const { id, createdAt, updatedAt, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
      };
    });

    // Step 10: Copy Contracts & Invoices (if needed)
    log('\n【 STEP 10: Contracts & Invoices 】', 'info');

    await copyTenantTable('Contract', devDb.contract, prodDb.contract, (item) => {
      const { id, createdAt, updatedAt, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
      };
    });

    await copyTenantTable('Invoice', devDb.invoice, prodDb.invoice, (item) => {
      const { id, createdAt, updatedAt, partyId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        partyId: mapId('Party', partyId),
      };
    });

    // Step 11: Copy Marketplace Listings (if any)
    log('\n【 STEP 11: Marketplace Listings 】', 'info');

    await copyTenantTable('MktListingIndividualAnimal', devDb.mktListingIndividualAnimal, prodDb.mktListingIndividualAnimal, (item) => {
      const { id, createdAt, updatedAt, animalId, ...data } = item;
      return {
        ...data,
        tenantId: TARGET_TENANT_ID,
        animalId: mapId('Animal', animalId),
      };
    });

    // Success!
    log('\n═════════════════════════════════════════════════════════════', 'success');
    log('✨ Tenant duplication completed successfully!', 'success');
    log('═════════════════════════════════════════════════════════════\n', 'success');

    if (isDryRun) {
      log('This was a DRY RUN. No changes were made.', 'warning');
      log('Run with --execute to apply changes.\n', 'warning');
    } else {
      log(`\n🎉 User ${TARGET_USER_EMAIL} can now log in to PROD with password: ${TARGET_USER_PASSWORD}`, 'success');
      log(`Tenant #${TARGET_TENANT_ID} has been fully duplicated from dev to prod.\n`, 'success');
    }

  } catch (error) {
    log('\n❌ ERROR during duplication:', 'error');
    console.error(error);
    throw error;
  } finally {
    await devDb.$disconnect();
    await prodDb.$disconnect();
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
