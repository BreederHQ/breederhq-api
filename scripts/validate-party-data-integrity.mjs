#!/usr/bin/env node
/**
 * Comprehensive Party migration data integrity validation
 * Ensures all rows that should have partyId actually have it
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let errorCount = 0;
let warningCount = 0;

function error(msg) {
  console.error(`❌ ERROR: ${msg}`);
  errorCount++;
}

function warning(msg) {
  console.warn(`⚠️  WARNING: ${msg}`);
  warningCount++;
}

function success(msg) {
  console.log(`✓ ${msg}`);
}

async function validateOrganizations() {
  console.log('\n=== ORGANIZATION DATA INTEGRITY ===\n');

  // Check all Organizations have partyId
  const orgsWithoutParty = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Organization"
    WHERE "partyId" IS NULL
  `;

  if (orgsWithoutParty[0].count > 0) {
    error(`${orgsWithoutParty[0].count} Organizations missing partyId (should be 0)`);
  } else {
    success('All Organizations have partyId');
  }

  // Check all Organization.partyId values reference existing Party records
  const orphanedOrgParties = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Organization" o
    LEFT JOIN "Party" p ON o."partyId" = p.id
    WHERE p.id IS NULL
  `;

  if (orphanedOrgParties[0].count > 0) {
    error(`${orphanedOrgParties[0].count} Organizations reference non-existent Party records`);
  } else {
    success('All Organization.partyId values reference valid Party records');
  }

  // Check all Organization Party records have correct type
  const wrongTypeOrgParties = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Organization" o
    JOIN "Party" p ON o."partyId" = p.id
    WHERE p.type != 'ORGANIZATION'
  `;

  if (wrongTypeOrgParties[0].count > 0) {
    error(`${wrongTypeOrgParties[0].count} Organizations linked to Party records with wrong type`);
  } else {
    success('All Organization Party records have type = ORGANIZATION');
  }

  // Check for duplicate partyId (should be unique)
  const duplicateOrgParties = await prisma.$queryRaw`
    SELECT "partyId", COUNT(*) as count
    FROM "Organization"
    WHERE "partyId" IS NOT NULL
    GROUP BY "partyId"
    HAVING COUNT(*) > 1
  `;

  if (duplicateOrgParties.length > 0) {
    error(`${duplicateOrgParties.length} partyId values are used by multiple Organizations (should be unique)`);
  } else {
    success('All Organization.partyId values are unique');
  }

  // Check Organization count matches ORGANIZATION-type Party count
  const orgCount = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "Organization"
  `;
  const orgPartyCount = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "Party" WHERE type = 'ORGANIZATION'
  `;

  if (orgCount[0].count !== orgPartyCount[0].count) {
    warning(`Organization count (${orgCount[0].count}) != ORGANIZATION Party count (${orgPartyCount[0].count})`);
  } else {
    success(`Organization count matches ORGANIZATION Party count (${orgCount[0].count})`);
  }
}

async function validateContacts() {
  console.log('\n=== CONTACT DATA INTEGRITY ===\n');

  // Contacts with partyId that reference non-existent Party
  const orphanedContactParties = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Contact" c
    LEFT JOIN "Party" p ON c."partyId" = p.id
    WHERE c."partyId" IS NOT NULL
      AND p.id IS NULL
  `;

  if (orphanedContactParties[0].count > 0) {
    error(`${orphanedContactParties[0].count} Contacts reference non-existent Party records`);
  } else {
    success('All Contact.partyId values reference valid Party records (or are NULL)');
  }

  // Check Contact Party records have correct type
  const wrongTypeContactParties = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Contact" c
    JOIN "Party" p ON c."partyId" = p.id
    WHERE p.type != 'CONTACT'
  `;

  if (wrongTypeContactParties[0].count > 0) {
    error(`${wrongTypeContactParties[0].count} Contacts linked to Party records with wrong type`);
  } else {
    success('All Contact Party records have type = CONTACT (or partyId is NULL)');
  }

  // Check for duplicate partyId (should be unique)
  const duplicateContactParties = await prisma.$queryRaw`
    SELECT "partyId", COUNT(*) as count
    FROM "Contact"
    WHERE "partyId" IS NOT NULL
    GROUP BY "partyId"
    HAVING COUNT(*) > 1
  `;

  if (duplicateContactParties.length > 0) {
    error(`${duplicateContactParties.length} partyId values are used by multiple Contacts (should be unique)`);
  } else {
    success('All Contact.partyId values are unique');
  }

  // Info: how many Contacts have Party linkage
  const contactsWithParty = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "Contact" WHERE "partyId" IS NOT NULL
  `;
  const totalContacts = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "Contact"
  `;

  console.log(`ℹ️  Contacts with Party: ${contactsWithParty[0].count} / ${totalContacts[0].count}`);
}

async function validateUsers() {
  console.log('\n=== USER DATA INTEGRITY ===\n');

  // Users with partyId that reference non-existent Party
  const orphanedUserParties = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "User" u
    LEFT JOIN "Party" p ON u."partyId" = p.id
    WHERE u."partyId" IS NOT NULL
      AND p.id IS NULL
  `;

  if (orphanedUserParties[0].count > 0) {
    error(`${orphanedUserParties[0].count} Users reference non-existent Party records`);
  } else {
    success('All User.partyId values reference valid Party records (or are NULL)');
  }

  // Check for duplicate partyId (should be unique)
  const duplicateUserParties = await prisma.$queryRaw`
    SELECT "partyId", COUNT(*) as count
    FROM "User"
    WHERE "partyId" IS NOT NULL
    GROUP BY "partyId"
    HAVING COUNT(*) > 1
  `;

  if (duplicateUserParties.length > 0) {
    error(`${duplicateUserParties.length} partyId values are used by multiple Users (should be unique)`);
  } else {
    success('All User.partyId values are unique');
  }

  // Info: how many Users have Party linkage
  const usersWithParty = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "User" WHERE "partyId" IS NOT NULL
  `;
  const totalUsers = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM "User"
  `;

  console.log(`ℹ️  Users with Party: ${usersWithParty[0].count} / ${totalUsers[0].count}`);
}

async function validatePartyTable() {
  console.log('\n=== PARTY TABLE INTEGRITY ===\n');

  // Check all Party records have valid type
  const invalidPartyTypes = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Party"
    WHERE type NOT IN ('CONTACT', 'ORGANIZATION')
  `;

  if (invalidPartyTypes[0].count > 0) {
    error(`${invalidPartyTypes[0].count} Party records have invalid type`);
  } else {
    success('All Party records have valid type (CONTACT or ORGANIZATION)');
  }

  // Check all Party records are linked to something
  const orphanedParties = await prisma.$queryRaw`
    SELECT p.id, p.type
    FROM "Party" p
    WHERE NOT EXISTS (
      SELECT 1 FROM "Organization" o WHERE o."partyId" = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM "Contact" c WHERE c."partyId" = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM "User" u WHERE u."partyId" = p.id
    )
  `;

  if (orphanedParties.length > 0) {
    warning(`${orphanedParties.length} Party records are not linked to any Organization, Contact, or User`);
    console.log('  This may be expected if Party records were created but not yet linked.');
  } else {
    success('All Party records are linked to at least one entity');
  }

  // Summary
  const partyCounts = await prisma.$queryRaw`
    SELECT
      type,
      COUNT(*) as count
    FROM "Party"
    GROUP BY type
    ORDER BY type
  `;

  console.log('\nℹ️  Party type distribution:');
  for (const row of partyCounts) {
    console.log(`  ${row.type}: ${row.count}`);
  }
}

async function validateTenantIsolation() {
  console.log('\n=== TENANT ISOLATION ===\n');

  // Check Organization and Party tenantId match
  const mismatchedOrgTenants = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Organization" o
    JOIN "Party" p ON o."partyId" = p.id
    WHERE o."tenantId" != p."tenantId"
  `;

  if (mismatchedOrgTenants[0].count > 0) {
    error(`${mismatchedOrgTenants[0].count} Organizations have mismatched tenantId with their Party`);
  } else {
    success('All Organization-Party pairs have matching tenantId');
  }

  // Check Contact and Party tenantId match (where linked)
  const mismatchedContactTenants = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "Contact" c
    JOIN "Party" p ON c."partyId" = p.id
    WHERE c."tenantId" != p."tenantId"
  `;

  if (mismatchedContactTenants[0].count > 0) {
    error(`${mismatchedContactTenants[0].count} Contacts have mismatched tenantId with their Party`);
  } else {
    success('All Contact-Party pairs have matching tenantId');
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           PARTY MIGRATION DATA INTEGRITY VALIDATION           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    const dbInfo = await prisma.$queryRaw`
      SELECT current_database() as database
    `;
    console.log(`Database: ${dbInfo[0].database}\n`);

    await validateOrganizations();
    await validateContacts();
    await validateUsers();
    await validatePartyTable();
    await validateTenantIsolation();

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                       VALIDATION SUMMARY                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    if (errorCount === 0 && warningCount === 0) {
      console.log('🎉 SUCCESS: Perfect data integrity! All Party relationships are valid.\n');
    } else {
      console.log(`Errors: ${errorCount}`);
      console.log(`Warnings: ${warningCount}\n`);

      if (errorCount > 0) {
        console.error('❌ FAILED: Data integrity issues detected!\n');
        process.exit(1);
      } else {
        console.warn('⚠️  WARNINGS: Minor issues detected but data is functional.\n');
      }
    }

  } catch (error) {
    console.error('\n❌ Validation failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
