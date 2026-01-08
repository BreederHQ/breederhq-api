/**
 * Test script for Usage API endpoints
 *
 * Tests:
 * 1. GET /api/v1/usage - Get all usage metrics
 * 2. GET /api/v1/usage/:metricKey - Get specific metric
 */

import prisma from '../src/prisma.js';
import {
  updateUsageSnapshot,
  getAllUsageStatuses,
  getUsageStatus,
} from '../src/services/subscription/usage-service.js';
import {
  checkEntitlement,
} from '../src/services/subscription/entitlement-service.js';

let TEST_TENANT_ID: number;
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

  await prisma.animal.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.party.deleteMany({ where: { tenantId: TEST_TENANT_ID, type: 'CONTACT' } });
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
      name: 'Test Usage API Tenant',
      slug: `test-usage-api-${Date.now()}`,
    },
  });

  TEST_TENANT_ID = tenant.id;
  success(`Created tenant: ${tenant.name} (ID: ${TEST_TENANT_ID})`);

  // Create organization
  const party = await prisma.party.create({
    data: {
      tenantId: TEST_TENANT_ID,
      type: 'ORGANIZATION',
      name: 'Test Organization',
    },
  });

  await prisma.organization.create({
    data: {
      tenantId: TEST_TENANT_ID,
      partyId: party.id,
      name: 'Test Organization',
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
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  success(`Created subscription: ${proProduct.name}`);

  return { tenant, subscription };
}

async function testGetAllUsageStatuses() {
  section('Test 1: Get All Usage Statuses');

  // Create some test data
  await prisma.animal.create({
    data: {
      tenantId: TEST_TENANT_ID,
      name: 'Test Dog',
      species: 'DOG',
      sex: 'MALE',
      status: 'ACTIVE',
    },
  });

  await prisma.party.create({
    data: {
      tenantId: TEST_TENANT_ID,
      type: 'CONTACT',
      name: 'Test Contact',
    },
  });

  // Update snapshots
  await updateUsageSnapshot(TEST_TENANT_ID, 'ANIMAL_COUNT');
  await updateUsageSnapshot(TEST_TENANT_ID, 'CONTACT_COUNT');

  // Get all statuses
  const statuses = await getAllUsageStatuses(TEST_TENANT_ID);

  info(`Found ${statuses.length} usage metrics`);

  for (const status of statuses) {
    const limitStr = status.limit === null ? 'unlimited' : status.limit;
    const percentStr = status.percentUsed !== null ? `${Math.round(status.percentUsed)}%` : 'N/A';
    info(`  ${status.metricKey}: ${status.currentValue}/${limitStr} (${percentStr})`);
  }

  // Verify animals
  const animalStatus = statuses.find(s => s.metricKey === 'ANIMAL_COUNT');
  if (animalStatus && animalStatus.currentValue === 1 && animalStatus.limit === 50) {
    success('Animal usage: 1/50 ✓');
  } else {
    error(`Animal usage incorrect: ${animalStatus?.currentValue}/${animalStatus?.limit}`);
    throw new Error('Animal usage test failed');
  }

  // Verify contacts
  const contactStatus = statuses.find(s => s.metricKey === 'CONTACT_COUNT');
  if (contactStatus && contactStatus.currentValue === 1 && contactStatus.limit === 500) {
    success('Contact usage: 1/500 ✓');
  } else {
    error(`Contact usage incorrect: ${contactStatus?.currentValue}/${contactStatus?.limit}`);
    throw new Error('Contact usage test failed');
  }
}

async function testGetSpecificMetric() {
  section('Test 2: Get Specific Metric (Animals)');

  const status = await getUsageStatus(TEST_TENANT_ID, 'ANIMAL_COUNT');

  info(`Metric: ANIMAL_COUNT`);
  info(`  Current: ${status.currentValue}`);
  info(`  Limit: ${status.limit}`);
  info(`  Percent Used: ${status.percentUsed?.toFixed(1)}%`);
  info(`  Over Limit: ${status.isOverLimit}`);

  if (status.currentValue === 1 && status.limit === 50) {
    success('Animal metric data is correct');
  } else {
    error('Animal metric data is incorrect');
    throw new Error('Specific metric test failed');
  }
}

async function testEntitlementCheck() {
  section('Test 3: Check Entitlements');

  const animalQuota = await checkEntitlement(TEST_TENANT_ID, 'ANIMAL_QUOTA');
  info(`ANIMAL_QUOTA entitlement:`);
  info(`  Has Access: ${animalQuota.hasAccess}`);
  info(`  Limit Value: ${animalQuota.limitValue}`);

  if (animalQuota.hasAccess && animalQuota.limitValue === 50) {
    success('Entitlement check successful');
  } else {
    error('Entitlement check failed');
    throw new Error('Entitlement test failed');
  }

  const contactQuota = await checkEntitlement(TEST_TENANT_ID, 'CONTACT_QUOTA');
  info(`CONTACT_QUOTA entitlement:`);
  info(`  Has Access: ${contactQuota.hasAccess}`);
  info(`  Limit Value: ${contactQuota.limitValue}`);

  if (contactQuota.hasAccess && contactQuota.limitValue === 500) {
    success('Contact entitlement check successful');
  } else {
    error('Contact entitlement check failed');
    throw new Error('Contact entitlement test failed');
  }
}

async function testUsageWarnings() {
  section('Test 4: Usage Warnings (High Usage)');

  // Create animals to reach 90%+ usage
  info('Creating 45 animals (90% of 50 limit)...');
  for (let i = 2; i <= 45; i++) {
    await prisma.animal.create({
      data: {
        tenantId: TEST_TENANT_ID,
        name: `Test Dog ${i}`,
        species: 'DOG',
        sex: 'MALE',
        status: 'ACTIVE',
      },
    });
  }

  await updateUsageSnapshot(TEST_TENANT_ID, 'ANIMAL_COUNT');

  const status = await getUsageStatus(TEST_TENANT_ID, 'ANIMAL_COUNT');

  info(`Usage: ${status.currentValue}/${status.limit} (${status.percentUsed?.toFixed(1)}%)`);

  if (status.percentUsed && status.percentUsed >= 90) {
    success(`High usage detected: ${Math.round(status.percentUsed)}% - warnings should appear`);
  } else {
    error('High usage test failed');
    throw new Error('Usage warnings test failed');
  }
}

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    section('🧪 Usage API Test Suite');
    info(`Testing with tenant ID: ${TEST_TENANT_ID || 'TBD'}\n`);

    await cleanup();
    await setup();

    await testGetAllUsageStatuses();
    testsPassed++;

    await testGetSpecificMetric();
    testsPassed++;

    await testEntitlementCheck();
    testsPassed++;

    await testUsageWarnings();
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
    await cleanup();
    await prisma.$disconnect();
  }
}

runTests().catch(console.error);
