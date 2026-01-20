/**
 * WIPE ALL Breeding Data for Tatooine Tenant
 *
 * This script completely removes ALL breeding-related data:
 * - ALL breeding plans (regardless of status or name)
 * - ALL offspring groups
 * - ALL offspring records
 * - ALL breeding events
 * - Resets animal breeding statuses
 *
 * Usage:
 *   npx tsx scripts/wipe-tatooine-breeding.ts
 *
 * WARNING: This is destructive and cannot be undone!
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("═".repeat(60));
  console.log("WIPE ALL BREEDING DATA - Tatooine Tenant");
  console.log("═".repeat(60));

  // First, list all tenants to find Tatooine
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true },
  });

  console.log("\nAvailable tenants:");
  tenants.forEach((t) =>
    console.log(`  ID: ${t.id} | Name: ${t.name} | Slug: ${t.slug}`)
  );

  // Find Tatooine tenant (check various possible names/slugs)
  const tatooine = tenants.find(
    (t) =>
      t.name?.toLowerCase().includes("tatooine") ||
      t.slug?.toLowerCase().includes("tatooine") ||
      t.name?.toLowerCase().includes("skywalker") ||
      t.slug?.toLowerCase().includes("skywalker")
  );

  if (!tatooine) {
    console.log("\n❌ Could not find Tatooine tenant!");
    console.log("Please specify the tenant ID manually.");
    return;
  }

  const TENANT_ID = tatooine.id;
  console.log(`\n✓ Found Tatooine: ${tatooine.name} (ID: ${TENANT_ID})\n`);

  // Confirm before proceeding
  console.log("⚠️  WARNING: This will DELETE ALL breeding data for this tenant!");
  console.log("    - All breeding plans");
  console.log("    - All offspring groups");
  console.log("    - All offspring records");
  console.log("    - All breeding events");
  console.log("    - All breeding milestones");
  console.log("\nProceeding in 3 seconds...\n");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Step 1: Count existing data
  const planCount = await prisma.breedingPlan.count({
    where: { tenantId: TENANT_ID },
  });
  const groupCount = await prisma.offspringGroup.count({
    where: { tenantId: TENANT_ID },
  });
  const offspringCount = await prisma.offspring.count({
    where: { tenantId: TENANT_ID },
  });

  console.log(`Found data to delete:`);
  console.log(`  - Breeding plans: ${planCount}`);
  console.log(`  - Offspring groups: ${groupCount}`);
  console.log(`  - Offspring records: ${offspringCount}`);
  console.log("");

  // Step 2: Delete breeding milestones (depends on plans)
  console.log("🗑️  Deleting breeding milestones...");
  try {
    const milestoneResult = await prisma.breedingMilestone.deleteMany({
      where: {
        plan: { tenantId: TENANT_ID },
      },
    });
    console.log(`   ✓ Deleted ${milestoneResult.count} milestones`);
  } catch (e: any) {
    console.log(`   ⚠ Milestones: ${e.message}`);
  }

  // Step 3: Delete breeding events
  console.log("🗑️  Deleting breeding events...");
  try {
    const eventResult = await prisma.breedingEvent.deleteMany({
      where: {
        plan: { tenantId: TENANT_ID },
      },
    });
    console.log(`   ✓ Deleted ${eventResult.count} events`);
  } catch (e: any) {
    console.log(`   ⚠ Events: ${e.message}`);
  }

  // Step 4: Delete offspring (depends on groups)
  console.log("🗑️  Deleting offspring records...");
  const offspringResult = await prisma.offspring.deleteMany({
    where: { tenantId: TENANT_ID },
  });
  console.log(`   ✓ Deleted ${offspringResult.count} offspring`);

  // Step 5: Unlink animals from offspring groups
  console.log("🗑️  Unlinking animals from offspring groups...");
  const groups = await prisma.offspringGroup.findMany({
    where: { tenantId: TENANT_ID },
    select: { id: true },
  });
  for (const group of groups) {
    await prisma.animal.updateMany({
      where: { offspringGroupId: group.id },
      data: { offspringGroupId: null },
    });
  }
  console.log(`   ✓ Unlinked animals from ${groups.length} groups`);

  // Step 6: Delete offspring groups
  console.log("🗑️  Deleting offspring groups...");
  const groupResult = await prisma.offspringGroup.deleteMany({
    where: { tenantId: TENANT_ID },
  });
  console.log(`   ✓ Deleted ${groupResult.count} offspring groups`);

  // Step 7: Delete waitlist entries linked to plans
  console.log("🗑️  Deleting waitlist entries linked to plans...");
  try {
    const waitlistResult = await prisma.waitlistEntry.deleteMany({
      where: {
        tenantId: TENANT_ID,
        planId: { not: null },
      },
    });
    console.log(`   ✓ Deleted ${waitlistResult.count} waitlist entries`);
  } catch (e: any) {
    console.log(`   ⚠ Waitlist: ${e.message}`);
  }

  // Step 8: Delete breeding plans
  console.log("🗑️  Deleting breeding plans...");
  const planResult = await prisma.breedingPlan.deleteMany({
    where: { tenantId: TENANT_ID },
  });
  console.log(`   ✓ Deleted ${planResult.count} breeding plans`);

  // Step 9: Reset animal breeding statuses
  console.log("🔄 Resetting animal breeding statuses...");
  const animalResult = await prisma.animal.updateMany({
    where: {
      tenantId: TENANT_ID,
      breedingStatus: { not: null },
    },
    data: { breedingStatus: null },
  });
  console.log(`   ✓ Reset ${animalResult.count} animal breeding statuses`);

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("✅ WIPE COMPLETE");
  console.log("═".repeat(60));
  console.log(`
Summary:
  - Breeding plans deleted: ${planResult.count}
  - Offspring groups deleted: ${groupResult.count}
  - Offspring deleted: ${offspringResult.count}
  - Animal statuses reset: ${animalResult.count}

The tenant is now ready for fresh breeding plan testing.
`);
}

main()
  .catch((e) => {
    console.error("❌ Wipe failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
