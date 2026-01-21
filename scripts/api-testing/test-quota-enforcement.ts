/**
 * Test script for quota enforcement on animals route
 *
 * Tests:
 * 1. Create subscription with Pro plan (50 animal limit)
 * 2. Initialize usage snapshot
 * 3. Verify quota limit is correctly set
 * 4. Create animals up to limit
 * 5. Verify quota exceeded error on 51st animal
 * 6. Delete one animal and verify can create again
 * 7. Test with add-on (+10 animals)
 * 8. Test with Enterprise (unlimited)
 */

import prisma from '../src/prisma.js';
import {
  updateUsageSnapshot,
  getCurrentUsage,
  canAddResource,
  calculateActualUsage,
} from '../src/services/subscription/usage-service.js';
import {
  getQuotaLimit,
  checkEntitlement,
} from '../src/services/subscription/entitlement-service.js';

let TEST_TENANT_ID: number; // Will be set after tenant creation
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function success(message: string) {
  log(`✓ ${message}`, COLORS.green);
}

function error(message: string) {
  log(`✗ ${message}`, COLORS.red);
}

function info(message: string) {
  log(`ℹ ${message}`, COLORS.cyan);
}

function section(title: string) {
  log(`\n${COLORS.bright}${title}${COLORS.reset}`);
  log('='.repeat(title.length));
}

async function cleanup() {
  if (!TEST_TENANT_ID) {
    info('No tenant to clean up');
    return;
  }

  section('Cleaning up test data');

  // Delete in correct order due to foreign key constraints
  await prisma.animal.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.usageSnapshot.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.subscriptionAddOn.deleteMany({
    where: { subscription: { tenantId: TEST_TENANT_ID } }
  });
  await prisma.subscription.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.organization.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.party.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } });

  success('Test data cleaned up');
}

async function setup() {
  section('Setting up test tenant and subscription');

  // Create test tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Test Quota Tenant',
      slug: `test-quota-${Date.now()}`,
    },
  });

  // Store the generated tenant ID for cleanup and other tests
  TEST_TENANT_ID = tenant.id;
  success(`Created tenant: ${tenant.name} (ID: ${TEST_TENANT_ID})`);

  // Create organization (required for animal ownership)
  const party = await prisma.party.create({
    data: {
      tenantId: TEST_TENANT_ID,
      type: 'ORGANIZATION',
      name: 'Test Breeder Organization',
    },
  });

  await prisma.organization.create({
    data: {
      tenantId: TEST_TENANT_ID,
      partyId: party.id,
      name: 'Test Breeder Organization',
    },
  });
  success('Created organization for test tenant');

  // Get Pro Monthly product
  const proProduct = await prisma.product.findFirst({
    where: { name: 'BreederHQ Pro (Monthly)' },
  });

  if (!proProduct) {
    throw new Error('Pro product not found. Run: npm run db:dev:seed:products');
  }

  // Create subscription
  const subscription = await prisma.subscription.create({
    data: {
      tenantId: TEST_TENANT_ID,
      productId: proProduct.id,
      status: 'ACTIVE',
      amountCents: 3900,
      currency: 'USD',
      billingInterval: 'MONTHLY',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });
  success(`Created subscription: ${proProduct.name}`);

  return { tenant, subscription };
}

async function testQuotaLimit() {
  section('Test 1: Verify Quota Limit');

  const limit = await getQuotaLimit(TEST_TENANT_ID, 'ANIMAL_QUOTA');

  if (limit === 50) {
    success(`Quota limit is correctly set to 50 animals`);
  } else {
    error(`Quota limit is ${limit}, expected 50`);
    throw new Error('Quota limit test failed');
  }

  const entitlement = await checkEntitlement(TEST_TENANT_ID, 'ANIMAL_QUOTA');
  info(`Entitlement check: hasAccess=${entitlement.hasAccess}, limit=${entitlement.limitValue}`);
}

async function testInitialUsage() {
  section('Test 2: Initialize Usage Snapshot');

  await updateUsageSnapshot(TEST_TENANT_ID, 'ANIMAL_COUNT');
  success('Usage snapshot initialized');

  const usage = await getCurrentUsage(TEST_TENANT_ID, 'ANIMAL_COUNT');
  if (usage === 0) {
    success(`Current usage is 0 animals`);
  } else {
    error(`Current usage is ${usage}, expected 0`);
    throw new Error('Initial usage test failed');
  }
}

async function createAnimal(name: string): Promise<number> {
  const animal = await prisma.animal.create({
    data: {
      tenantId: TEST_TENANT_ID,
      name,
      species: 'DOG',
      sex: 'MALE',
      status: 'ACTIVE',
    },
  });
  return animal.id;
}

async function testCreateAnimalsUpToLimit() {
  section('Test 3: Create Animals Up To Limit (50)');

  info('Creating 50 animals...');
  const animalIds: number[] = [];

  for (let i = 1; i <= 50; i++) {
    const canAdd = await canAddResource(TEST_TENANT_ID, 'ANIMAL_COUNT', 1);

    if (!canAdd) {
      error(`canAddResource returned false at animal ${i}/50`);
      throw new Error('Should be able to add animals up to limit');
    }

    const id = await createAnimal(`Test Dog ${i}`);
    animalIds.push(id);

    // Update snapshot after creation
    await updateUsageSnapshot(TEST_TENANT_ID, 'ANIMAL_COUNT');

    if (i % 10 === 0) {
      info(`  Created ${i}/50 animals...`);
    }
  }

  success(`Created 50 animals successfully`);

  const usage = await getCurrentUsage(TEST_TENANT_ID, 'ANIMAL_COUNT');
  if (usage === 50) {
    success(`Current usage is now 50/50`);
  } else {
    error(`Current usage is ${usage}, expected 50`);
    throw new Error('Usage count incorrect');
  }

  return animalIds;
}

async function testQuotaExceeded() {
  section('Test 4: Verify Quota Exceeded (51st animal)');

  const canAdd = await canAddResource(TEST_TENANT_ID, 'ANIMAL_COUNT', 1);

  if (!canAdd) {
    success('canAddResource correctly returns false when at limit');
  } else {
    error('canAddResource returned true, should be false at limit');
    throw new Error('Quota exceeded test failed');
  }

  info('Attempting to create 51st animal (should fail in actual API)...');
  // Note: We're bypassing the middleware here, so we won't get the 403 error
  // In a real API request, the middleware would block this
  info('(In real API request, middleware would return 403 QUOTA_EXCEEDED)');
}

async function testDeleteAndRecreate(animalIds: number[]) {
  section('Test 5: Delete Animal and Create New One');

  const animalToDelete = animalIds[0];
  await prisma.animal.delete({ where: { id: animalToDelete } });
  success(`Deleted animal ID ${animalToDelete}`);

  await updateUsageSnapshot(TEST_TENANT_ID, 'ANIMAL_COUNT');

  const usageAfterDelete = await getCurrentUsage(TEST_TENANT_ID, 'ANIMAL_COUNT');
  if (usageAfterDelete === 49) {
    success(`Current usage after delete: 49/50`);
  } else {
    error(`Current usage is ${usageAfterDelete}, expected 49`);
    throw new Error('Usage not updated after delete');
  }

  const canAdd = await canAddResource(TEST_TENANT_ID, 'ANIMAL_COUNT', 1);
  if (canAdd) {
    success('canAddResource returns true after deleting one animal');
  } else {
    error('canAddResource returned false, should be true');
    throw new Error('Should be able to add after delete');
  }

  const newId = await createAnimal('Test Dog Replacement');
  await updateUsageSnapshot(TEST_TENANT_ID, 'ANIMAL_COUNT');
  success(`Created new animal ID ${newId}`);

  const finalUsage = await getCurrentUsage(TEST_TENANT_ID, 'ANIMAL_COUNT');
  if (finalUsage === 50) {
    success(`Back to 50/50 animals`);
  } else {
    error(`Current usage is ${finalUsage}, expected 50`);
    throw new Error('Usage count incorrect after recreate');
  }
}

async function testWithAddOn() {
  section('Test 6: Add "+10 Animal Slots" Add-On');

  // Get add-on product
  const addOnProduct = await prisma.product.findFirst({
    where: { name: '+10 Animal Slots' },
  });

  if (!addOnProduct) {
    error('Add-on product not found');
    throw new Error('Add-on product not found. Run: npm run db:dev:seed:products');
  }

  // Get subscription
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId: TEST_TENANT_ID },
  });

  if (!subscription) {
    error('Subscription not found');
    throw new Error('Subscription not found');
  }

  // Add add-on to subscription
  await prisma.subscriptionAddOn.create({
    data: {
      subscriptionId: subscription.id,
      productId: addOnProduct.id,
      quantity: 1,
      amountCents: addOnProduct.priceUSD,
    },
  });
  success('Added "+10 Animal Slots" add-on to subscription');

  // Check new limit
  const newLimit = await getQuotaLimit(TEST_TENANT_ID, 'ANIMAL_QUOTA');
  if (newLimit === 60) {
    success(`New limit: 60 animals (50 base + 10 add-on)`);
  } else {
    error(`New limit is ${newLimit}, expected 60`);
    throw new Error('Add-on quota not added correctly');
  }

  // Update snapshot with new limit
  await updateUsageSnapshot(TEST_TENANT_ID, 'ANIMAL_COUNT');

  // Verify can add more animals
  const canAdd = await canAddResource(TEST_TENANT_ID, 'ANIMAL_COUNT', 10);
  if (canAdd) {
    success('Can now add 10 more animals');
  } else {
    error('Cannot add 10 more animals');
    throw new Error('Should be able to add 10 more animals');
  }

  // Create 10 more animals
  info('Creating 10 more animals...');
  for (let i = 51; i <= 60; i++) {
    await createAnimal(`Test Dog ${i}`);
  }
  await updateUsageSnapshot(TEST_TENANT_ID, 'ANIMAL_COUNT');

  const usage = await getCurrentUsage(TEST_TENANT_ID, 'ANIMAL_COUNT');
  if (usage === 60) {
    success(`Created 10 more animals, now at 60/60`);
  } else {
    error(`Current usage is ${usage}, expected 60`);
    throw new Error('Usage count incorrect');
  }

  // Verify at new limit
  const canAddMore = await canAddResource(TEST_TENANT_ID, 'ANIMAL_COUNT', 1);
  if (!canAddMore) {
    success('Now at new limit, cannot add more');
  } else {
    error('Should not be able to add more at 60/60');
    throw new Error('Quota check failed at new limit');
  }
}

async function testEnterpriseUnlimited() {
  section('Test 7: Upgrade to Enterprise (Unlimited)');

  // Get Enterprise product
  const enterpriseProduct = await prisma.product.findFirst({
    where: { name: 'BreederHQ Enterprise (Monthly)' },
  });

  if (!enterpriseProduct) {
    error('Enterprise product not found');
    throw new Error('Enterprise product not found. Run: npm run db:dev:seed:products');
  }

  // Update subscription to Enterprise
  await prisma.subscription.updateMany({
    where: { tenantId: TEST_TENANT_ID },
    data: {
      productId: enterpriseProduct.id,
      amountCents: 9900,
    },
  });
  success('Upgraded to Enterprise plan');

  // Check new limit (should be null = unlimited)
  const newLimit = await getQuotaLimit(TEST_TENANT_ID, 'ANIMAL_QUOTA');
  if (newLimit === null) {
    success('Limit is now unlimited (null)');
  } else {
    error(`Limit is ${newLimit}, expected null (unlimited)`);
    throw new Error('Enterprise unlimited quota not working');
  }

  // Update snapshot with new limit
  await updateUsageSnapshot(TEST_TENANT_ID, 'ANIMAL_COUNT');

  // Verify can add many animals
  const canAdd = await canAddResource(TEST_TENANT_ID, 'ANIMAL_COUNT', 1000);
  if (canAdd) {
    success('Can add unlimited animals');
  } else {
    error('Should be able to add unlimited animals');
    throw new Error('Unlimited quota check failed');
  }

  // Create a few more to verify
  info('Creating 10 more animals to verify unlimited...');
  for (let i = 61; i <= 70; i++) {
    await createAnimal(`Test Dog ${i}`);
  }
  await updateUsageSnapshot(TEST_TENANT_ID, 'ANIMAL_COUNT');

  const usage = await getCurrentUsage(TEST_TENANT_ID, 'ANIMAL_COUNT');
  if (usage === 70) {
    success(`Created 10 more animals, now at 70 (unlimited)`);
  } else {
    error(`Current usage is ${usage}, expected 70`);
    throw new Error('Usage count incorrect');
  }

  const stillCanAdd = await canAddResource(TEST_TENANT_ID, 'ANIMAL_COUNT', 1000);
  if (stillCanAdd) {
    success('Still can add unlimited animals');
  } else {
    error('Should still be able to add unlimited');
    throw new Error('Unlimited quota check failed');
  }
}

async function testActualUsageCalculation() {
  section('Test 8: Verify Actual Usage Calculation');

  const snapshotUsage = await getCurrentUsage(TEST_TENANT_ID, 'ANIMAL_COUNT');
  const actualUsage = await calculateActualUsage(TEST_TENANT_ID, 'ANIMAL_COUNT');

  if (snapshotUsage === actualUsage) {
    success(`Snapshot (${snapshotUsage}) matches actual count (${actualUsage})`);
  } else {
    error(`Snapshot (${snapshotUsage}) does NOT match actual (${actualUsage})`);
    throw new Error('Snapshot out of sync with actual count');
  }

  info('Testing snapshot refresh...');
  await updateUsageSnapshot(TEST_TENANT_ID, 'ANIMAL_COUNT');
  const refreshedUsage = await getCurrentUsage(TEST_TENANT_ID, 'ANIMAL_COUNT');

  if (refreshedUsage === actualUsage) {
    success('Snapshot refresh works correctly');
  } else {
    error('Snapshot refresh failed');
    throw new Error('Snapshot refresh failed');
  }
}

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    section('🧪 Quota Enforcement Test Suite');
    info(`Testing with tenant ID: ${TEST_TENANT_ID}\n`);

    // Cleanup any existing test data
    await cleanup();

    // Setup
    await setup();

    // Run tests
    await testQuotaLimit();
    testsPassed++;

    await testInitialUsage();
    testsPassed++;

    const animalIds = await testCreateAnimalsUpToLimit();
    testsPassed++;

    await testQuotaExceeded();
    testsPassed++;

    await testDeleteAndRecreate(animalIds);
    testsPassed++;

    await testWithAddOn();
    testsPassed++;

    await testEnterpriseUnlimited();
    testsPassed++;

    await testActualUsageCalculation();
    testsPassed++;

    section('Test Summary');
    success(`All ${testsPassed} tests passed! 🎉`);

  } catch (err: any) {
    testsFailed++;
    error(`\nTest failed: ${err.message}`);
    console.error(err);
    section('Test Summary');
    error(`${testsPassed} tests passed, ${testsFailed} tests failed`);
    process.exit(1);
  } finally {
    // Cleanup
    await cleanup();
    await prisma.$disconnect();
  }
}

// Run tests
runTests().catch(console.error);
