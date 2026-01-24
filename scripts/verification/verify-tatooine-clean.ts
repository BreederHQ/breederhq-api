import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const TENANT_ID = 4;

  const plans = await prisma.breedingPlan.count({ where: { tenantId: TENANT_ID } });
  const groups = await prisma.offspringGroup.count({ where: { tenantId: TENANT_ID } });
  const offspring = await prisma.offspring.count({ where: { tenantId: TENANT_ID } });

  console.log("Remaining breeding data for Tatooine (ID: 4):");
  console.log("  Breeding plans:", plans);
  console.log("  Offspring groups:", groups);
  console.log("  Offspring:", offspring);

  if (plans === 0 && groups === 0 && offspring === 0) {
    console.log("\n✅ Tatooine is clean and ready for fresh testing!");
  } else {
    console.log("\n⚠️ Some data still remains");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
