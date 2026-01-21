/**
 * Seed E2E Test Data for Breeding Business Rules Tests
 *
 * This script:
 * 1. Cleans up any broken/orphaned breeding plans and offspring groups
 * 2. Creates test animals (dam and sire) needed for offspring group creation
 *
 * Usage:
 *   npx tsx scripts/seed-e2e-test-data.ts
 *
 * Prerequisites:
 *   - Database connection configured
 *   - Tenant ID 4 (Tatooine) exists
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID = 4; // Tatooine tenant

async function cleanupBrokenData() {
  console.log("\n🧹 Cleaning up broken data...\n");

  // Find and delete orphaned offspring (those in groups linked to non-existent plans)
  const orphanedOffspring = await prisma.offspring.findMany({
    where: {
      tenantId: TENANT_ID,
      group: {
        planId: null, // Orphaned groups
      },
    },
    select: { id: true, name: true },
  });

  if (orphanedOffspring.length > 0) {
    console.log(`  Found ${orphanedOffspring.length} orphaned offspring records`);
    for (const o of orphanedOffspring) {
      try {
        await prisma.offspring.delete({ where: { id: o.id } });
        console.log(`    ✓ Deleted orphaned offspring: ${o.name || o.id}`);
      } catch (e) {
        console.log(`    ⚠ Could not delete offspring ${o.id}: ${e}`);
      }
    }
  }

  // Find orphaned offspring groups (not linked to any plan)
  const orphanedGroups = await prisma.offspringGroup.findMany({
    where: {
      tenantId: TENANT_ID,
      planId: null,
    },
    select: { id: true, name: true },
  });

  if (orphanedGroups.length > 0) {
    console.log(`  Found ${orphanedGroups.length} orphaned offspring groups`);
    for (const g of orphanedGroups) {
      try {
        // First delete any offspring in the group
        await prisma.offspring.deleteMany({ where: { groupId: g.id } });
        // Then delete any animals in the group
        await prisma.animal.deleteMany({ where: { offspringGroupId: g.id } });
        // Then delete the group
        await prisma.offspringGroup.delete({ where: { id: g.id } });
        console.log(`    ✓ Deleted orphaned group: ${g.name || g.id}`);
      } catch (e) {
        console.log(`    ⚠ Could not delete group ${g.id}: ${e}`);
      }
    }
  }

  // Find test breeding plans (those created by tests) and clean them up
  const testPlans = await prisma.breedingPlan.findMany({
    where: {
      tenantId: TENANT_ID,
      name: { startsWith: "Test Plan" },
    },
    select: { id: true, name: true },
  });

  if (testPlans.length > 0) {
    console.log(`  Found ${testPlans.length} test breeding plans to clean up`);
    for (const p of testPlans) {
      try {
        // Find linked offspring group
        const group = await prisma.offspringGroup.findFirst({
          where: { planId: p.id },
        });
        if (group) {
          // Delete offspring first
          await prisma.offspring.deleteMany({ where: { groupId: group.id } });
          await prisma.animal.deleteMany({ where: { offspringGroupId: group.id } });
          // Unlink and delete group
          await prisma.offspringGroup.update({
            where: { id: group.id },
            data: { planId: null },
          });
          await prisma.offspringGroup.delete({ where: { id: group.id } });
        }
        // Delete plan (soft delete by setting archived)
        await prisma.breedingPlan.update({
          where: { id: p.id },
          data: { archived: true },
        });
        console.log(`    ✓ Archived test plan: ${p.name}`);
      } catch (e) {
        console.log(`    ⚠ Could not clean up plan ${p.id}: ${e}`);
      }
    }
  }

  console.log("\n✅ Cleanup complete\n");
}

async function seedTestAnimals() {
  console.log("\n🌱 Seeding test animals for E2E tests...\n");

  // Check if we already have test animals
  const existingDam = await prisma.animal.findFirst({
    where: {
      tenantId: TENANT_ID,
      name: "E2E Test Dam",
    },
  });

  const existingSire = await prisma.animal.findFirst({
    where: {
      tenantId: TENANT_ID,
      name: "E2E Test Sire",
    },
  });

  let damId: number;
  let sireId: number;

  if (existingDam) {
    damId = existingDam.id;
    console.log(`  ℹ Using existing dam: ${existingDam.name} (ID: ${damId})`);
  } else {
    const dam = await prisma.animal.create({
      data: {
        tenantId: TENANT_ID,
        name: "E2E Test Dam",
        species: "DOG",
        sex: "FEMALE",
        status: "ACTIVE",
        birthDate: new Date("2020-01-15"),
        breed: "Australian Mountain Doodle",
      },
    });
    damId = dam.id;
    console.log(`  ✓ Created test dam: ${dam.name} (ID: ${damId})`);
  }

  if (existingSire) {
    sireId = existingSire.id;
    console.log(`  ℹ Using existing sire: ${existingSire.name} (ID: ${sireId})`);
  } else {
    const sire = await prisma.animal.create({
      data: {
        tenantId: TENANT_ID,
        name: "E2E Test Sire",
        species: "DOG",
        sex: "MALE",
        status: "ACTIVE",
        birthDate: new Date("2019-06-20"),
        breed: "Australian Mountain Doodle",
      },
    });
    sireId = sire.id;
    console.log(`  ✓ Created test sire: ${sire.name} (ID: ${sireId})`);
  }

  console.log(`\n✅ Test animals ready:`);
  console.log(`   Dam ID: ${damId}`);
  console.log(`   Sire ID: ${sireId}`);
  console.log(`\n   Update the test file to use these IDs if needed.\n`);

  return { damId, sireId };
}

async function seedTestParty() {
  console.log("\n🌱 Seeding test party (buyer) for E2E tests...\n");

  const existingParty = await prisma.party.findFirst({
    where: {
      tenantId: TENANT_ID,
      name: "E2E Test Buyer",
    },
  });

  let partyId: number;

  if (existingParty) {
    partyId = existingParty.id;
    console.log(`  ℹ Using existing party: ${existingParty.name} (ID: ${partyId})`);
  } else {
    const party = await prisma.party.create({
      data: {
        tenantId: TENANT_ID,
        name: "E2E Test Buyer",
        type: "CONTACT",
        email: "e2e-buyer@test.breederhq.com",
      },
    });
    partyId = party.id;
    console.log(`  ✓ Created test party: ${party.name} (ID: ${partyId})`);
  }

  console.log(`\n✅ Test party ready: ID ${partyId}\n`);

  return { partyId };
}

async function main() {
  console.log("═".repeat(60));
  console.log("E2E Test Data Seeding for Breeding Business Rules Tests");
  console.log("═".repeat(60));
  console.log(`\nTarget tenant: ${TENANT_ID} (Tatooine)\n`);

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: TENANT_ID },
  });

  if (!tenant) {
    console.error(`❌ Tenant ${TENANT_ID} not found!`);
    process.exit(1);
  }

  console.log(`✓ Tenant found: ${tenant.name}\n`);

  // Step 1: Clean up broken data
  await cleanupBrokenData();

  // Step 2: Seed test animals
  const { damId, sireId } = await seedTestAnimals();

  // Step 3: Seed test party (for buyer tests)
  const { partyId } = await seedTestParty();

  console.log("═".repeat(60));
  console.log("SUMMARY");
  console.log("═".repeat(60));
  console.log(`
Test data is ready for E2E tests:

  Tenant ID: ${TENANT_ID}
  Dam ID: ${damId}
  Sire ID: ${sireId}
  Buyer Party ID: ${partyId}

To run the tests:
  cd breederhq
  npx playwright test breeding-offspring-business-rules

If the test file uses hardcoded IDs (like damId: 1, sireId: 2),
update them to use: damId: ${damId}, sireId: ${sireId}, buyerPartyId: ${partyId}
`);
  console.log("═".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
