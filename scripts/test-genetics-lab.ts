#!/usr/bin/env npx tsx
/**
 * Genetics Lab Automated Test Suite
 *
 * This script tests the genetics calculation logic by:
 * 1. Fetching test animals from the database
 * 2. Running genetic pairing calculations
 * 3. Validating expected warnings and outcomes
 *
 * Usage:
 *   npx dotenv -e .env.dev -- npx tsx scripts/test-genetics-lab.ts
 */

// ═══════════════════════════════════════════════════════════════════════════════
// GENETICS CALCULATION ENGINE (copied from frontend for testing)
// ═══════════════════════════════════════════════════════════════════════════════

// Species-specific phenotype maps
const SPECIES_PHENOTYPE_MAPS: Record<string, Record<string, Record<string, string>>> = {
  DOG: {
    A: {
      "Ay/Ay": "Sable/Fawn",
      "Ay/aw": "Sable/Fawn (carries wild)",
      "Ay/at": "Sable/Fawn (carries tan points)",
      "Ay/a": "Sable/Fawn (carries recessive black)",
      "aw/aw": "Wild Sable/Agouti",
      "aw/at": "Wild Sable (carries tan points)",
      "aw/a": "Wild Sable (carries recessive black)",
      "at/at": "Tan Points/Tricolor",
      "at/a": "Tan Points (carries recessive black)",
      "a/a": "Recessive Black/Solid",
    },
    B: {
      "B/B": "Black pigment",
      "B/b": "Black pigment (carries brown)",
      "b/b": "Brown/Chocolate/Liver pigment",
    },
    D: {
      "D/D": "Full color intensity",
      "D/d": "Full color (carries dilute)",
      "d/d": "Dilute (Blue/Isabella/Lilac)",
    },
    E: {
      "Em/Em": "Melanistic Mask",
      "Em/E": "Melanistic Mask",
      "Em/e": "Melanistic Mask (carries cream)",
      "E/E": "Normal extension",
      "E/e": "Normal (carries cream/red)",
      "e/e": "Cream/Red/Yellow (no black pigment)",
    },
    K: {
      "KB/KB": "Dominant Black (solid)",
      "KB/kbr": "Dominant Black (carries brindle)",
      "KB/ky": "Dominant Black (carries pattern)",
      "kbr/kbr": "Brindle",
      "kbr/ky": "Brindle (carries pattern)",
      "ky/ky": "Agouti pattern expressed",
    },
    M: {
      "M/M": "Double Merle (health risk!)",
      "M/m": "Merle pattern",
      "m/m": "Non-merle (solid)",
    },
    S: {
      "S/S": "Solid (no white)",
      "S/sp": "Solid (carries piebald)",
      "sp/sp": "Piebald/Parti (white patches)",
    },
    F: {
      "F/F": "Furnished (teddy bear face)",
      "F/f": "Furnished (carries unfurnished)",
      "f/f": "Unfurnished (smooth face)",
    },
    L: {
      "L/L": "Short coat",
      "L/l": "Short coat (carries long)",
      "l/l": "Long coat",
    },
    L4: {
      "L4/L4": "Fluffy coat",
      "L4/N": "Fluffy carrier",
      "N/N": "Normal coat",
    },
  },
  HORSE: {
    O: {
      "O/O": "Lethal White Overo Syndrome (fatal)",
      "O/n": "Frame Overo pattern",
      "n/n": "Non-frame",
    },
    TO: {
      "TO/TO": "Tobiano (homozygous)",
      "TO/to": "Tobiano",
      "to/to": "Non-tobiano",
    },
  },
  RABBIT: {
    En: {
      "En/En": "Charlie (mostly white - health risk)",
      "En/en": "Broken pattern",
      "en/en": "Solid (no spots)",
    },
    V: {
      "V/V": "Normal eyes",
      "V/v": "Vienna carrier (may show blue)",
      "v/v": "BEW (Blue-Eyed White)",
    },
  },
  GOAT: {
    P: {
      "P/P": "Polled (hornless) - intersex risk",
      "P/p": "Polled (hornless)",
      "p/p": "Horned",
    },
  },
  CAT: {
    C: {
      "C/C": "Full color",
      "C/cs": "Full color (carries pointed)",
      "cs/cs": "Colorpoint/Siamese pattern",
    },
  },
};

// Species-specific dangerous pairings
const SPECIES_WARNINGS: Record<string, Array<{locus: string, genotype: string, message: string, severity: string, scorePenalty: number}>> = {
  DOG: [
    { locus: "M", genotype: "M/M", message: "DOUBLE MERLE: Can produce deaf/blind offspring", severity: "danger", scorePenalty: 50 },
  ],
  CAT: [],
  HORSE: [
    { locus: "O", genotype: "O/O", message: "LETHAL WHITE OVERO: Foals will not survive", severity: "danger", scorePenalty: 100 },
  ],
  RABBIT: [
    { locus: "En", genotype: "En/En", message: "CHARLIE: May have digestive issues", severity: "warning", scorePenalty: 20 },
  ],
  GOAT: [
    { locus: "P", genotype: "P/P", message: "POLLED x POLLED: Risk of intersex offspring", severity: "danger", scorePenalty: 30 },
  ],
};

function getPhenotype(species: string, locus: string, genotype: string): string {
  const speciesMap = SPECIES_PHENOTYPE_MAPS[species?.toUpperCase()] || SPECIES_PHENOTYPE_MAPS["DOG"];
  const locusMap = speciesMap[locus];
  if (!locusMap) return genotype;

  // Try both orderings
  const phenotype = locusMap[genotype];
  if (phenotype) return phenotype;

  // Try reversed
  const parts = genotype.split('/');
  if (parts.length === 2) {
    const reversed = `${parts[1]}/${parts[0]}`;
    const reversedPhenotype = locusMap[reversed];
    if (reversedPhenotype) return reversedPhenotype;
  }

  return genotype;
}

function calculateGeneticPairing(damGenetics: any, sireGenetics: any, species: string = "DOG") {
  const results: any = {
    coatColor: [],
    coatType: [],
    physicalTraits: [],
    health: [],
    warnings: [],
    score: 100,
  };

  // Process coat color
  if (damGenetics?.coatColor && sireGenetics?.coatColor) {
    const damLoci = new Map(damGenetics.coatColor.map((l: any) => [l.locus, l]));
    const sireLoci = new Map(sireGenetics.coatColor.map((l: any) => [l.locus, l]));
    const allLoci = new Set([...damLoci.keys(), ...sireLoci.keys()]);

    for (const locus of allLoci) {
      const damLocus = damLoci.get(locus) as any;
      const sireLocus = sireLoci.get(locus) as any;
      if (!damLocus || !sireLocus) continue;
      if (!damLocus.allele1 || !damLocus.allele2 || !sireLocus.allele1 || !sireLocus.allele2) continue;

      const offspring = [
        `${damLocus.allele1}/${sireLocus.allele1}`,
        `${damLocus.allele1}/${sireLocus.allele2}`,
        `${damLocus.allele2}/${sireLocus.allele1}`,
        `${damLocus.allele2}/${sireLocus.allele2}`,
      ];

      const genotypeCounts = new Map<string, number>();
      offspring.forEach((gt) => {
        const parts = gt.split('/');
        const normalized = parts.sort().join('/');
        genotypeCounts.set(normalized, (genotypeCounts.get(normalized) || 0) + 25);
      });

      const predictionParts: string[] = [];
      for (const [genotype, percentage] of genotypeCounts.entries()) {
        const phenotype = getPhenotype(species, locus, genotype);
        predictionParts.push(`${percentage}% ${phenotype}`);
      }

      results.coatColor.push({
        locus,
        damGenotype: `${damLocus.allele1}/${damLocus.allele2}`,
        sireGenotype: `${sireLocus.allele1}/${sireLocus.allele2}`,
        prediction: predictionParts.join(', '),
        genotypeCounts: Object.fromEntries(genotypeCounts),
      });
    }

    // Check warnings
    const speciesWarnings = SPECIES_WARNINGS[species?.toUpperCase()] || [];
    for (const warning of speciesWarnings) {
      const damLocus = damLoci.get(warning.locus) as any;
      const sireLocus = sireLoci.get(warning.locus) as any;
      if (damLocus && sireLocus) {
        const dangerousAllele = warning.genotype.split('/')[0];
        const damHas = damLocus.allele1 === dangerousAllele || damLocus.allele2 === dangerousAllele;
        const sireHas = sireLocus.allele1 === dangerousAllele || sireLocus.allele2 === dangerousAllele;
        if (damHas && sireHas) {
          results.warnings.push({
            severity: warning.severity,
            message: warning.message,
            locus: warning.locus,
          });
          results.score -= warning.scorePenalty;
        }
      }
    }
  }

  // Process physical traits (for goat polled check)
  if (damGenetics?.physicalTraits && sireGenetics?.physicalTraits) {
    const damLoci = new Map(damGenetics.physicalTraits.map((l: any) => [l.locus, l]));
    const sireLoci = new Map(sireGenetics.physicalTraits.map((l: any) => [l.locus, l]));

    // Check goat polled warning
    if (species?.toUpperCase() === "GOAT") {
      const damP = damLoci.get("P") as any;
      const sireP = sireLoci.get("P") as any;
      if (damP && sireP) {
        const damHasP = damP.allele1 === "P" || damP.allele2 === "P";
        const sireHasP = sireP.allele1 === "P" || sireP.allele2 === "P";
        if (damHasP && sireHasP) {
          results.warnings.push({
            severity: "danger",
            message: "POLLED x POLLED: Risk of intersex offspring",
            locus: "P",
          });
          results.score -= 30;
        }
      }
    }
  }

  // Process coat type (for furnishings)
  if (damGenetics?.coatType && sireGenetics?.coatType) {
    const damLoci = new Map(damGenetics.coatType.map((l: any) => [l.locus, l]));
    const sireLoci = new Map(sireGenetics.coatType.map((l: any) => [l.locus, l]));
    const allLoci = new Set([...damLoci.keys(), ...sireLoci.keys()]);

    for (const locus of allLoci) {
      const damLocus = damLoci.get(locus) as any;
      const sireLocus = sireLoci.get(locus) as any;
      if (!damLocus || !sireLocus) continue;
      if (!damLocus.allele1 || !damLocus.allele2 || !sireLocus.allele1 || !sireLocus.allele2) continue;

      const offspring = [
        `${damLocus.allele1}/${sireLocus.allele1}`,
        `${damLocus.allele1}/${sireLocus.allele2}`,
        `${damLocus.allele2}/${sireLocus.allele1}`,
        `${damLocus.allele2}/${sireLocus.allele2}`,
      ];

      const genotypeCounts = new Map<string, number>();
      offspring.forEach((gt) => {
        const parts = gt.split('/');
        const normalized = parts.sort().join('/');
        genotypeCounts.set(normalized, (genotypeCounts.get(normalized) || 0) + 25);
      });

      const predictionParts: string[] = [];
      for (const [genotype, percentage] of genotypeCounts.entries()) {
        const phenotype = getPhenotype(species, locus, genotype);
        predictionParts.push(`${percentage}% ${phenotype}`);
      }

      results.coatType.push({
        locus,
        damGenotype: `${damLocus.allele1}/${damLocus.allele2}`,
        sireGenotype: `${sireLocus.allele1}/${sireLocus.allele2}`,
        prediction: predictionParts.join(', '),
        genotypeCounts: Object.fromEntries(genotypeCounts),
      });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════════════════════

interface TestCase {
  name: string;
  damName: string;
  sireName: string;
  species: string;
  expectedWarnings: string[];
  expectedOutcomes: Array<{
    category: string;
    locus: string;
    mustContain: string[];
  }>;
  scoreRange: [number, number];
}

const TEST_CASES: TestCase[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // DOG TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Double Merle Warning (Dogs)",
    damName: "Luna (Merle Carrier Female)",
    sireName: "Maverick (Merle Carrier Male)",
    species: "DOG",
    expectedWarnings: ["DOUBLE MERLE"],
    expectedOutcomes: [
      { category: "coatColor", locus: "M", mustContain: ["25% Double Merle", "50% Merle", "25% Non-merle"] },
    ],
    scoreRange: [0, 60],
  },
  {
    name: "Safe Merle Breeding (Dogs)",
    damName: "Luna (Merle Carrier Female)",
    sireName: "Shadow (Non-Merle Male)",
    species: "DOG",
    expectedWarnings: [],
    expectedOutcomes: [
      { category: "coatColor", locus: "M", mustContain: ["50% Merle", "50% Non-merle"] },
    ],
    scoreRange: [80, 100],
  },
  {
    name: "Furnished Doodle Breeding",
    damName: "Bella (Furnished Goldendoodle Dam)",
    sireName: "Cooper (Furnished Carrier Poodle)",
    species: "DOG",
    expectedWarnings: [],
    expectedOutcomes: [
      { category: "coatType", locus: "F", mustContain: ["Furnished"] },
    ],
    scoreRange: [80, 100],
  },
  {
    name: "Fluffy French Bulldog Carrier x Carrier",
    damName: "Fifi (Fluffy Carrier Frenchie Female)",
    sireName: "Pierre (Fluffy Carrier Frenchie)",
    species: "DOG",
    expectedWarnings: [],
    expectedOutcomes: [
      { category: "coatType", locus: "L4", mustContain: ["25% Fluffy coat", "50% Fluffy carrier", "25% Normal coat"] },
    ],
    scoreRange: [80, 100],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // HORSE TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Lethal White Overo Warning (Horses)",
    damName: "Painted Lady (Frame Overo Mare)",
    sireName: "Storm Chaser (Frame Overo Stallion)",
    species: "HORSE",
    expectedWarnings: ["LETHAL WHITE OVERO"],
    expectedOutcomes: [
      { category: "coatColor", locus: "O", mustContain: ["25% Lethal White", "50% Frame Overo"] },
    ],
    scoreRange: [0, 20],
  },
  {
    name: "Safe Paint Breeding (Horses)",
    damName: "Painted Lady (Frame Overo Mare)",
    sireName: "Midnight Run (Safe Tobiano Stallion)",
    species: "HORSE",
    expectedWarnings: [],
    expectedOutcomes: [
      { category: "coatColor", locus: "O", mustContain: ["50% Frame Overo", "50% Non-frame"] },
    ],
    scoreRange: [80, 100],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // RABBIT TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Charlie Pattern Warning (Rabbits)",
    damName: "Patches (Broken Pattern Carrier)",
    sireName: "Oreo (Broken Pattern Male)",
    species: "RABBIT",
    expectedWarnings: ["CHARLIE"],
    expectedOutcomes: [
      { category: "coatColor", locus: "En", mustContain: ["25% Charlie", "50% Broken"] },
    ],
    scoreRange: [60, 90],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GOAT TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Polled x Polled Warning (Goats)",
    damName: "Buttercup (Polled Doe)",
    sireName: "Thunder (Polled Buck)",
    species: "GOAT",
    expectedWarnings: ["POLLED x POLLED"],
    expectedOutcomes: [],
    scoreRange: [50, 80],
  },
  {
    name: "Safe Goat Breeding (Horned x Polled)",
    damName: "Clover (Horned Doe)",
    sireName: "Thunder (Polled Buck)",
    species: "GOAT",
    expectedWarnings: [],
    expectedOutcomes: [],
    scoreRange: [80, 100],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getAnimalGenetics(tenantId: number, name: string) {
  const animal = await prisma.animal.findFirst({
    where: { tenantId, name },
    include: { genetics: true },
  });

  if (!animal) {
    throw new Error(`Animal not found: ${name}`);
  }

  if (!animal.genetics) {
    throw new Error(`No genetics data for: ${name}`);
  }

  return {
    animal,
    genetics: {
      coatColor: animal.genetics.coatColorData as any[] || [],
      coatType: animal.genetics.coatTypeData as any[] || [],
      physicalTraits: animal.genetics.physicalTraitsData as any[] || [],
      eyeColor: animal.genetics.eyeColorData as any[] || [],
      health: animal.genetics.healthGeneticsData as any[] || [],
    },
  };
}

async function runTests() {
  console.log('🧬 Genetics Lab Automated Test Suite\n');
  console.log('═'.repeat(70));

  // Find Luke's tenant
  const lukeUser = await prisma.user.findFirst({
    where: { email: 'luke.skywalker@tester.local' }
  });

  if (!lukeUser) {
    console.error('❌ luke.skywalker@tester.local not found!');
    process.exit(1);
  }

  const membership = await prisma.tenantMembership.findFirst({
    where: { userId: lukeUser.id },
  });

  if (!membership) {
    console.error('❌ No tenant membership for Luke!');
    process.exit(1);
  }

  const tenantId = membership.tenantId;
  console.log(`📍 Testing against tenant ID: ${tenantId}\n`);

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const testCase of TEST_CASES) {
    console.log(`\n🧪 ${testCase.name}`);
    console.log('─'.repeat(70));

    try {
      // Get genetics for both animals
      const dam = await getAnimalGenetics(tenantId, testCase.damName);
      const sire = await getAnimalGenetics(tenantId, testCase.sireName);

      console.log(`   Dam:  ${testCase.damName} (${dam.animal.species})`);
      console.log(`   Sire: ${testCase.sireName} (${sire.animal.species})`);

      // Run calculation
      const results = calculateGeneticPairing(dam.genetics, sire.genetics, testCase.species);

      // Check warnings
      const warningMessages = results.warnings.map((w: any) => w.message);
      let warningsPassed = true;

      for (const expectedWarning of testCase.expectedWarnings) {
        const found = warningMessages.some((msg: string) => msg.includes(expectedWarning));
        if (!found) {
          warningsPassed = false;
          console.log(`   ❌ FAIL: Expected warning "${expectedWarning}" not found`);
          console.log(`      Got: ${warningMessages.join(', ') || '(none)'}`);
        } else {
          console.log(`   ✅ Warning found: ${expectedWarning}`);
        }
      }

      // Check no unexpected warnings
      if (testCase.expectedWarnings.length === 0 && results.warnings.length > 0) {
        warningsPassed = false;
        console.log(`   ❌ FAIL: Expected no warnings but got: ${warningMessages.join(', ')}`);
      } else if (testCase.expectedWarnings.length === 0) {
        console.log(`   ✅ No warnings (as expected)`);
      }

      // Check expected outcomes
      let outcomesPassed = true;
      for (const expected of testCase.expectedOutcomes) {
        const category = results[expected.category] as any[];
        const locusResult = category?.find((r: any) => r.locus === expected.locus);

        if (!locusResult) {
          outcomesPassed = false;
          console.log(`   ❌ FAIL: No result for ${expected.category}.${expected.locus}`);
          continue;
        }

        for (const mustContain of expected.mustContain) {
          if (!locusResult.prediction.includes(mustContain)) {
            outcomesPassed = false;
            console.log(`   ❌ FAIL: ${expected.locus} prediction missing "${mustContain}"`);
            console.log(`      Got: ${locusResult.prediction}`);
          } else {
            console.log(`   ✅ ${expected.locus}: Contains "${mustContain}"`);
          }
        }
      }

      // Check score range
      const [minScore, maxScore] = testCase.scoreRange;
      const scorePassed = results.score >= minScore && results.score <= maxScore;
      if (!scorePassed) {
        console.log(`   ❌ FAIL: Score ${results.score} not in expected range [${minScore}, ${maxScore}]`);
      } else {
        console.log(`   ✅ Score: ${results.score} (expected ${minScore}-${maxScore})`);
      }

      // Overall result
      if (warningsPassed && outcomesPassed && scorePassed) {
        console.log(`   ✅ PASSED`);
        passed++;
      } else {
        console.log(`   ❌ FAILED`);
        failed++;
        failures.push(testCase.name);
      }

    } catch (err: any) {
      console.log(`   ❌ ERROR: ${err.message}`);
      failed++;
      failures.push(`${testCase.name} (ERROR: ${err.message})`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(70));
  console.log(`   Total:  ${TEST_CASES.length}`);
  console.log(`   Passed: ${passed} ✅`);
  console.log(`   Failed: ${failed} ❌`);

  if (failures.length > 0) {
    console.log('\n   Failed tests:');
    failures.forEach(f => console.log(`   - ${f}`));
  }

  console.log('\n' + '═'.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }

  console.log('🎉 All tests passed!\n');
}

runTests()
  .catch((e) => {
    console.error('❌ Test suite failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
