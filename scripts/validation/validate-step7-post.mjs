#!/usr/bin/env node
/**
 * Step 7: Post-Migration Validation Script
 * Purpose: Verify constraints and indexes after Step 7 migration
 * Date: 2025-12-26
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runValidation() {
  console.log('========================================');
  console.log('Step 7: Post-Migration Validation');
  console.log('========================================\n');

  // Section 1: Verify NOT NULL constraints
  console.log('1. Verifying NOT NULL constraints...\n');

  const constraints = await prisma.$queryRaw`
    SELECT table_name, column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('partyId', 'clientPartyId', 'buyerPartyId')
      AND table_name IN (
        'AnimalOwner', 'WaitlistEntry', 'OffspringGroupBuyer',
        'OffspringContract', 'PlanParty'
      )
    ORDER BY table_name, column_name
  `;

  console.log('   Table                    | Column            | Nullable | Status');
  console.log('   -------------------------|-------------------|----------|--------');
  constraints.forEach(row => {
    const status = row.is_nullable === 'NO' ? '✓ PASS' : '✗ FAIL';
    console.log(`   ${row.table_name.padEnd(24)} | ${row.column_name.padEnd(17)} | ${row.is_nullable.padEnd(8)} | ${status}`);
  });

  console.log('');

  // Section 2: Verify Foreign Key constraints
  console.log('2. Verifying foreign key ON DELETE behavior...\n');

  const fks = await prisma.$queryRaw`
    SELECT
      tc.table_name,
      kcu.column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name IN (
        'AnimalOwner', 'WaitlistEntry', 'OffspringGroupBuyer',
        'OffspringContract', 'PlanParty'
      )
      AND kcu.column_name LIKE '%partyId%'
    ORDER BY tc.table_name
  `;

  console.log('   Table                    | Column            | ON DELETE    | Status');
  console.log('   -------------------------|-------------------|--------------|--------');
  fks.forEach(row => {
    const expected = row.table_name === 'AnimalOwner' ? 'RESTRICT' : 'SET NULL';
    const status = row.delete_rule === expected ? '✓ PASS' : '✗ FAIL';
    console.log(`   ${row.table_name.padEnd(24)} | ${row.column_name.padEnd(17)} | ${row.delete_rule.padEnd(12)} | ${status}`);
  });

  console.log('');

  // Section 3: Verify new indexes
  console.log('3. Verifying new performance indexes...\n');

  const expectedIndexes = [
    'Invoice_clientPartyId_status_idx',
    'Invoice_tenantId_clientPartyId_status_idx',
    'ContractParty_partyId_status_idx',
    'OffspringGroupBuyer_buyerPartyId_groupId_idx',
    'PlanParty_planId_role_idx',
    'Offspring_buyerPartyId_placementState_idx',
    'OffspringContract_buyerPartyId_status_idx',
    'WaitlistEntry_clientPartyId_status_idx',
    'TagAssignment_taggedPartyId_tagId_idx'
  ];

  for (const indexName of expectedIndexes) {
    const exists = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ${indexName}
    `.then(rows => Number(rows[0].count) > 0);

    const status = exists ? '✓ EXISTS' : '✗ MISSING';
    console.log(`   ${indexName.padEnd(50)} ${status}`);
  }

  console.log('');

  // Section 4: Summary
  console.log('========================================');
  console.log('Validation Summary');
  console.log('========================================\n');

  const nullableCount = constraints.filter(r => r.is_nullable === 'YES').length;
  const wrongFkCount = fks.filter(r => {
    const expected = r.table_name === 'AnimalOwner' ? 'RESTRICT' : 'SET NULL';
    return r.delete_rule !== expected;
  }).length;

  const missingIndexes = [];
  for (const indexName of expectedIndexes) {
    const exists = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ${indexName}
    `.then(rows => Number(rows[0].count) > 0);
    if (!exists) missingIndexes.push(indexName);
  }

  const allPass = nullableCount === 0 && wrongFkCount === 0 && missingIndexes.length === 0;

  console.log(`NOT NULL Constraints: ${constraints.length - nullableCount}/${constraints.length} correct`);
  console.log(`Foreign Keys: ${fks.length - wrongFkCount}/${fks.length} correct`);
  console.log(`Indexes: ${expectedIndexes.length - missingIndexes.length}/${expectedIndexes.length} created`);
  console.log(`\nStatus: ${allPass ? '✓ ALL PASS' : '✗ SOME FAILURES'}\n`);

  if (!allPass) {
    if (nullableCount > 0) {
      console.log('Nullable columns (should be NOT NULL):');
      constraints.filter(r => r.is_nullable === 'YES').forEach(r => {
        console.log(`  - ${r.table_name}.${r.column_name}`);
      });
    }
    if (wrongFkCount > 0) {
      console.log('Incorrect FK behavior:');
      fks.filter(r => {
        const expected = r.table_name === 'AnimalOwner' ? 'RESTRICT' : 'SET NULL';
        return r.delete_rule !== expected;
      }).forEach(r => {
        const expected = r.table_name === 'AnimalOwner' ? 'RESTRICT' : 'SET NULL';
        console.log(`  - ${r.table_name}.${r.column_name}: expected ${expected}, got ${r.delete_rule}`);
      });
    }
    if (missingIndexes.length > 0) {
      console.log('Missing indexes:');
      missingIndexes.forEach(idx => console.log(`  - ${idx}`));
    }
  }

  return allPass;
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
