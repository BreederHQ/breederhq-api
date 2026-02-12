// prisma/seed/seed-trait-definitions.ts
// Seeds global trait definitions for all species health traits
import "./seed-env-bootstrap";
import { PrismaClient, Species } from "@prisma/client";

const prisma = new PrismaClient();

type TraitValueType = "BOOLEAN" | "TEXT" | "NUMBER" | "DATE" | "JSON" | "ENUM";

type TraitDefinitionSeed = {
  species: Species;
  key: string;
  displayName: string;
  category: string;
  valueType: TraitValueType;
  enumValues?: string[];
  requiresDocument?: boolean;
  marketplaceVisibleDefault?: boolean;
  supportsHistory?: boolean;
  sortOrder: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// DOG Trait Definitions
// ─────────────────────────────────────────────────────────────────────────────

const DOG_TRAITS: TraitDefinitionSeed[] = [
  // Orthopedic
  { species: Species.DOG, key: "dog.hips.ofa", displayName: "OFA Hips", category: "Orthopedic", valueType: "ENUM", enumValues: ["Excellent", "Good", "Fair", "Borderline", "Mild", "Moderate", "Severe"], sortOrder: 10 },
  { species: Species.DOG, key: "dog.hips.pennhip", displayName: "PennHIP", category: "Orthopedic", valueType: "JSON", sortOrder: 11 },
  { species: Species.DOG, key: "dog.elbows.ofa", displayName: "OFA Elbows", category: "Orthopedic", valueType: "ENUM", enumValues: ["Normal", "Grade I", "Grade II", "Grade III"], sortOrder: 12 },
  { species: Species.DOG, key: "dog.patellas.ofa", displayName: "OFA Patellas", category: "Orthopedic", valueType: "ENUM", enumValues: ["Normal", "Grade I", "Grade II", "Grade III", "Grade IV"], sortOrder: 13 },
  // Eyes
  { species: Species.DOG, key: "dog.eyes.caer", displayName: "CAER Eye Exam", category: "Eyes", valueType: "ENUM", enumValues: ["Normal", "Breeder Option", "Affected"], supportsHistory: true, sortOrder: 20 },
  // Cardiac
  { species: Species.DOG, key: "dog.cardiac.exam", displayName: "Cardiac Exam", category: "Cardiac", valueType: "ENUM", enumValues: ["Normal", "Equivocal", "Abnormal"], supportsHistory: true, sortOrder: 30 },
  { species: Species.DOG, key: "dog.cardiac.method", displayName: "Cardiac Method", category: "Cardiac", valueType: "ENUM", enumValues: ["Auscultation", "Echo", "Holter"], supportsHistory: true, sortOrder: 31 },
  // Genetic
  { species: Species.DOG, key: "dog.genetics.panelCompleted", displayName: "Genetic Panel Completed", category: "Genetic", valueType: "BOOLEAN", sortOrder: 40 },
  { species: Species.DOG, key: "dog.genetics.summary", displayName: "Genetics Summary", category: "Genetic", valueType: "TEXT", sortOrder: 41 },
  // Infectious
  { species: Species.DOG, key: "dog.infectious.brucellosis", displayName: "Brucellosis", category: "Infectious", valueType: "ENUM", enumValues: ["Negative", "Positive"], supportsHistory: true, sortOrder: 50 },
  // Preventative
  { species: Species.DOG, key: "dog.preventative.heartworm", displayName: "Heartworm Test", category: "Preventative", valueType: "ENUM", enumValues: ["Negative", "Positive"], supportsHistory: true, sortOrder: 60 },
  // Reproductive
  { species: Species.DOG, key: "dog.repro.proven", displayName: "Proven Breeder", category: "Reproductive", valueType: "BOOLEAN", sortOrder: 70 },
  { species: Species.DOG, key: "dog.repro.semenAnalysis", displayName: "Semen Analysis", category: "Reproductive", valueType: "ENUM", enumValues: ["Normal", "Abnormal", "Low Count", "Poor Motility"], supportsHistory: true, sortOrder: 71 },
  { species: Species.DOG, key: "dog.repro.breedingSoundness", displayName: "Breeding Soundness Exam", category: "Reproductive", valueType: "ENUM", enumValues: ["Pass", "Conditional", "Fail"], supportsHistory: true, sortOrder: 72 },
  // General
  { species: Species.DOG, key: "dog.general.vaccinationsUpToDate", displayName: "Vaccinations Up To Date", category: "General", valueType: "BOOLEAN", sortOrder: 80 },
  { species: Species.DOG, key: "dog.general.dewormingCurrent", displayName: "Deworming Current", category: "General", valueType: "BOOLEAN", sortOrder: 81 },
  // Identity
  { species: Species.DOG, key: "dog.id.microchip", displayName: "Microchipped", category: "Identity", valueType: "BOOLEAN", sortOrder: 90 },
  { species: Species.DOG, key: "dog.registry.akcNumber", displayName: "AKC Number", category: "Identity", valueType: "TEXT", sortOrder: 91 },
];

// ─────────────────────────────────────────────────────────────────────────────
// CAT Trait Definitions
// ─────────────────────────────────────────────────────────────────────────────

const CAT_TRAITS: TraitDefinitionSeed[] = [
  // Genetic
  { species: Species.CAT, key: "cat.genetics.panelCompleted", displayName: "Genetic Panel Completed", category: "Genetic", valueType: "BOOLEAN", sortOrder: 10 },
  { species: Species.CAT, key: "cat.genetics.pkd", displayName: "PKD Status", category: "Genetic", valueType: "ENUM", enumValues: ["Negative", "Carrier", "Positive"], sortOrder: 11 },
  // Eyes
  { species: Species.CAT, key: "cat.eyes.exam", displayName: "Eye Exam", category: "Eyes", valueType: "ENUM", enumValues: ["Normal", "Abnormal"], supportsHistory: true, sortOrder: 20 },
  // Cardiac
  { species: Species.CAT, key: "cat.cardiac.hcmScreen", displayName: "HCM Screen", category: "Cardiac", valueType: "ENUM", enumValues: ["Normal", "Equivocal", "Positive"], supportsHistory: true, sortOrder: 30 },
  // Infectious
  { species: Species.CAT, key: "cat.infectious.felv", displayName: "FeLV Test", category: "Infectious", valueType: "ENUM", enumValues: ["Negative", "Positive"], supportsHistory: true, sortOrder: 40 },
  { species: Species.CAT, key: "cat.infectious.fiv", displayName: "FIV Test", category: "Infectious", valueType: "ENUM", enumValues: ["Negative", "Positive"], supportsHistory: true, sortOrder: 41 },
  // Reproductive
  { species: Species.CAT, key: "cat.repro.proven", displayName: "Proven Breeder", category: "Reproductive", valueType: "BOOLEAN", sortOrder: 50 },
  { species: Species.CAT, key: "cat.repro.semenAnalysis", displayName: "Semen Analysis", category: "Reproductive", valueType: "ENUM", enumValues: ["Normal", "Abnormal", "Low Count", "Poor Motility"], supportsHistory: true, sortOrder: 51 },
  { species: Species.CAT, key: "cat.repro.breedingSoundness", displayName: "Breeding Soundness Exam", category: "Reproductive", valueType: "ENUM", enumValues: ["Pass", "Conditional", "Fail"], supportsHistory: true, sortOrder: 52 },
  // General
  { species: Species.CAT, key: "cat.general.vaccinationsUpToDate", displayName: "Vaccinations Up To Date", category: "General", valueType: "BOOLEAN", sortOrder: 60 },
];

// ─────────────────────────────────────────────────────────────────────────────
// HORSE Trait Definitions
// ─────────────────────────────────────────────────────────────────────────────

const HORSE_TRAITS: TraitDefinitionSeed[] = [
  // Soundness/Orthopedic
  { species: Species.HORSE, key: "horse.soundness.lamenessExam", displayName: "Lameness Exam", category: "Orthopedic", valueType: "ENUM", enumValues: ["Sound", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"], supportsHistory: true, sortOrder: 10 },
  { species: Species.HORSE, key: "horse.soundness.flexionTest", displayName: "Flexion Test", category: "Orthopedic", valueType: "ENUM", enumValues: ["Pass", "Mild", "Moderate", "Severe"], supportsHistory: true, sortOrder: 11 },
  // Infectious
  { species: Species.HORSE, key: "horse.infectious.cogginsStatus", displayName: "Coggins Status", category: "Infectious", valueType: "ENUM", enumValues: ["Negative", "Positive"], supportsHistory: true, sortOrder: 20 },
  { species: Species.HORSE, key: "horse.infectious.cogginsDate", displayName: "Coggins Date", category: "Infectious", valueType: "DATE", sortOrder: 21 },
  // Reproductive
  { species: Species.HORSE, key: "horse.repro.breedingSoundness", displayName: "Breeding Soundness Exam", category: "Reproductive", valueType: "ENUM", enumValues: ["Pass", "Conditional", "Fail"], supportsHistory: true, sortOrder: 30 },
  { species: Species.HORSE, key: "horse.repro.semenEvaluation", displayName: "Semen Evaluation", category: "Reproductive", valueType: "ENUM", enumValues: ["Excellent", "Good", "Fair", "Poor"], supportsHistory: true, sortOrder: 31 },
  { species: Species.HORSE, key: "horse.repro.proven", displayName: "Proven Breeder", category: "Reproductive", valueType: "BOOLEAN", sortOrder: 32 },
  // General
  { species: Species.HORSE, key: "horse.general.ppePerformed", displayName: "Pre-Purchase Exam Performed", category: "General", valueType: "BOOLEAN", sortOrder: 40 },
  { species: Species.HORSE, key: "horse.general.ppeOutcome", displayName: "Pre-Purchase Exam Outcome", category: "General", valueType: "ENUM", enumValues: ["Pass", "Pass with Findings", "Fail"], supportsHistory: true, sortOrder: 41 },
  { species: Species.HORSE, key: "horse.general.healthCertCurrent", displayName: "Health Certificate Current", category: "General", valueType: "BOOLEAN", sortOrder: 42 },
  { species: Species.HORSE, key: "horse.general.vaccinationsUpToDate", displayName: "Vaccinations Up To Date", category: "General", valueType: "BOOLEAN", sortOrder: 43 },
];

// ─────────────────────────────────────────────────────────────────────────────
// GOAT Trait Definitions
// ─────────────────────────────────────────────────────────────────────────────

const GOAT_TRAITS: TraitDefinitionSeed[] = [
  // Infectious
  { species: Species.GOAT, key: "goat.infectious.cae", displayName: "CAE Test", category: "Infectious", valueType: "ENUM", enumValues: ["Negative", "Positive"], supportsHistory: true, sortOrder: 10 },
  { species: Species.GOAT, key: "goat.infectious.cl", displayName: "CL Test", category: "Infectious", valueType: "ENUM", enumValues: ["Negative", "Positive"], supportsHistory: true, sortOrder: 11 },
  { species: Species.GOAT, key: "goat.infectious.johnes", displayName: "Johne's Disease", category: "Infectious", valueType: "ENUM", enumValues: ["Negative", "Suspect", "Positive"], supportsHistory: true, sortOrder: 12 },
  // Reproductive
  { species: Species.GOAT, key: "goat.repro.proven", displayName: "Proven Breeder", category: "Reproductive", valueType: "BOOLEAN", sortOrder: 20 },
  { species: Species.GOAT, key: "goat.repro.semenAnalysis", displayName: "Semen Analysis", category: "Reproductive", valueType: "ENUM", enumValues: ["Normal", "Abnormal", "Low Count", "Poor Motility"], supportsHistory: true, sortOrder: 21 },
  { species: Species.GOAT, key: "goat.repro.breedingSoundness", displayName: "Breeding Soundness Exam", category: "Reproductive", valueType: "ENUM", enumValues: ["Pass", "Conditional", "Fail"], supportsHistory: true, sortOrder: 22 },
  // General
  { species: Species.GOAT, key: "goat.general.famacha", displayName: "FAMACHA Score", category: "General", valueType: "ENUM", enumValues: ["1", "2", "3", "4", "5"], supportsHistory: true, sortOrder: 30 },
  { species: Species.GOAT, key: "goat.general.vaccinationsUpToDate", displayName: "Vaccinations Up To Date", category: "General", valueType: "BOOLEAN", sortOrder: 31 },
];

// ─────────────────────────────────────────────────────────────────────────────
// SHEEP Trait Definitions
// ─────────────────────────────────────────────────────────────────────────────

const SHEEP_TRAITS: TraitDefinitionSeed[] = [
  // Infectious
  { species: Species.SHEEP, key: "sheep.infectious.johnes", displayName: "Johne's Disease", category: "Infectious", valueType: "ENUM", enumValues: ["Negative", "Suspect", "Positive"], supportsHistory: true, sortOrder: 10 },
  { species: Species.SHEEP, key: "sheep.infectious.opp", displayName: "OPP Test", category: "Infectious", valueType: "ENUM", enumValues: ["Negative", "Positive"], supportsHistory: true, sortOrder: 11 },
  // Reproductive
  { species: Species.SHEEP, key: "sheep.repro.proven", displayName: "Proven Breeder", category: "Reproductive", valueType: "BOOLEAN", sortOrder: 20 },
  { species: Species.SHEEP, key: "sheep.repro.semenAnalysis", displayName: "Semen Analysis", category: "Reproductive", valueType: "ENUM", enumValues: ["Normal", "Abnormal", "Low Count", "Poor Motility"], supportsHistory: true, sortOrder: 21 },
  { species: Species.SHEEP, key: "sheep.repro.breedingSoundness", displayName: "Breeding Soundness Exam", category: "Reproductive", valueType: "ENUM", enumValues: ["Pass", "Conditional", "Fail"], supportsHistory: true, sortOrder: 22 },
  // General
  { species: Species.SHEEP, key: "sheep.general.famacha", displayName: "FAMACHA Score", category: "General", valueType: "ENUM", enumValues: ["1", "2", "3", "4", "5"], supportsHistory: true, sortOrder: 30 },
  { species: Species.SHEEP, key: "sheep.general.vaccinationsUpToDate", displayName: "Vaccinations Up To Date", category: "General", valueType: "BOOLEAN", sortOrder: 31 },
];

// ─────────────────────────────────────────────────────────────────────────────
// RABBIT Trait Definitions
// ─────────────────────────────────────────────────────────────────────────────

const RABBIT_TRAITS: TraitDefinitionSeed[] = [
  // Reproductive
  { species: Species.RABBIT, key: "rabbit.repro.proven", displayName: "Proven Breeder", category: "Reproductive", valueType: "BOOLEAN", sortOrder: 10 },
  { species: Species.RABBIT, key: "rabbit.repro.semenAnalysis", displayName: "Semen Analysis", category: "Reproductive", valueType: "ENUM", enumValues: ["Normal", "Abnormal", "Low Count", "Poor Motility"], supportsHistory: true, sortOrder: 11 },
  { species: Species.RABBIT, key: "rabbit.repro.breedingSoundness", displayName: "Breeding Soundness Exam", category: "Reproductive", valueType: "ENUM", enumValues: ["Pass", "Conditional", "Fail"], supportsHistory: true, sortOrder: 12 },
  // General
  { species: Species.RABBIT, key: "rabbit.general.vaccinationsUpToDate", displayName: "Vaccinations Up To Date", category: "General", valueType: "BOOLEAN", sortOrder: 20 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seeding Logic
// ─────────────────────────────────────────────────────────────────────────────

const ALL_TRAITS: TraitDefinitionSeed[] = [
  ...DOG_TRAITS,
  ...CAT_TRAITS,
  ...HORSE_TRAITS,
  ...GOAT_TRAITS,
  ...SHEEP_TRAITS,
  ...RABBIT_TRAITS,
];

async function main() {
  console.log("Seeding trait definitions...\n");

  let created = 0;
  let skipped = 0;

  for (const trait of ALL_TRAITS) {
    const existing = await prisma.traitDefinition.findFirst({
      where: {
        species: trait.species,
        key: trait.key,
        tenantId: null, // Global definitions
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.traitDefinition.create({
      data: {
        tenantId: null, // Global definition
        species: trait.species,
        key: trait.key,
        displayName: trait.displayName,
        category: trait.category,
        valueType: trait.valueType,
        enumValues: trait.enumValues || null,
        requiresDocument: trait.requiresDocument || false,
        marketplaceVisibleDefault: trait.marketplaceVisibleDefault || false,
        supportsHistory: trait.supportsHistory || false,
        sortOrder: trait.sortOrder,
      },
    });
    created++;
    console.log(`  ✓ Created: ${trait.key}`);
  }

  console.log(`\nDone! Created: ${created}, Skipped (already exists): ${skipped}`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
