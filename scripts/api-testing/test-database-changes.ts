/**
 * Automated Database Validation Script
 * Tests Phase 1 & Phase 2 database changes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDatabaseChanges() {
  console.log('🔍 Testing Database Changes...\n');

  let passed = 0;
  let failed = 0;

  // Helper to run tests
  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.error(`❌ ${name}`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  };

  // ============================================================================
  // PHASE 1 TESTS: Critical Production Fixes
  // ============================================================================

  await test('BigInt columns exist on Invoice', async () => {
    // Try to create an invoice with large amounts
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error('No tenant found for testing');

    const invoice = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        invoiceNumber: `TEST-${Date.now()}`,
        amountCents: BigInt('999999999999'), // Much larger than INT max
        balanceCents: BigInt('999999999999'),
        status: 'draft',
        issuedAt: new Date(),
        scope: 'general', // Required field
      },
    });

    // Clean up
    await prisma.invoice.delete({ where: { id: invoice.id } });

    if (typeof invoice.amountCents !== 'bigint') {
      throw new Error('amountCents is not BigInt');
    }
  });

  await test('Soft delete columns exist on Invoice', async () => {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error('No tenant found for testing');

    const invoice = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        invoiceNumber: `TEST-SD-${Date.now()}`,
        amountCents: 10000,
        balanceCents: 10000,
        status: 'draft',
        issuedAt: new Date(),
        deletedAt: new Date(), // Should accept deletedAt
        scope: 'general', // Required field
      },
    });

    await prisma.invoice.delete({ where: { id: invoice.id } });

    if (!invoice.hasOwnProperty('deletedAt')) {
      throw new Error('deletedAt column missing');
    }
  });

  await test('Soft delete columns exist on Contact', async () => {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error('No tenant found for testing');

    const contact = await prisma.contact.create({
      data: {
        tenantId: tenant.id,
        display_name: 'Test Contact',
        deletedAt: new Date(),
      },
    });

    await prisma.contact.delete({ where: { id: contact.id } });

    if (!contact.hasOwnProperty('deletedAt')) {
      throw new Error('deletedAt column missing');
    }
  });

  await test('Marketplace fields exist on Tenant', async () => {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error('No tenant found for testing');

    if (!tenant.hasOwnProperty('marketplacePaymentMode')) {
      throw new Error('marketplacePaymentMode missing');
    }
    if (!tenant.hasOwnProperty('stripeConnectAccountId')) {
      throw new Error('stripeConnectAccountId missing');
    }
  });

  await test('Marketplace fields exist on Invoice', async () => {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error('No tenant found for testing');

    const invoice = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        invoiceNumber: `TEST-MP-${Date.now()}`,
        amountCents: 10000,
        balanceCents: 10000,
        status: 'draft',
        issuedAt: new Date(),
        isMarketplaceInvoice: true,
        paymentModeSnapshot: 'manual',
        refundedCents: 0,
        scope: 'general', // Required field
      },
    });

    await prisma.invoice.delete({ where: { id: invoice.id } });

    if (!invoice.hasOwnProperty('isMarketplaceInvoice')) {
      throw new Error('isMarketplaceInvoice missing');
    }
  });

  await test('Marketplace fields exist on Contact', async () => {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error('No tenant found for testing');

    const contact = await prisma.contact.create({
      data: {
        tenantId: tenant.id,
        display_name: 'Test Marketplace Contact',
        marketplaceTotalTransactions: 5,
        marketplaceTotalSpentCents: BigInt('50000'),
      },
    });

    await prisma.contact.delete({ where: { id: contact.id } });

    if (!contact.hasOwnProperty('marketplaceTotalTransactions')) {
      throw new Error('marketplaceTotalTransactions missing');
    }
  });

  // ============================================================================
  // PHASE 2 TESTS: Marketplace Schema
  // ============================================================================

  await test('MarketplaceUser table exists and works', async () => {
    const user = await prisma.marketplaceUser.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'test_hash',
        firstName: 'Test',
        lastName: 'User',
        userType: 'buyer',
      },
    });

    await prisma.marketplaceUser.delete({ where: { id: user.id } });
  });

  await test('MarketplaceProvider table exists and works', async () => {
    const user = await prisma.marketplaceUser.create({
      data: {
        email: `provider-${Date.now()}@example.com`,
        passwordHash: 'test_hash',
        userType: 'breeder',
      },
    });

    const provider = await prisma.marketplaceProvider.create({
      data: {
        userId: user.id,
        providerType: 'breeder',
        businessName: 'Test Breeder',
        paymentMode: 'manual',
      },
    });

    await prisma.marketplaceProvider.delete({ where: { id: provider.id } });
    await prisma.marketplaceUser.delete({ where: { id: user.id } });
  });

  await test('MarketplaceServiceListing table exists and works', async () => {
    const user = await prisma.marketplaceUser.create({
      data: {
        email: `listing-${Date.now()}@example.com`,
        passwordHash: 'test_hash',
      },
    });

    const provider = await prisma.marketplaceProvider.create({
      data: {
        userId: user.id,
        providerType: 'service_provider',
        businessName: 'Test Service',
        paymentMode: 'manual',
      },
    });

    const listing = await prisma.marketplaceServiceListing.create({
      data: {
        providerId: provider.id,
        slug: `test-listing-${Date.now()}`,
        title: 'Test Listing',
        category: 'boarding',
        status: 'draft',
      },
    });

    await prisma.marketplaceServiceListing.delete({ where: { id: listing.id } });
    await prisma.marketplaceProvider.delete({ where: { id: provider.id } });
    await prisma.marketplaceUser.delete({ where: { id: user.id } });
  });

  await test('MarketplaceTransaction table exists and works', async () => {
    const client = await prisma.marketplaceUser.create({
      data: {
        email: `client-${Date.now()}@example.com`,
        passwordHash: 'test_hash',
      },
    });

    const providerUser = await prisma.marketplaceUser.create({
      data: {
        email: `provider-tx-${Date.now()}@example.com`,
        passwordHash: 'test_hash',
      },
    });

    const provider = await prisma.marketplaceProvider.create({
      data: {
        userId: providerUser.id,
        providerType: 'breeder',
        businessName: 'Test Breeder',
        paymentMode: 'manual',
      },
    });

    const transaction = await prisma.marketplaceTransaction.create({
      data: {
        clientId: client.id,
        providerId: provider.id,
        serviceDescription: 'Test Service',
        invoiceType: 'marketplace',
        invoiceId: 1,
        totalCents: 50000,
        status: 'pending_invoice',
      },
    });

    await prisma.marketplaceTransaction.delete({ where: { id: transaction.id } });
    await prisma.marketplaceProvider.delete({ where: { id: provider.id } });
    await prisma.marketplaceUser.delete({ where: { id: providerUser.id } });
    await prisma.marketplaceUser.delete({ where: { id: client.id } });
  });

  await test('MarketplaceInvoice table exists and works', async () => {
    const client = await prisma.marketplaceUser.create({
      data: {
        email: `client-inv-${Date.now()}@example.com`,
        passwordHash: 'test_hash',
      },
    });

    const providerUser = await prisma.marketplaceUser.create({
      data: {
        email: `provider-inv-${Date.now()}@example.com`,
        passwordHash: 'test_hash',
      },
    });

    const provider = await prisma.marketplaceProvider.create({
      data: {
        userId: providerUser.id,
        providerType: 'breeder',
        businessName: 'Test Breeder',
        paymentMode: 'manual',
      },
    });

    const transaction = await prisma.marketplaceTransaction.create({
      data: {
        clientId: client.id,
        providerId: provider.id,
        serviceDescription: 'Test Service',
        invoiceType: 'marketplace',
        invoiceId: 1,
        totalCents: 50000,
        status: 'pending_invoice',
      },
    });

    const invoice = await prisma.marketplaceInvoice.create({
      data: {
        transactionId: transaction.id,
        providerId: provider.id,
        clientId: client.id,
        invoiceNumber: `MP-TEST-${Date.now()}`,
        totalCents: 50000,
        balanceCents: 50000,
        paymentMode: 'manual',
        status: 'draft',
      },
    });

    await prisma.marketplaceInvoice.delete({ where: { id: invoice.id } });
    await prisma.marketplaceTransaction.delete({ where: { id: transaction.id } });
    await prisma.marketplaceProvider.delete({ where: { id: provider.id } });
    await prisma.marketplaceUser.delete({ where: { id: providerUser.id } });
    await prisma.marketplaceUser.delete({ where: { id: client.id } });
  });

  await test('MarketplaceMessageThread table exists and works', async () => {
    const client = await prisma.marketplaceUser.create({
      data: {
        email: `client-msg-${Date.now()}@example.com`,
        passwordHash: 'test_hash',
      },
    });

    const providerUser = await prisma.marketplaceUser.create({
      data: {
        email: `provider-msg-${Date.now()}@example.com`,
        passwordHash: 'test_hash',
      },
    });

    const provider = await prisma.marketplaceProvider.create({
      data: {
        userId: providerUser.id,
        providerType: 'breeder',
        businessName: 'Test Breeder',
        paymentMode: 'manual',
      },
    });

    const thread = await prisma.marketplaceMessageThread.create({
      data: {
        clientId: client.id,
        providerId: provider.id,
        subject: 'Test Thread',
        status: 'active',
      },
    });

    await prisma.marketplaceMessageThread.delete({ where: { id: thread.id } });
    await prisma.marketplaceProvider.delete({ where: { id: provider.id } });
    await prisma.marketplaceUser.delete({ where: { id: providerUser.id } });
    await prisma.marketplaceUser.delete({ where: { id: client.id } });
  });

  await test('MarketplaceMessage table exists and works', async () => {
    const client = await prisma.marketplaceUser.create({
      data: {
        email: `client-msg2-${Date.now()}@example.com`,
        passwordHash: 'test_hash',
      },
    });

    const providerUser = await prisma.marketplaceUser.create({
      data: {
        email: `provider-msg2-${Date.now()}@example.com`,
        passwordHash: 'test_hash',
      },
    });

    const provider = await prisma.marketplaceProvider.create({
      data: {
        userId: providerUser.id,
        providerType: 'breeder',
        businessName: 'Test Breeder',
        paymentMode: 'manual',
      },
    });

    const thread = await prisma.marketplaceMessageThread.create({
      data: {
        clientId: client.id,
        providerId: provider.id,
        subject: 'Test Thread',
        status: 'active',
      },
    });

    const message = await prisma.marketplaceMessage.create({
      data: {
        threadId: thread.id,
        senderId: client.id,
        messageText: 'Test message',
      },
    });

    await prisma.marketplaceMessage.delete({ where: { id: message.id } });
    await prisma.marketplaceMessageThread.delete({ where: { id: thread.id } });
    await prisma.marketplaceProvider.delete({ where: { id: provider.id } });
    await prisma.marketplaceUser.delete({ where: { id: providerUser.id } });
    await prisma.marketplaceUser.delete({ where: { id: client.id } });
  });

  // ============================================================================
  // CROSS-SCHEMA TESTS
  // ============================================================================

  await test('Cross-schema foreign keys work (marketplace → public)', async () => {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error('No tenant found for testing');

    const user = await prisma.marketplaceUser.create({
      data: {
        email: `cross-schema-${Date.now()}@example.com`,
        passwordHash: 'test_hash',
        tenantId: tenant.id, // Foreign key to public.Tenant
        tenantVerified: true,
      },
    });

    await prisma.marketplaceUser.delete({ where: { id: user.id } });
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 All database changes validated successfully!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review errors above.');
    process.exit(1);
  }
}

testDatabaseChanges()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
