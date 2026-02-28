#!/usr/bin/env node
/**
 * Query DEV database for tenants, horses, genetics, and network state.
 * Usage: node scripts/development/run-with-env.js --quiet .env.dev node scripts/query-dev-tenants.js
 */
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 1. Tenants with horses
  const tenants = await prisma.$queryRaw`
    SELECT t.id, t.name, t."networkVisibility",
           COUNT(a.id) FILTER (WHERE a.species = 'HORSE') AS horse_count,
           COUNT(a.id) FILTER (WHERE a.species = 'HORSE' AND a.sex = 'MALE') AS stallion_count,
           COUNT(a.id) FILTER (WHERE a.species = 'HORSE' AND a.sex = 'FEMALE') AS mare_count
    FROM "Tenant" t
    LEFT JOIN "Animal" a ON a."tenantId" = t.id
    GROUP BY t.id, t.name, t."networkVisibility"
    HAVING COUNT(a.id) FILTER (WHERE a.species = 'HORSE') > 0
    ORDER BY horse_count DESC
    LIMIT 15
  `;
  console.log("=== TENANTS WITH HORSES ===");
  tenants.forEach((t) => {
    console.log(
      `  Tenant ${t.id}: ${t.name} | vis=${t.networkVisibility || "null"} | horses=${t.horse_count} (M:${t.stallion_count} F:${t.mare_count})`
    );
  });

  // 2. Tenants with horse genetics
  const geneticsCount = await prisma.$queryRaw`
    SELECT a."tenantId", t.name, COUNT(ag.id) AS genetics_count
    FROM "AnimalGenetics" ag
    JOIN "Animal" a ON a.id = ag."animalId"
    JOIN "Tenant" t ON t.id = a."tenantId"
    WHERE a.species = 'HORSE'
    GROUP BY a."tenantId", t.name
    ORDER BY genetics_count DESC
  `;
  console.log("\n=== TENANTS WITH HORSE GENETICS ===");
  if (geneticsCount.length === 0) console.log("  (none)");
  geneticsCount.forEach((g) =>
    console.log(`  Tenant ${g.tenantId}: ${g.name} | ${g.genetics_count} horses with genetics`)
  );

  // 3. AnimalAccess for Tenant 45
  const accessCount = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM "AnimalAccess" WHERE "accessorTenantId" = 45
  `;
  console.log(`\n=== ANIMAL ACCESS FOR TENANT 45 ===`);
  console.log(`  Shadow animals accessible: ${accessCount[0].cnt}`);

  // 4. NetworkSearchIndex (horse)
  const indexEntries = await prisma.$queryRaw`
    SELECT nsi."tenantId", t.name, nsi.sex, nsi."animalCount", nsi."lastRebuiltAt"
    FROM "NetworkSearchIndex" nsi
    JOIN "Tenant" t ON t.id = nsi."tenantId"
    WHERE nsi.species = 'HORSE'
    ORDER BY nsi."tenantId"
  `;
  console.log(`\n=== NETWORK SEARCH INDEX (HORSE) ===`);
  if (indexEntries.length === 0) console.log("  (empty — needs rebuild)");
  indexEntries.forEach((e) =>
    console.log(`  Tenant ${e.tenantId} (${e.name}) | sex=${e.sex} | animals=${e.animalCount} | rebuilt=${e.lastRebuiltAt}`)
  );

  // 5. networkSearchVisible horses
  const nsvCount = await prisma.$queryRaw`
    SELECT a."tenantId", t.name, COUNT(*) as cnt
    FROM "Animal" a
    JOIN "Tenant" t ON t.id = a."tenantId"
    WHERE a.species = 'HORSE' AND a."networkSearchVisible" = true
    GROUP BY a."tenantId", t.name
    ORDER BY cnt DESC
    LIMIT 10
  `;
  console.log("\n=== HORSES WITH networkSearchVisible=true ===");
  if (nsvCount.length === 0) console.log("  (none — need to enable)");
  nsvCount.forEach((n) => console.log(`  Tenant ${n.tenantId} (${n.name}): ${n.cnt} horses`));

  // 6. Detailed horse list for top 3 non-45 tenants (for seed targeting)
  const otherTenants = tenants.filter((t) => t.id !== 45).slice(0, 5);
  if (otherTenants.length > 0) {
    console.log("\n=== HORSES IN OTHER TENANTS (for seeding) ===");
    for (const t of otherTenants) {
      const horses = await prisma.$queryRaw`
        SELECT a.id, a.name, a.sex, a.breed,
               (ag.id IS NOT NULL) AS has_genetics
        FROM "Animal" a
        LEFT JOIN "AnimalGenetics" ag ON ag."animalId" = a.id
        WHERE a."tenantId" = ${t.id} AND a.species = 'HORSE'
        ORDER BY a.sex, a.name
        LIMIT 10
      `;
      console.log(`\n  Tenant ${t.id}: ${t.name} (${t.horse_count} horses)`);
      horses.forEach((h) =>
        console.log(`    ID ${h.id}: ${h.name} | ${h.sex} | ${h.breed || "?"} | genetics=${h.has_genetics}`)
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
