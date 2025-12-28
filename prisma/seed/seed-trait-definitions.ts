// prisma/seed/seed-trait-definitions.ts
import "./seed-env-bootstrap";
import { PrismaClient, Species, TraitValueType } from "@prisma/client";

const prisma = new PrismaClient();

type TraitDefinitionSeed = {
  species: Species;
  key: string;
  displayName: string;
  category: string;
  valueType: TraitValueType;
  enumValues?: any;
  requiresDocument: boolean;
  marketplaceVisibleDefault: boolean;
  sortOrder: number;
};

const DOG_TRAIT_DEFINITIONS: TraitDefinitionSeed[] = [
  // Orthopedic Category
  {
    species: Species.DOG,
    key: "dog.hips.ofa",
    displayName: "OFA Hips",
    category: "Orthopedic",
    valueType: TraitValueType.ENUM,
    enumValues: ["Excellent", "Good", "Fair", "Borderline", "Mild", "Moderate", "Severe", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 100,
  },
  {
    species: Species.DOG,
    key: "dog.hips.pennhip",
    displayName: "PennHIP",
    category: "Orthopedic",
    valueType: TraitValueType.JSON,
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 110,
  },
  {
    species: Species.DOG,
    key: "dog.elbows.ofa",
    displayName: "OFA Elbows",
    category: "Orthopedic",
    valueType: TraitValueType.ENUM,
    enumValues: ["Normal", "Grade_I", "Grade_II", "Grade_III", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 120,
  },
  {
    species: Species.DOG,
    key: "dog.patella.luxation",
    displayName: "Patella Luxation",
    category: "Orthopedic",
    valueType: TraitValueType.ENUM,
    enumValues: ["Grade_0", "Grade_1", "Grade_2", "Grade_3", "Grade_4", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 130,
  },

  // Eyes Category
  {
    species: Species.DOG,
    key: "dog.eyes.caer",
    displayName: "CAER Eye Exam",
    category: "Eyes",
    valueType: TraitValueType.ENUM,
    enumValues: ["Normal", "Abnormal", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 200,
  },

  // Cardiac Category
  {
    species: Species.DOG,
    key: "dog.cardiac.exam",
    displayName: "Cardiac Exam",
    category: "Cardiac",
    valueType: TraitValueType.ENUM,
    enumValues: ["Normal", "Abnormal", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 300,
  },
  {
    species: Species.DOG,
    key: "dog.cardiac.method",
    displayName: "Cardiac Method",
    category: "Cardiac",
    valueType: TraitValueType.ENUM,
    enumValues: ["Auscultation", "Echo", "Other", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 310,
  },

  // Genetic Category
  {
    species: Species.DOG,
    key: "dog.genetics.panelCompleted",
    displayName: "Genetic Panel Completed",
    category: "Genetic",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 400,
  },
  {
    species: Species.DOG,
    key: "dog.genetics.summary",
    displayName: "Genetic Summary",
    category: "Genetic",
    valueType: TraitValueType.JSON,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 410,
  },

  // Infectious Category
  {
    species: Species.DOG,
    key: "dog.infectious.brucellosis",
    displayName: "Brucellosis",
    category: "Infectious",
    valueType: TraitValueType.ENUM,
    enumValues: ["Negative", "Positive", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 450,
  },

  // Preventative Category
  {
    species: Species.DOG,
    key: "dog.preventative.heartworm",
    displayName: "Heartworm",
    category: "Preventative",
    valueType: TraitValueType.ENUM,
    enumValues: ["Negative", "Positive", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 470,
  },

  // Reproductive Category
  {
    species: Species.DOG,
    key: "dog.repro.proven",
    displayName: "Proven Breeding Record",
    category: "Reproductive",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 500,
  },
  {
    species: Species.DOG,
    key: "dog.repro.semenAnalysis",
    displayName: "Semen Analysis",
    category: "Reproductive",
    valueType: TraitValueType.ENUM,
    enumValues: ["Normal", "Abnormal", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 510,
  },

  // General Category
  {
    species: Species.DOG,
    key: "dog.general.vaccinationsUpToDate",
    displayName: "Vaccinations up to date",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 600,
  },
  {
    species: Species.DOG,
    key: "dog.general.dewormingCurrent",
    displayName: "Deworming current",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 610,
  },
  {
    species: Species.DOG,
    key: "dog.id.microchip",
    displayName: "Microchipped",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 900,
  },
  {
    species: Species.DOG,
    key: "dog.registry.akcNumber",
    displayName: "AKC Registration Number",
    category: "General",
    valueType: TraitValueType.TEXT,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 910,
  },
];

const HORSE_TRAIT_DEFINITIONS: TraitDefinitionSeed[] = [
  // Orthopedic Category
  {
    species: Species.HORSE,
    key: "horse.soundness.lamenessExam",
    displayName: "Lameness Exam",
    category: "Orthopedic",
    valueType: TraitValueType.ENUM,
    enumValues: ["Sound", "Mild", "Moderate", "Severe", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 100,
  },
  {
    species: Species.HORSE,
    key: "horse.soundness.flexionTest",
    displayName: "Flexion Test",
    category: "Orthopedic",
    valueType: TraitValueType.ENUM,
    enumValues: ["Pass", "Borderline", "Fail", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 110,
  },

  // Infectious Category
  {
    species: Species.HORSE,
    key: "horse.infectious.cogginsStatus",
    displayName: "Coggins Status",
    category: "Infectious",
    valueType: TraitValueType.ENUM,
    enumValues: ["Negative", "Positive", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 400,
  },
  {
    species: Species.HORSE,
    key: "horse.infectious.cogginsDate",
    displayName: "Coggins Date",
    category: "Infectious",
    valueType: TraitValueType.DATE,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 410,
  },

  // Reproductive Category
  {
    species: Species.HORSE,
    key: "horse.repro.breedingSoundness",
    displayName: "Breeding Soundness",
    category: "Reproductive",
    valueType: TraitValueType.ENUM,
    enumValues: ["Pass", "Fail", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 500,
  },
  {
    species: Species.HORSE,
    key: "horse.repro.semenEvaluation",
    displayName: "Semen Evaluation",
    category: "Reproductive",
    valueType: TraitValueType.ENUM,
    enumValues: ["Normal", "Abnormal", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 510,
  },

  // General Category
  {
    species: Species.HORSE,
    key: "horse.general.ppePerformed",
    displayName: "Pre purchase exam performed",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 600,
  },
  {
    species: Species.HORSE,
    key: "horse.general.ppeOutcome",
    displayName: "Pre Purchase Exam Outcome",
    category: "General",
    valueType: TraitValueType.ENUM,
    enumValues: ["Pass", "Conditional", "Fail", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 610,
  },
  {
    species: Species.HORSE,
    key: "horse.general.healthCertCurrent",
    displayName: "Health Certificate Current",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 620,
  },
  {
    species: Species.HORSE,
    key: "horse.general.vaccinationsUpToDate",
    displayName: "Vaccinations up to date",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 630,
  },
];

const CAT_TRAIT_DEFINITIONS: TraitDefinitionSeed[] = [
  // Genetic Category
  {
    species: Species.CAT,
    key: "cat.genetics.panelCompleted",
    displayName: "Genetic Panel Completed",
    category: "Genetic",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 400,
  },
  {
    species: Species.CAT,
    key: "cat.genetics.pkd",
    displayName: "PKD",
    category: "Genetic",
    valueType: TraitValueType.ENUM,
    enumValues: ["Negative", "Positive", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 410,
  },

  // Cardiac Category
  {
    species: Species.CAT,
    key: "cat.cardiac.hcmScreen",
    displayName: "HCM Screen",
    category: "Cardiac",
    valueType: TraitValueType.ENUM,
    enumValues: ["Normal", "Abnormal", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 300,
  },

  // Infectious Category
  {
    species: Species.CAT,
    key: "cat.infectious.felv",
    displayName: "FeLV",
    category: "Infectious",
    valueType: TraitValueType.ENUM,
    enumValues: ["Negative", "Positive", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 450,
  },
  {
    species: Species.CAT,
    key: "cat.infectious.fiv",
    displayName: "FIV",
    category: "Infectious",
    valueType: TraitValueType.ENUM,
    enumValues: ["Negative", "Positive", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 460,
  },

  // Eyes Category
  {
    species: Species.CAT,
    key: "cat.eyes.exam",
    displayName: "Eye Exam",
    category: "Eyes",
    valueType: TraitValueType.ENUM,
    enumValues: ["Normal", "Abnormal", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 200,
  },

  // General Category
  {
    species: Species.CAT,
    key: "cat.general.vaccinationsUpToDate",
    displayName: "Vaccinations up to date",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 600,
  },
];

const GOAT_TRAIT_DEFINITIONS: TraitDefinitionSeed[] = [
  // Infectious Category
  {
    species: Species.GOAT,
    key: "goat.infectious.cae",
    displayName: "CAE",
    category: "Infectious",
    valueType: TraitValueType.ENUM,
    enumValues: ["Negative", "Positive", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 400,
  },
  {
    species: Species.GOAT,
    key: "goat.infectious.cl",
    displayName: "CL",
    category: "Infectious",
    valueType: TraitValueType.ENUM,
    enumValues: ["Negative", "Positive", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 410,
  },
  {
    species: Species.GOAT,
    key: "goat.infectious.johnes",
    displayName: "Johnes",
    category: "Infectious",
    valueType: TraitValueType.ENUM,
    enumValues: ["Negative", "Positive", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 420,
  },

  // Reproductive Category
  {
    species: Species.GOAT,
    key: "goat.repro.proven",
    displayName: "Proven",
    category: "Reproductive",
    valueType: TraitValueType.ENUM,
    enumValues: ["Proven", "Unproven", "Unknown"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 500,
  },

  // General Category
  {
    species: Species.GOAT,
    key: "goat.general.famacha",
    displayName: "FAMACHA",
    category: "General",
    valueType: TraitValueType.ENUM,
    enumValues: ["1", "2", "3", "4", "5", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 600,
  },
  {
    species: Species.GOAT,
    key: "goat.general.vaccinationsUpToDate",
    displayName: "Vaccinations up to date",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 610,
  },
  {
    species: Species.GOAT,
    key: "goat.general.dewormingCurrent",
    displayName: "Deworming current",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 620,
  },
];

const SHEEP_TRAIT_DEFINITIONS: TraitDefinitionSeed[] = [
  // Infectious Category
  {
    species: Species.SHEEP,
    key: "sheep.infectious.opp",
    displayName: "OPP",
    category: "Infectious",
    valueType: TraitValueType.ENUM,
    enumValues: ["Negative", "Positive", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 400,
  },
  {
    species: Species.SHEEP,
    key: "sheep.infectious.johnes",
    displayName: "Johnes",
    category: "Infectious",
    valueType: TraitValueType.ENUM,
    enumValues: ["Negative", "Positive", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 410,
  },

  // Reproductive Category
  {
    species: Species.SHEEP,
    key: "sheep.repro.proven",
    displayName: "Proven",
    category: "Reproductive",
    valueType: TraitValueType.ENUM,
    enumValues: ["Proven", "Unproven", "Unknown"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 500,
  },

  // General Category
  {
    species: Species.SHEEP,
    key: "sheep.general.famacha",
    displayName: "FAMACHA",
    category: "General",
    valueType: TraitValueType.ENUM,
    enumValues: ["1", "2", "3", "4", "5", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 600,
  },
  {
    species: Species.SHEEP,
    key: "sheep.general.vaccinationsUpToDate",
    displayName: "Vaccinations up to date",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 610,
  },
  {
    species: Species.SHEEP,
    key: "sheep.general.dewormingCurrent",
    displayName: "Deworming current",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 620,
  },
];

const RABBIT_TRAIT_DEFINITIONS: TraitDefinitionSeed[] = [
  // Reproductive Category
  {
    species: Species.RABBIT,
    key: "rabbit.repro.proven",
    displayName: "Proven",
    category: "Reproductive",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 500,
  },

  // General Category
  {
    species: Species.RABBIT,
    key: "rabbit.general.vetHealthCheck",
    displayName: "Vet Health Check",
    category: "General",
    valueType: TraitValueType.ENUM,
    enumValues: ["Pass", "Conditional", "Fail", "Pending"],
    requiresDocument: true,
    marketplaceVisibleDefault: false,
    sortOrder: 600,
  },
  {
    species: Species.RABBIT,
    key: "rabbit.general.vaccinationsUpToDate",
    displayName: "Vaccinations up to date",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 610,
  },
  {
    species: Species.RABBIT,
    key: "rabbit.general.spayNeuter",
    displayName: "Spay/Neuter Status",
    category: "General",
    valueType: TraitValueType.ENUM,
    enumValues: ["Intact", "Altered", "Pending"],
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 620,
  },
];

async function seedTraitDefinitions() {
  console.log("🌱 Seeding trait definitions...");

  const allSpeciesDefinitions = [
    { species: Species.DOG, definitions: DOG_TRAIT_DEFINITIONS },
    { species: Species.HORSE, definitions: HORSE_TRAIT_DEFINITIONS },
    { species: Species.CAT, definitions: CAT_TRAIT_DEFINITIONS },
    { species: Species.GOAT, definitions: GOAT_TRAIT_DEFINITIONS },
    { species: Species.SHEEP, definitions: SHEEP_TRAIT_DEFINITIONS },
    { species: Species.RABBIT, definitions: RABBIT_TRAIT_DEFINITIONS },
  ];

  const counts: Record<string, number> = {};

  for (const { species, definitions } of allSpeciesDefinitions) {
    // Delete and recreate for idempotency (Prisma doesn't support null in upsert where clause)
    await prisma.traitDefinition.deleteMany({
      where: {
        species,
        tenantId: null,
      },
    });

    // Insert all trait definitions for this species
    for (const def of definitions) {
      await prisma.traitDefinition.create({
        data: {
          tenantId: null, // Global trait definitions
          species: def.species,
          key: def.key,
          displayName: def.displayName,
          category: def.category,
          valueType: def.valueType,
          enumValues: def.enumValues || null,
          requiresDocument: def.requiresDocument,
          marketplaceVisibleDefault: def.marketplaceVisibleDefault,
          sortOrder: def.sortOrder,
        },
      });
    }

    counts[species] = definitions.length;
    console.log(`✅ Seeded ${definitions.length} ${species} trait definitions (global, tenantId=null)`);
  }

  // Summary
  console.log("\n📊 Seed Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const [species, count] of Object.entries(counts)) {
    console.log(`  ${species.padEnd(10)} ${count.toString().padStart(3)} traits`);
  }
  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Total:     ${total.toString().padStart(3)} traits`);
  console.log("");
}

seedTraitDefinitions()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
