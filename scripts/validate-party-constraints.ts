#!/usr/bin/env node
/**
 * Step 7: Pre-Constraint Validation Script
 * Purpose: Verify data integrity before adding NOT NULL constraints
 * Date: 2025-12-26
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ValidationResult {
  test: string;
  passed: boolean;
  count?: number;
  details?: string;
}

const results: ValidationResult[] = [];

async function runValidation() {
  console.log('========================================');
  console.log('Step 7: Pre-Constraint Validation');
  console.log('========================================\n');

  // Section 1: Check for NULL values in mandatory columns
  console.log('1. Checking for NULL values in mandatory partyId columns...\n');

  // AnimalOwner.partyId
  const nullAnimalOwners = await prisma.animalOwner.count({
    where: { partyId: null }
  });
  results.push({
    test: 'AnimalOwner.partyId NULL count',
    passed: nullAnimalOwners === 0,
    count: nullAnimalOwners
  });
  console.log(`   AnimalOwner.partyId: ${nullAnimalOwners} NULLs ${nullAnimalOwners === 0 ? '✓ PASS' : '✗ FAIL'}`);

  // WaitlistEntry.clientPartyId
  const nullWaitlist = await prisma.waitlistEntry.count({
    where: { clientPartyId: null }
  });
  results.push({
    test: 'WaitlistEntry.clientPartyId NULL count',
    passed: nullWaitlist === 0,
    count: nullWaitlist
  });
  console.log(`   WaitlistEntry.clientPartyId: ${nullWaitlist} NULLs ${nullWaitlist === 0 ? '✓ PASS' : '✗ FAIL'}`);

  // OffspringGroupBuyer.buyerPartyId
  const nullGroupBuyers = await prisma.offspringGroupBuyer.count({
    where: { buyerPartyId: null }
  });
  results.push({
    test: 'OffspringGroupBuyer.buyerPartyId NULL count',
    passed: nullGroupBuyers === 0,
    count: nullGroupBuyers
  });
  console.log(`   OffspringGroupBuyer.buyerPartyId: ${nullGroupBuyers} NULLs ${nullGroupBuyers === 0 ? '✓ PASS' : '✗ FAIL'}`);

  // OffspringContract.buyerPartyId
  const nullContracts = await prisma.offspringContract.count({
    where: { buyerPartyId: null }
  });
  results.push({
    test: 'OffspringContract.buyerPartyId NULL count',
    passed: nullContracts === 0,
    count: nullContracts
  });
  console.log(`   OffspringContract.buyerPartyId: ${nullContracts} NULLs ${nullContracts === 0 ? '✓ PASS' : '✗ FAIL'}`);

  // PlanParty.partyId
  const nullPlanParties = await prisma.planParty.count({
    where: { partyId: null }
  });
  results.push({
    test: 'PlanParty.partyId NULL count',
    passed: nullPlanParties === 0,
    count: nullPlanParties
  });
  console.log(`   PlanParty.partyId: ${nullPlanParties} NULLs ${nullPlanParties === 0 ? '✓ PASS' : '✗ FAIL'}`);

  // Invoice.clientPartyId (non-general scope)
  const nullInvoices = await prisma.invoice.count({
    where: {
      clientPartyId: null,
      scope: { not: 'general' }
    }
  });
  results.push({
    test: 'Invoice.clientPartyId NULL count (non-general)',
    passed: nullInvoices === 0,
    count: nullInvoices
  });
  console.log(`   Invoice.clientPartyId (non-general): ${nullInvoices} NULLs ${nullInvoices === 0 ? '✓ PASS' : '✗ FAIL'}`);

  console.log('');

  // Section 2: Data coverage statistics
  console.log('2. Party data coverage statistics...\n');

  const totalUsers = await prisma.user.count();
  const usersWithParty = await prisma.user.count({ where: { partyId: { not: null } } });
  const userCoverage = totalUsers > 0 ? ((usersWithParty / totalUsers) * 100).toFixed(2) : '0.00';
  console.log(`   User.partyId: ${usersWithParty}/${totalUsers} (${userCoverage}%)`);

  const totalWaitlist = await prisma.waitlistEntry.count();
  const waitlistWithParty = await prisma.waitlistEntry.count({ where: { clientPartyId: { not: null } } });
  const waitlistCoverage = totalWaitlist > 0 ? ((waitlistWithParty / totalWaitlist) * 100).toFixed(2) : '0.00';
  console.log(`   WaitlistEntry.clientPartyId: ${waitlistWithParty}/${totalWaitlist} (${waitlistCoverage}%)`);

  const totalOffspring = await prisma.offspring.count();
  const offspringWithBuyer = await prisma.offspring.count({ where: { buyerPartyId: { not: null } } });
  const offspringCoverage = totalOffspring > 0 ? ((offspringWithBuyer / totalOffspring) * 100).toFixed(2) : '0.00';
  console.log(`   Offspring.buyerPartyId: ${offspringWithBuyer}/${totalOffspring} (${offspringCoverage}%)`);

  const totalInvoices = await prisma.invoice.count({ where: { scope: { not: 'general' } } });
  const invoicesWithClient = await prisma.invoice.count({
    where: { clientPartyId: { not: null }, scope: { not: 'general' } }
  });
  const invoiceCoverage = totalInvoices > 0 ? ((invoicesWithClient / totalInvoices) * 100).toFixed(2) : '0.00';
  console.log(`   Invoice.clientPartyId (non-general): ${invoicesWithClient}/${totalInvoices} (${invoiceCoverage}%)`);

  const totalAnimals = await prisma.animal.count();
  const animalsWithBuyer = await prisma.animal.count({ where: { buyerPartyId: { not: null } } });
  const animalCoverage = totalAnimals > 0 ? ((animalsWithBuyer / totalAnimals) * 100).toFixed(2) : '0.00';
  console.log(`   Animal.buyerPartyId: ${animalsWithBuyer}/${totalAnimals} (${animalCoverage}%)`);

  const totalAnimalOwners = await prisma.animalOwner.count();
  const ownersWithParty = await prisma.animalOwner.count({ where: { partyId: { not: null } } });
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
  console.log(`Status: ${allPassed ? '✓ ALL PASS - Ready for constraints' : '✗ SOME FAILURES - Fix data before proceeding'}\n');

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
