// scripts/enable-trait-history.ts
// Enable supportsHistory for Eye, Cardiac, and Infectious traits
//
// Run with: npx tsx scripts/enable-trait-history.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Trait keys that should support history (exam-type traits that are done periodically)
const TRAITS_TO_ENABLE_HISTORY = [
  // Eyes
  "dog.eyes.caer",
  "cat.eyes.exam",
  // Cardiac
  "dog.cardiac.exam",
  "dog.cardiac.method",
  "cat.cardiac.hcmScreen",
  // Infectious - Dog
  "dog.infectious.brucellosis",
  // Infectious - Cat
  "cat.infectious.felv",
  "cat.infectious.fiv",
  // Infectious - Horse
  "horse.infectious.cogginsStatus",
  // Infectious - Goat
  "goat.infectious.cae",
  "goat.infectious.cl",
  "goat.infectious.johnes",
  // Infectious - Sheep
  "sheep.infectious.johnes",
  "sheep.infectious.opp",
  // Preventative tests (periodic)
  "dog.preventative.heartworm",
  // FAMACHA scores (periodic parasite checks)
  "goat.general.famacha",
  "sheep.general.famacha",
  // Reproductive exams (can be done multiple times)
  "dog.repro.semenAnalysis",
  "horse.repro.semenEvaluation",
  "horse.repro.breedingSoundness",
  // Soundness exams (periodic)
  "horse.soundness.flexionTest",
  "horse.soundness.lamenessExam",
  // Pre-purchase exams (can have multiple over animal's life)
  "horse.general.ppeOutcome",
];

async function main() {
  console.log("Enabling supportsHistory for exam-type traits...\n");

  for (const key of TRAITS_TO_ENABLE_HISTORY) {
    const result = await prisma.traitDefinition.updateMany({
      where: {
        key,
        tenantId: null, // Only update global trait definitions
      },
      data: {
        supportsHistory: true,
      },
    });

    if (result.count > 0) {
      console.log(`  ✓ Enabled history for: ${key}`);
    } else {
      console.log(`  - Trait not found: ${key}`);
    }
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
