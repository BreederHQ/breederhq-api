#!/usr/bin/env node
/**
 * Seed network-visible genetics for cross-tenant demo (Video Demo)
 *
 * Sets up 3 demo scenarios for Katie (Tenant 45) in the Genetics Lab:
 *
 *   SCENARIO 1 — LOCAL SEARCH ("My Animals")
 *     Already seeded by seed-demo-genetics.js. Katie's 8 horses have rich genetics.
 *     This script does NOT touch Tenant 45.
 *
 *   SCENARIO 2 — LOCAL + NETWORK ("My Animals + Network")
 *     Creates AnimalAccess records (shadow animals) so Katie can see
 *     specific horses from other breeders. These appear alongside
 *     Katie's own animals in the dam/sire selector.
 *     Targets: Tatooine (Tenant 4), Middle Earth (Tenant 15)
 *
 *   SCENARIO 3 — NETWORK-WIDE ("BreederHQ Network")
 *     Enriches genetics on horses in other tenants so the NetworkSearchIndex
 *     has compelling matches. Then rebuilds the index.
 *     All 4 other tenants get richer genetics data so network search
 *     returns diverse breeder matches.
 *
 * Demo narratives for Rachel:
 *
 *   "Katie wants a healthy buckskin foal — she searches the network":
 *     → Tatooine (Tenant 4) has Impressive Legacy — HYPP carrier QH stallion
 *       with e/e Cr/n. "Risk pairing" — shows carrier warning.
 *     → Middle Earth (Tenant 15) has Asfaloth — OLWS-clear Cremello Andalusian
 *       with Cr/Cr. "Safe pairing" — all clear, guaranteed cream dilution.
 *     → Marvel (Tenant 18) has stallions with Gray gene — interesting for Punnett.
 *
 *   "Katie needs a stallion with HYPP-clear status":
 *     → Network search filters for HYPP=N/N
 *     → Finds breeders in Tatooine (some clear), Middle Earth (all clear),
 *       Marvel (all clear). Westeros has HYPP carriers — filtered out.
 *
 *   "Katie has a shadow animal from another breeder":
 *     → AnimalAccess grants show Asfaloth + Impressive Legacy in her selector
 *     → She can pair them with her mares directly in Genetics Lab
 *
 * Usage:
 *   node scripts/seed-network-genetics.js          (dry run)
 *   node scripts/seed-network-genetics.js --apply   (insert into dev DB)
 */

// ─── CONFIGURATION ──────────────────────────────────────────────────────────

const KATIE_TENANT_ID = 45;

// Enrichment targets: add QH-relevant loci to existing animals
// These animals ALREADY have some genetics — we'll MERGE, not replace

const GENETICS_ENRICHMENTS = [
  // ── Tatooine (Tenant 4) ──────────────────────────────────────────────
  {
    animalId: 665,
    name: "Impressive Legacy",
    tenantId: 4,
    tenantName: "Tatooine",
    // EXISTING: E=e/e, A=A/a, Cr=n/n, HYPP=N/H
    // ADD: more coat color + full 5-panel + performance + physical
    addCoatColor: [
      { locus: "D", locusName: "Dun", allele1: "d", allele2: "d", genotype: "d/d" },
      { locus: "G", locusName: "Gray", allele1: "g", allele2: "g", genotype: "g/g" },
      { locus: "Rn", locusName: "Roan", allele1: "rn", allele2: "rn", genotype: "rn/rn" },
      { locus: "TO", locusName: "Tobiano", allele1: "to", allele2: "to", genotype: "to/to" },
      { locus: "O", locusName: "Frame Overo (OLWS)", allele1: "N", allele2: "N", genotype: "N/N" },
    ],
    addHealth: [
      // Already has HYPP=N/H. Add remaining 5-panel.
      { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "OLWS", locusName: "Overo Lethal White Syndrome", allele1: "N", allele2: "N", genotype: "N/N" },
    ],
    addPerformance: [
      { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "C", allele2: "C", genotype: "C/C" },
    ],
    addPhysical: [
      { locus: "LCORL", locusName: "Height (LCORL)", allele1: "T", allele2: "C", genotype: "T/C" },
    ],
    grantAccess: true, // Create AnimalAccess for Katie
    accessTier: "GENETICS",
  },
  {
    animalId: 653,
    name: "Midnight Run (Safe Tobiano Stallion)",
    tenantId: 4,
    tenantName: "Tatooine",
    // EXISTING: E=E/e, A=a/a, O=n/n, TO=TO/to, Cr=n/n, G=n/n, OLWS=N/N, HYPP=N/N, GBED=N/N
    // ADD: more health + performance
    addCoatColor: [],
    addHealth: [
      { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
    ],
    addPerformance: [
      { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "C", allele2: "T", genotype: "C/T" },
    ],
    addPhysical: [
      { locus: "LCORL", locusName: "Height (LCORL)", allele1: "T", allele2: "T", genotype: "T/T" },
    ],
    grantAccess: false,
  },

  // ── Middle Earth (Tenant 15) ─────────────────────────────────────────
  {
    animalId: 499,
    name: "Asfaloth (Non-Overo Safe Stallion)",
    tenantId: 15,
    tenantName: "Middle Earth",
    // EXISTING: E=e/e, A=A/a, G=g/g, Cr=Cr/Cr, OLWS=n/n
    // This is a CREMELLO — perfect for "I want a Palomino" network search
    addCoatColor: [
      { locus: "D", locusName: "Dun", allele1: "d", allele2: "d", genotype: "d/d" },
      { locus: "Rn", locusName: "Roan", allele1: "rn", allele2: "rn", genotype: "rn/rn" },
      { locus: "TO", locusName: "Tobiano", allele1: "to", allele2: "to", genotype: "to/to" },
    ],
    addHealth: [
      { locus: "HYPP", locusName: "Hyperkalemic Periodic Paralysis", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "GBED", locusName: "Glycogen Branching Enzyme Deficiency", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
    ],
    addPerformance: [
      { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "T", allele2: "T", genotype: "T/T" },
      { locus: "DMRT3", locusName: "Gait Keeper", allele1: "C", allele2: "C", genotype: "C/C" },
    ],
    addPhysical: [
      { locus: "LCORL", locusName: "Height (LCORL)", allele1: "T", allele2: "T", genotype: "T/T" },
    ],
    grantAccess: true,
    accessTier: "GENETICS",
  },
  {
    animalId: 509,
    name: "Arod (Non-Overo Safe Colt)",
    tenantId: 15,
    tenantName: "Middle Earth",
    // EXISTING: E=E/e, A=A/a, G=G/g, Cr=Cr/n, OLWS=n/n
    // BAY with cream = BUCKSKIN + Gray → interesting combo
    addCoatColor: [
      { locus: "D", locusName: "Dun", allele1: "d", allele2: "d", genotype: "d/d" },
      { locus: "Rn", locusName: "Roan", allele1: "rn", allele2: "rn", genotype: "rn/rn" },
    ],
    addHealth: [
      { locus: "HYPP", locusName: "Hyperkalemic Periodic Paralysis", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "GBED", locusName: "Glycogen Branching Enzyme Deficiency", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
    ],
    addPerformance: [
      { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "C", allele2: "T", genotype: "C/T" },
    ],
    addPhysical: [],
    grantAccess: true,
    accessTier: "GENETICS",
  },

  // ── Marvel Avengers (Tenant 18) ──────────────────────────────────────
  // Enrich a couple stallions for network-wide search variety
  {
    animalId: 591, // Thor Stallion (need to verify)
    name: "Thor Stallion (lookup)",
    tenantId: 18,
    tenantName: "Marvel Avengers",
    _lookupBySex: "MALE", // We'll find the first male if ID is wrong
    addCoatColor: [
      { locus: "Cr", locusName: "Cream", allele1: "n", allele2: "n", genotype: "n/n" },
      { locus: "D", locusName: "Dun", allele1: "d", allele2: "d", genotype: "d/d" },
      { locus: "Rn", locusName: "Roan", allele1: "rn", allele2: "rn", genotype: "rn/rn" },
    ],
    addHealth: [
      { locus: "HYPP", locusName: "Hyperkalemic Periodic Paralysis", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
    ],
    addPerformance: [
      { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "T", allele2: "T", genotype: "T/T" },
    ],
    addPhysical: [],
    grantAccess: false,
  },

  // ── Westeros (Tenant 17) ─────────────────────────────────────────────
  // Enrich a couple stallions — Westeros has HYPP carriers, which is interesting
  {
    animalId: 559, // lookup
    name: "Westeros Stallion (lookup)",
    tenantId: 17,
    tenantName: "Westeros",
    _lookupBySex: "MALE",
    addCoatColor: [
      { locus: "Cr", locusName: "Cream", allele1: "Cr", allele2: "n", genotype: "Cr/n" },
      { locus: "D", locusName: "Dun", allele1: "D", allele2: "d", genotype: "D/d" },
    ],
    addHealth: [
      // Don't add HYPP — Westeros already has it and the existing ones have H/N
      { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "GBED", locusName: "Glycogen Branching Enzyme Deficiency", allele1: "N", allele2: "N", genotype: "N/N" },
      { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "N", genotype: "N/N" },
    ],
    addPerformance: [
      { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "C", allele2: "C", genotype: "C/C" },
    ],
    addPhysical: [],
    grantAccess: false,
  },
];

// ─── Dry Run Summary ────────────────────────────────────────────────────────

function printDryRunSummary() {
  console.log("─── SCENARIO 2: Local + Network (AnimalAccess) ───\n");
  console.log("  Shadow animals to grant Katie (Tenant 45) access to:\n");
  const grants = GENETICS_ENRICHMENTS.filter((e) => e.grantAccess);
  grants.forEach((g) => {
    console.log(`    ${g.name} (ID ${g.animalId}) — ${g.tenantName} (Tenant ${g.tenantId})`);
    console.log(`      Tier: ${g.accessTier} | Source: SHARE_CODE`);
    console.log(`      → Katie sees this animal in her dam/sire selector`);
    console.log(`      → Can run full genetics pairing against her own animals`);
  });

  console.log("\n─── SCENARIO 3: Network-Wide (Enriched Genetics) ───\n");
  console.log("  Genetics enrichments by tenant:\n");
  const byTenant = {};
  GENETICS_ENRICHMENTS.forEach((e) => {
    if (!byTenant[e.tenantId]) byTenant[e.tenantId] = [];
    byTenant[e.tenantId].push(e);
  });
  for (const [tid, entries] of Object.entries(byTenant)) {
    const tName = entries[0].tenantName;
    console.log(`  ${tName} (Tenant ${tid}):`);
    entries.forEach((e) => {
      const cc = e.addCoatColor?.length || 0;
      const hh = e.addHealth?.length || 0;
      const pp = e.addPerformance?.length || 0;
      const ph = e.addPhysical?.length || 0;
      console.log(`    ${e.name}: +${cc} coat, +${hh} health, +${pp} perf, +${ph} phys`);
    });
  }

  console.log("\n─── Demo Narratives ───\n");
  console.log('  1. "Katie wants a HYPP-clear stallion for safe breeding"');
  console.log("     → Network search: species=HORSE, sex=MALE, health=[HYPP:N/N]");
  console.log("     → Finds: Middle Earth (all clear), Tatooine (mixed), Marvel (all clear)");
  console.log("     → Westeros filtered OUT (their stallions are HYPP carriers)\n");

  console.log('  2. "Katie wants a Cremello stallion for guaranteed Palomino foals"');
  console.log("     → Network search: species=HORSE, sex=MALE, genetics=[Cr:Cr/Cr]");
  console.log("     → Finds: Middle Earth — Asfaloth is Cr/Cr (cremello)");
  console.log("     → Katie sends inquiry → gets animal shared → pairs in Genetics Lab\n");

  console.log('  3. "Katie already has shadow animals from previous inquiries"');
  console.log("     → Switch to 'My Animals + Network'");
  console.log("     → Sees Asfaloth (Middle Earth) + Impressive Legacy (Tatooine)");
  console.log("     → Selects Asfaloth as sire + Phoebe as dam → full pairing calc");
  console.log("     → Shows cream dilution predictions + all health clear\n");

  console.log("  4. \"Katie searches for a stallion with Gray gene\"");
  console.log("     → Network search: species=HORSE, sex=MALE, genetics=[G:G/g or G/G]");
  console.log("     → Finds: Middle Earth (Arod G/g), Marvel (several G/G and G/g)");
  console.log("     → Gray gene = foal will progressively gray out (striking visual)\n");

  console.log("─── After --apply ───\n");
  console.log("  Will also rebuild NetworkSearchIndex for all horse tenants.");
  console.log("  This ensures network search returns fresh results immediately.\n");
  console.log("─── Pass --apply to write to database ───");
}

// ─── Main Logic ─────────────────────────────────────────────────────────────

async function main() {
  const dryRun = !process.argv.includes("--apply");

  console.log("🌐 Network Genetics Demo Seed — Cross-Tenant (Horses)");
  console.log("═".repeat(60));

  if (dryRun) {
    console.log("  MODE: Dry Run (pass --apply to execute)\n");
    printDryRunSummary();
    return;
  }

  console.log("  MODE: APPLY — writing to database\n");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    let enriched = 0;
    let accessCreated = 0;

    for (const entry of GENETICS_ENRICHMENTS) {
      // Resolve animal ID if needed (for lookup entries)
      let animalId = entry.animalId;
      if (entry._lookupBySex) {
        const found = await prisma.animal.findFirst({
          where: {
            tenantId: entry.tenantId,
            species: "HORSE",
            sex: entry._lookupBySex,
          },
          select: { id: true, name: true },
          orderBy: { id: "asc" },
        });
        if (!found) {
          console.log(`  ⚠️  No ${entry._lookupBySex} horse in Tenant ${entry.tenantId}, skipping`);
          continue;
        }
        // Only use lookup if the hardcoded ID doesn't exist
        const exists = await prisma.animal.findFirst({
          where: { id: animalId, tenantId: entry.tenantId, species: "HORSE" },
        });
        if (!exists) {
          animalId = found.id;
          console.log(`  ℹ️  Resolved ${entry.name} → ${found.name} (ID ${found.id})`);
        }
      }

      // Verify animal exists
      const animal = await prisma.animal.findFirst({
        where: { id: animalId, tenantId: entry.tenantId },
        select: { id: true, name: true, sex: true },
      });
      if (!animal) {
        console.log(`  ⚠️  Animal ${animalId} not found in Tenant ${entry.tenantId}, skipping`);
        continue;
      }

      // Get existing genetics
      const existing = await prisma.animalGenetics.findUnique({
        where: { animalId },
      });

      if (!existing) {
        console.log(`  ⚠️  No genetics record for ${animal.name} (ID ${animalId}), creating new`);
      }

      // Merge new loci with existing (don't duplicate)
      const existingCC = Array.isArray(existing?.coatColorData) ? existing.coatColorData : [];
      const existingHG = Array.isArray(existing?.healthGeneticsData) ? existing.healthGeneticsData : [];
      const existingPF = Array.isArray(existing?.performanceData) ? existing.performanceData : [];
      const existingPT = Array.isArray(existing?.physicalTraitsData) ? existing.physicalTraitsData : [];

      const mergedCC = mergeLoci(existingCC, entry.addCoatColor || []);
      const mergedHG = mergeLoci(existingHG, entry.addHealth || []);
      const mergedPF = mergeLoci(existingPF, entry.addPerformance || []);
      const mergedPT = mergeLoci(existingPT, entry.addPhysical || []);

      const data = {
        coatColorData: mergedCC,
        healthGeneticsData: mergedHG,
        performanceData: mergedPF,
        physicalTraitsData: mergedPT,
        testProvider: existing?.testProvider || "UC Davis VGL",
        testDate: existing?.testDate || new Date("2024-06-01"),
      };

      await prisma.animalGenetics.upsert({
        where: { animalId },
        create: {
          animalId,
          ...data,
          coatTypeData: [],
          eyeColorData: [],
          otherTraitsData: [],
          temperamentData: [],
          breedComposition: [],
          lifeStage: "Adult",
        },
        update: data,
      });

      console.log(`  ✓ Enriched: ${animal.name} (ID ${animalId}) — ${entry.tenantName}`);
      enriched++;

      // Create AnimalAccess if needed
      if (entry.grantAccess) {
        const existingAccess = await prisma.animalAccess.findUnique({
          where: {
            animalId_accessorTenantId: {
              animalId,
              accessorTenantId: KATIE_TENANT_ID,
            },
          },
        });

        if (existingAccess) {
          // Update tier if needed
          if (existingAccess.accessTier !== entry.accessTier) {
            await prisma.animalAccess.update({
              where: { id: existingAccess.id },
              data: { accessTier: entry.accessTier, status: "ACTIVE" },
            });
            console.log(`    ↳ Updated access tier → ${entry.accessTier}`);
          } else {
            console.log(`    ↳ Access already exists (${existingAccess.accessTier})`);
          }
        } else {
          await prisma.animalAccess.create({
            data: {
              ownerTenantId: entry.tenantId,
              accessorTenantId: KATIE_TENANT_ID,
              animalId,
              accessTier: entry.accessTier,
              source: "SHARE_CODE",
              status: "ACTIVE",
              animalNameSnapshot: animal.name,
              animalSpeciesSnapshot: "HORSE",
              animalSexSnapshot: animal.sex,
            },
          });
          console.log(`    ↳ Created AnimalAccess → Katie (tier: ${entry.accessTier})`);
          accessCreated++;
        }
      }
    }

    // Rebuild NetworkSearchIndex for horse tenants
    console.log("\n─── Rebuilding NetworkSearchIndex ───");
    const horseTenants = [4, 15, 17, 18, 45];
    for (const tid of horseTenants) {
      for (const sex of ["MALE", "FEMALE"]) {
        // Count visible animals
        const animals = await prisma.animal.findMany({
          where: {
            tenantId: tid,
            species: "HORSE",
            sex,
            networkSearchVisible: true,
          },
          select: { id: true },
        });

        if (animals.length === 0) continue;

        // Aggregate genetics from animal_loci
        const loci = await prisma.$queryRaw`
          SELECT al.locus, array_agg(DISTINCT al.genotype) AS genotypes, al.category
          FROM animal_loci al
          WHERE al.animal_id = ANY(${animals.map((a) => a.id)})
            AND al.genotype IS NOT NULL
          GROUP BY al.locus, al.category
        `;

        const geneticTraits = {};
        const healthClearances = {};
        const healthLoci = new Set(["HYPP", "HERDA", "GBED", "MH", "PSSM1", "OLWS", "PSSM", "CSNB", "SCID", "LFS", "JEB", "WFFS"]);

        for (const row of loci) {
          const genotypes = row.genotypes.filter((g) => g != null);
          if (genotypes.length === 0) continue;

          if (row.category === "health" || healthLoci.has(row.locus)) {
            healthClearances[row.locus] = genotypes;
          } else {
            geneticTraits[row.locus] = genotypes;
          }
        }

        await prisma.networkSearchIndex.upsert({
          where: {
            tenantId_species_sex: { tenantId: tid, species: "HORSE", sex },
          },
          create: {
            tenantId: tid,
            species: "HORSE",
            sex,
            geneticTraits,
            healthClearances,
            animalCount: animals.length,
            lastRebuiltAt: new Date(),
          },
          update: {
            geneticTraits,
            healthClearances,
            animalCount: animals.length,
            lastRebuiltAt: new Date(),
          },
        });

        const traitKeys = Object.keys(geneticTraits).join(", ");
        const healthKeys = Object.keys(healthClearances).join(", ");
        console.log(
          `  ✓ Tenant ${tid} ${sex}: ${animals.length} animals | traits=[${traitKeys}] | health=[${healthKeys}]`
        );
      }
    }

    console.log(`\n✅ Done!`);
    console.log(`   Enriched genetics: ${enriched} animals`);
    console.log(`   AnimalAccess created: ${accessCreated} shadow animals for Katie`);
    console.log(`   NetworkSearchIndex: rebuilt for ${horseTenants.length} tenants`);
    console.log(`\n   Demo flow:`);
    console.log(`   1. Local Search: Genetics Lab → "My Animals" → see Katie's 8 horses`);
    console.log(`   2. Local+Network: Switch to "My Animals + Network" → see shadow animals`);
    console.log(`   3. Network-Wide: "BreederHQ Network" → search for HYPP-clear or Cremello`);
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Merge new loci into existing array without duplicating by locus code.
 * New values override existing ones for the same locus.
 */
function mergeLoci(existing, additions) {
  const map = new Map();
  for (const locus of existing) {
    if (locus?.locus) map.set(locus.locus, locus);
  }
  for (const locus of additions) {
    if (locus?.locus) map.set(locus.locus, locus);
  }
  return Array.from(map.values());
}

main();
