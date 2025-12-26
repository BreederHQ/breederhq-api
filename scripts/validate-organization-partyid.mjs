#!/usr/bin/env node
/**
 * Deterministic validation: Organization.partyId column exists and is properly configured
 * Fails loudly if validation fails
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Validating Organization.partyId schema...\n');

  let hasErrors = false;

  try {
    // Check 1: Column exists
    const columnCheck = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Organization'
        AND column_name = 'partyId'
    `;

    if (columnCheck.length === 0) {
      console.error('❌ FAIL: Organization.partyId column does not exist');
      hasErrors = true;
    } else {
      console.log('✓ Organization.partyId column exists');
      console.log(`  Type: ${columnCheck[0].data_type}`);
      console.log(`  Nullable: ${columnCheck[0].is_nullable}`);

      // Check 2: Column should be NOT NULL
      if (columnCheck[0].is_nullable === 'YES') {
        console.error('❌ FAIL: Organization.partyId should be NOT NULL');
        hasErrors = true;
      } else {
        console.log('✓ Organization.partyId is NOT NULL');
      }

      // Check 3: Column should be integer
      if (columnCheck[0].data_type !== 'integer') {
        console.error(`❌ FAIL: Organization.partyId should be integer, got ${columnCheck[0].data_type}`);
        hasErrors = true;
      } else {
        console.log('✓ Organization.partyId is integer type');
      }
    }

    // Check 4: Unique index exists
    const indexCheck = await prisma.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'Organization'
        AND indexname = 'Organization_partyId_key'
    `;

    if (indexCheck.length === 0) {
      console.error('❌ FAIL: Unique index Organization_partyId_key does not exist');
      hasErrors = true;
    } else {
      console.log('✓ Unique index Organization_partyId_key exists');
    }

    // Check 5: Foreign key constraint exists
    const fkCheck = await prisma.$queryRaw`
      SELECT conname
      FROM pg_constraint
      WHERE conname = 'Organization_partyId_fkey'
    `;

    if (fkCheck.length === 0) {
      console.error('❌ FAIL: Foreign key constraint Organization_partyId_fkey does not exist');
      hasErrors = true;
    } else {
      console.log('✓ Foreign key constraint Organization_partyId_fkey exists');
    }

    // Check 6: No NULL values in partyId
    const nullCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Organization"
      WHERE "partyId" IS NULL
    `;

    if (nullCheck[0].count > 0) {
      console.error(`❌ FAIL: ${nullCheck[0].count} Organizations have NULL partyId`);
      hasErrors = true;
    } else {
      console.log('✓ All Organizations have partyId set');
    }

    // Check 7: All partyIds reference existing Party records
    const orphanCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Organization" o
      LEFT JOIN "Party" p ON o."partyId" = p."id"
      WHERE p."id" IS NULL
    `;

    if (orphanCheck[0].count > 0) {
      console.error(`❌ FAIL: ${orphanCheck[0].count} Organizations reference non-existent Party records`);
      hasErrors = true;
    } else {
      console.log('✓ All Organization.partyId values reference valid Party records');
    }

    console.log('\n' + (hasErrors ? 'Validation FAILED' : 'Validation PASSED'));

    if (hasErrors) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\nValidation error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
