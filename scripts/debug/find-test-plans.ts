import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find tenants with Tattooine or Tatooine
  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { name: { contains: "Tattooine" } },
        { name: { contains: "Tatooine" } },
      ]
    },
    select: { id: true, name: true }
  });

  console.log("Tenants found:");
  for (const t of tenants) {
    console.log(`  ID ${t.id}: ${t.name}`);
  }

  // Find all test plans
  const plans = await prisma.breedingPlan.findMany({
    where: {
      OR: [
        { name: { contains: "Test Group" } },
        { name: { contains: "Cleanup Test" } },
        { name: { startsWith: "E2E" } },
      ]
    },
    select: { id: true, name: true, tenantId: true },
  });

  // Group by tenant
  const byTenant: Record<number, typeof plans> = {};
  for (const p of plans) {
    if (!byTenant[p.tenantId]) byTenant[p.tenantId] = [];
    byTenant[p.tenantId].push(p);
  }

  console.log("\nTest plans by tenant:");
  for (const [tid, plist] of Object.entries(byTenant)) {
    console.log(`  Tenant ${tid}: ${plist.length} plans`);
  }
  console.log(`\nTotal: ${plans.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
