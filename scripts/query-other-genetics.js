#!/usr/bin/env node
/** Check what genetics data exists on other tenants' horses */
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Sample genetics from key tenants
  for (const tenantId of [17, 18, 4, 15]) {
    const animals = await prisma.$queryRaw`
      SELECT a.id, a.name, a.sex, a.breed,
             ag."coatColorData", ag."healthGeneticsData", ag."performanceData",
             ag."testProvider"
      FROM "Animal" a
      JOIN "AnimalGenetics" ag ON ag."animalId" = a.id
      WHERE a."tenantId" = ${tenantId} AND a.species = 'HORSE'
      ORDER BY a.sex, a.name
      LIMIT 6
    `;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    console.log(`\n═══ Tenant ${tenantId}: ${tenant?.name} ═══`);
    for (const a of animals) {
      const cc = Array.isArray(a.coatColorData) ? a.coatColorData : [];
      const hg = Array.isArray(a.healthGeneticsData) ? a.healthGeneticsData : [];
      const pf = Array.isArray(a.performanceData) ? a.performanceData : [];

      console.log(`\n  ${a.name} (ID ${a.id}) | ${a.sex} | ${a.breed}`);
      console.log(`    Provider: ${a.testProvider || "none"}`);

      if (cc.length > 0) {
        console.log(`    Coat (${cc.length}): ${cc.map((l) => `${l.locus}=${l.genotype || l.allele1 + "/" + l.allele2}`).join(", ")}`);
      }
      if (hg.length > 0) {
        console.log(`    Health (${hg.length}): ${hg.map((l) => `${l.locus}=${l.genotype || "?"}`).join(", ")}`);
      }
      if (pf.length > 0) {
        console.log(`    Perf (${pf.length}): ${pf.map((l) => `${l.locus}=${l.genotype || "?"}`).join(", ")}`);
      }
      if (cc.length === 0 && hg.length === 0) {
        console.log(`    (empty genetics record)`);
      }
    }
  }

  // Also check NetworkSearchIndex content for one tenant
  const idx = await prisma.$queryRaw`
    SELECT "tenantId", sex, "geneticTraits", "healthClearances", "animalCount"
    FROM "NetworkSearchIndex"
    WHERE species = 'HORSE' AND "tenantId" = 17
  `;
  console.log("\n═══ NetworkSearchIndex sample (Tenant 17 - Westeros) ═══");
  idx.forEach((e) => {
    console.log(`  Sex: ${e.sex} | Animals: ${e.animalCount}`);
    console.log(`  Genetic Traits: ${JSON.stringify(e.geneticTraits)}`);
    console.log(`  Health Clearances: ${JSON.stringify(e.healthClearances)}`);
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
