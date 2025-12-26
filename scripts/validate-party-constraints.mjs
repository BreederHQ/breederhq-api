#!/usr/bin/env node
/**
 * Step 7: Pre-Constraint Validation Script
 * Purpose: Verify data integrity before adding NOT NULL constraints
 * Date: 2025-12-26
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const results = [];

async function runValidation() {
  console.log('========================================');
  console.log('Step 7: Pre-Constraint Validation');
  console.log('========================================\n');

  // Section 1: Check for NULL values in mandatory columns
  console.log('1. Checking for NULL values in mandatory partyId columns...\n');

  // AnimalOwner.partyId
  const nullAnimalOwners = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "AnimalOwner" WHERE "partyId" IS NULL
  `.then(rows => Number(rows[0].count));
  results.push({
    test: 'AnimalOwner.partyId NULL count',
    passed: nullAnimalOwners === 0,
    count: nullAnimalOwners
  });
  const status1 = nullAnimalOwners === 0 ? '✓ PASS' : '✗ FAIL';
  console.log(`   AnimalOwner.partyId: ${nullAnimalOwners} NULLs ${status1}`);

  // WaitlistEntry.clientPartyId
  const nullWaitlist = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "WaitlistEntry" WHERE "clientPartyId" IS NULL
  `.then(rows => Number(rows[0].count));
  results.push({
    test: 'WaitlistEntry.clientPartyId NULL count',
    passed: nullWaitlist === 0,
    count: nullWaitlist
  });
  const status2 = nullWaitlist === 0 ? '✓ PASS' : '✗ FAIL';
  console.log(`   WaitlistEntry.clientPartyId: ${nullWaitlist} NULLs ${status2}`);

  // OffspringGroupBuyer.buyerPartyId
  const nullGroupBuyers = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "OffspringGroupBuyer" WHERE "buyerPartyId" IS NULL
  `.then(rows => Number(rows[0].count));
  results.push({
    test: 'OffspringGroupBuyer.buyerPartyId NULL count',
    passed: nullGroupBuyers === 0,
    count: nullGroupBuyers
  });
  const status3 = nullGroupBuyers === 0 ? '✓ PASS' : '✗ FAIL';
  console.log(`   OffspringGroupBuyer.buyerPartyId: ${nullGroupBuyers} NULLs ${status3}`);

  // OffspringContract.buyerPartyId
  const nullContracts = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "OffspringContract" WHERE "buyerPartyId" IS NULL
  `.then(rows => Number(rows[0].count));
  results.push({
    test: 'OffspringContract.buyerPartyId NULL count',
    passed: nullContracts === 0,
    count: nullContracts
  });
  const status4 = nullContracts === 0 ? '✓ PASS' : '✗ FAIL';
  console.log(`   OffspringContract.buyerPartyId: ${nullContracts} NULLs ${status4}`);

  // PlanParty.partyId
  const nullPlanParties = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "PlanParty" WHERE "partyId" IS NULL
  `.then(rows => Number(rows[0].count));
  results.push({
    test: 'PlanParty.partyId NULL count',
    passed: nullPlanParties === 0,
    count: nullPlanParties
  });
  const status5 = nullPlanParties === 0 ? '✓ PASS' : '✗ FAIL';
  console.log(`   PlanParty.partyId: ${nullPlanParties} NULLs ${status5}`);

  // Invoice.clientPartyId (non-general scope)
  const nullInvoices = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "Invoice"
    WHERE "clientPartyId" IS NULL AND "scope" != 'general'
  `.then(rows => Number(rows[0].count));
  results.push({
    test: 'Invoice.clientPartyId NULL count (non-general)',
    passed: nullInvoices === 0,
    count: nullInvoices
  });
  const status6 = nullInvoices === 0 ? '✓ PASS' : '✗ FAIL';
  console.log(`   Invoice.clientPartyId (non-general): ${nullInvoices} NULLs ${status6}`);

  console.log('');

  // Section 2: Data coverage statistics
  console.log('2. Party data coverage statistics...\n');

  const totalUsers = await prisma.user.count();
  const usersWithParty = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "User" WHERE "partyId" IS NOT NULL
  `.then(rows => Number(rows[0].count));
  const userCoverage = totalUsers > 0 ? ((usersWithParty / totalUsers) * 100).toFixed(2) : '0.00';
  console.log(`   User.partyId: ${usersWithParty}/${totalUsers} (${userCoverage}%)`);

  const totalWaitlist = await prisma.waitlistEntry.count();
  const waitlistWithParty = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "WaitlistEntry" WHERE "clientPartyId" IS NOT NULL
  `.then(rows => Number(rows[0].count));
  const waitlistCoverage = totalWaitlist > 0 ? ((waitlistWithParty / totalWaitlist) * 100).toFixed(2) : '0.00';
  console.log(`   WaitlistEntry.clientPartyId: ${waitlistWithParty}/${totalWaitlist} (${waitlistCoverage}%)`);

  const totalOffspring = await prisma.offspring.count();
  const offspringWithBuyer = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "Offspring" WHERE "buyerPartyId" IS NOT NULL
  `.then(rows => Number(rows[0].count));
  const offspringCoverage = totalOffspring > 0 ? ((offspringWithBuyer / totalOffspring) * 100).toFixed(2) : '0.00';
  console.log(`   Offspring.buyerPartyId: ${offspringWithBuyer}/${totalOffspring} (${offspringCoverage}%)`);

  const totalInvoices = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "Invoice" WHERE "scope" != 'general'
  `.then(rows => Number(rows[0].count));
  const invoicesWithClient = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "Invoice"
    WHERE "clientPartyId" IS NOT NULL AND "scope" != 'general'
  `.then(rows => Number(rows[0].count));
  const invoiceCoverage = totalInvoices > 0 ? ((invoicesWithClient / totalInvoices) * 100).toFixed(2) : '0.00';
  console.log(`   Invoice.clientPartyId (non-general): ${invoicesWithClient}/${totalInvoices} (${invoiceCoverage}%)`);

  const totalAnimals = await prisma.animal.count();
  const animalsWithBuyer = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "Animal" WHERE "buyerPartyId" IS NOT NULL
  `.then(rows => Number(rows[0].count));
  const animalCoverage = totalAnimals > 0 ? ((animalsWithBuyer / totalAnimals) * 100).toFixed(2) : '0.00';
  console.log(`   Animal.buyerPartyId: ${animalsWithBuyer}/${totalAnimals} (${animalCoverage}%)`);

  const totalAnimalOwners = await prisma.animalOwner.count();
  const ownersWithParty = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "AnimalOwner" WHERE "partyId" IS NOT NULL
  `.then(rows => Number(rows[0].count));
  const ownerCoverage = totalAnimalOwners > 0 ? ((ownersWithParty / totalAnimalOwners) * 100).toFixed(2) : '0.00';
  console.log(`   AnimalOwner.partyId: ${ownersWithParty}/${totalAnimalOwners} (${ownerCoverage}%)`);

  console.log('');

  // Section 3: Summary
  console.log('========================================');
  console.log('Validation Summary');
  console.log('========================================\n');

  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  const allPassed = passedTests === totalTests;

  console.log(`Tests Passed: ${passedTests}/${totalTests}`);
  const statusMsg = allPassed ? '✓ ALL PASS - Ready for constraints' : '✗ SOME FAILURES - Fix data before proceeding';
  console.log(`Status: ${statusMsg}\n`);

  if (!allPassed) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.test}: ${r.count} issue(s)`);
    });
    console.log('');
  }

  return allPassed;
}

runValidation()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error running validation:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
