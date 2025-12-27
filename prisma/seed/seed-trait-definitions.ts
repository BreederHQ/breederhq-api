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
    key: "dog.id.microchip",
    displayName: "Microchipped",
    category: "General",
    valueType: TraitValueType.BOOLEAN,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 600,
  },
  {
    species: Species.DOG,
    key: "dog.registry.akcNumber",
    displayName: "AKC Registration Number",
    category: "General",
    valueType: TraitValueType.TEXT,
    requiresDocument: false,
    marketplaceVisibleDefault: false,
    sortOrder: 610,
  },
];

async function seedTraitDefinitions() {
  console.log("🌱 Seeding trait definitions...");

  // First, delete existing global dog trait definitions to allow clean upsert
  await prisma.traitDefinition.deleteMany({
    where: {
      species: Species.DOG,
      tenantId: null,
    },
  });

  // Insert all trait definitions
  for (const def of DOG_TRAIT_DEFINITIONS) {
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

  console.log(`✅ Seeded ${DOG_TRAIT_DEFINITIONS.length} DOG trait definitions (global, tenantId=null)`);
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
