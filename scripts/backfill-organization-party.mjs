#!/usr/bin/env node
/**
 * Backfill Organization.partyId by creating Party records
 * Safe to run multiple times (idempotent)
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Organization.partyId backfill...\n');

  try {
    // Step 1: Create Party records for Organizations that don't have one
    console.log('Step 1: Creating Party records for Organizations...');
    const insertResult = await prisma.$executeRaw`
      INSERT INTO "Party" ("tenantId", "type", "name", "archived", "createdAt", "updatedAt")
      SELECT
        o."tenantId",
        'ORGANIZATION'::"PartyType" as "type",
        o."name" as "name",
        o."archived" as "archived",
        NOW() as "createdAt",
        NOW() as "updatedAt"
      FROM "Organization" o
      WHERE o."partyId" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "Party" p
          WHERE p."id" IN (SELECT "partyId" FROM "Organization" WHERE "id" = o."id" AND "partyId" IS NOT NULL)
        )
    `;
    console.log(`  Created ${insertResult} Party records`);

    // Step 2: Update Organization.partyId to link to the newly created Party records
    console.log('Step 2: Linking Organizations to Party records...');
    const updateResult = await prisma.$executeRaw`
      WITH org_party_mapping AS (
        SELECT
          o."id" as org_id,
          p."id" as party_id,
          ROW_NUMBER() OVER (PARTITION BY o."tenantId" ORDER BY o."id") as org_rank,
          ROW_NUMBER() OVER (PARTITION BY p."tenantId" ORDER BY p."id") as party_rank
        FROM "Organization" o
        CROSS JOIN "Party" p
        WHERE o."tenantId" = p."tenantId"
          AND p."type" = 'ORGANIZATION'::"PartyType"
          AND o."partyId" IS NULL
      )
      UPDATE "Organization" o
      SET "partyId" = m.party_id
      FROM org_party_mapping m
      WHERE o."id" = m.org_id
        AND m.org_rank = m.party_rank
        AND o."partyId" IS NULL
    `;
    console.log(`  Updated ${updateResult} Organizations`);

    // Step 3: Verify the result
    const orgsWithoutParty = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Organization"
      WHERE "partyId" IS NULL
    `;

    console.log(`\nOrganizations missing partyId: ${orgsWithoutParty[0].count}`);

    if (orgsWithoutParty[0].count > 0) {
      console.error('\nWARNING: Some organizations still missing partyId!');
      process.exit(1);
    }

    console.log('\nBackfill completed successfully!');

  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
