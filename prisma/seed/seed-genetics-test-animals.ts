// prisma/seed/seed-genetics-test-animals.ts
// Creates test animals with specific genetic markers for validating the Genetics Lab feature.
// These animals have carefully crafted genetics to test various breeding scenarios:
// - Dangerous pairings (Double Merle, Lethal White Overo, Charlie, Polled x Polled)
// - Carrier x Carrier health scenarios
// - Coat color predictions
// - Furnishings/coat type for doodles
// - Multi-species testing
//
// Usage:
//   npm run db:dev:seed:genetics-animals
//
// Or directly:
//   node scripts/run-with-env.js .env.dev.migrate npx tsx prisma/seed/seed-genetics-test-animals.ts

import './seed-env-bootstrap';
import { PrismaClient, Species, Sex, AnimalStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Types for genetic data
interface LocusData {
  locus: string;
  locusName: string;
  allele1?: string;
  allele2?: string;
  genotype: string;
}

interface GeneticsData {
  coatColor?: LocusData[];
  coatType?: LocusData[];
  physicalTraits?: LocusData[];
  eyeColor?: LocusData[];
  health?: LocusData[];
}

interface TestAnimal {
  name: string;
  species: Species;
  sex: Sex;
  breed: string;
  birthDate?: Date;
  notes?: string;
  genetics: GeneticsData;
  testProvider?: string;
}

// Helper to create locus data
function locus(locusCode: string, locusName: string, allele1: string, allele2: string): LocusData {
  return {
    locus: locusCode,
    locusName,
    allele1,
    allele2,
    genotype: `${allele1}/${allele2}`,
  };
}

// Health locus (single genotype field)
function healthLocus(locusCode: string, locusName: string, status: string): LocusData {
  return {
    locus: locusCode,
    locusName,
    genotype: status,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST ANIMALS - Dogs
// ═══════════════════════════════════════════════════════════════════════════════

const DOG_TEST_ANIMALS: TestAnimal[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // MERLE TESTING - Double Merle Warning Scenario
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Luna (Merle Carrier Female)",
    species: "DOG",
    sex: "FEMALE",
    breed: "Australian Shepherd",
    birthDate: new Date("2022-03-15"),
    notes: "Merle carrier female for testing Double Merle warnings. Pair with Maverick to see warning.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),      // Tan points
        locus("B", "Brown", "B", "B"),          // Black pigment
        locus("D", "Dilute", "D", "D"),         // Full color
        locus("E", "Extension", "E", "E"),      // Normal extension
        locus("K", "Black Extension", "ky", "ky"), // Allows agouti pattern
        locus("M", "Merle", "M", "m"),          // MERLE CARRIER
        locus("S", "White Spotting", "S", "sp"), // Solid with some white
      ],
      coatType: [
        locus("L", "Long Hair", "L", "l"),     // Short, carries long
        locus("F", "Furnishings", "f", "f"),   // No furnishings (smooth face)
      ],
      health: [
        healthLocus("MDR1", "MDR1 Drug Sensitivity", "N/m"),  // Carrier
        healthLocus("CEA", "Collie Eye Anomaly", "Clear"),
        healthLocus("HSF4", "Hereditary Cataracts", "Clear"),
        healthLocus("DM", "Degenerative Myelopathy", "Clear"),
      ],
    },
  },
  {
    name: "Maverick (Merle Carrier Male)",
    species: "DOG",
    sex: "MALE",
    breed: "Australian Shepherd",
    birthDate: new Date("2021-08-22"),
    notes: "Merle carrier male for testing Double Merle warnings. Pair with Luna to see warning.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "a"),       // Tan points, carries recessive black
        locus("B", "Brown", "B", "b"),          // Black, carries brown
        locus("D", "Dilute", "D", "d"),         // Full color, carries dilute
        locus("E", "Extension", "E", "e"),      // Normal, carries cream
        locus("K", "Black Extension", "ky", "ky"), // Allows agouti pattern
        locus("M", "Merle", "M", "m"),          // MERLE CARRIER
        locus("S", "White Spotting", "sp", "sp"), // Piebald
      ],
      coatType: [
        locus("L", "Long Hair", "l", "l"),     // Long hair
        locus("F", "Furnishings", "f", "f"),   // No furnishings
      ],
      health: [
        healthLocus("MDR1", "MDR1 Drug Sensitivity", "m/m"),  // Affected
        healthLocus("CEA", "Collie Eye Anomaly", "N/m"),      // Carrier
        healthLocus("HSF4", "Hereditary Cataracts", "Clear"),
        healthLocus("DM", "Degenerative Myelopathy", "N/m"),  // Carrier
      ],
    },
  },
  {
    name: "Shadow (Non-Merle Male)",
    species: "DOG",
    sex: "MALE",
    breed: "Australian Shepherd",
    birthDate: new Date("2022-01-10"),
    notes: "Non-merle male. Safe to pair with any merle female.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("E", "Extension", "E", "E"),
        locus("K", "Black Extension", "ky", "ky"),
        locus("M", "Merle", "m", "m"),          // NON-MERLE - safe
        locus("S", "White Spotting", "S", "S"),
      ],
      health: [
        healthLocus("MDR1", "MDR1 Drug Sensitivity", "Clear"),
        healthLocus("CEA", "Collie Eye Anomaly", "Clear"),
        healthLocus("DM", "Degenerative Myelopathy", "Clear"),
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // DOODLE TESTING - Furnishings & Coat Type
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Bella (Furnished Goldendoodle Dam)",
    species: "DOG",
    sex: "FEMALE",
    breed: "Goldendoodle",
    birthDate: new Date("2021-05-20"),
    notes: "Furnished female with curly coat. Ideal doodle breeding stock.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "Ay"),       // Sable/Fawn
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("E", "Extension", "E", "e"),      // Normal, carries cream
        locus("K", "Black Extension", "ky", "ky"),
      ],
      coatType: [
        locus("F", "Furnishings", "F", "F"),    // FURNISHED (teddy bear face)
        locus("Cu", "Curly", "Cu", "Cu"),       // Curly coat
        locus("L", "Long Hair", "l", "l"),      // Long coat
        locus("Sd", "Shedding", "Sd", "Sd"),    // Low shedding
        locus("IC", "Improper Coat", "N", "N"), // Proper coat
      ],
      health: [
        healthLocus("GR_PRA1", "Golden Retriever PRA 1", "Clear"),
        healthLocus("GR_PRA2", "Golden Retriever PRA 2", "Clear"),
        healthLocus("ICT_A", "Ichthyosis Type A", "Clear"),
        healthLocus("DM", "Degenerative Myelopathy", "Clear"),
        healthLocus("vWD", "Von Willebrand Disease", "Clear"),
      ],
    },
  },
  {
    name: "Cooper (Furnished Carrier Poodle)",
    species: "DOG",
    sex: "MALE",
    breed: "Standard Poodle",
    birthDate: new Date("2020-11-08"),
    notes: "Furnished carrier male. Some offspring may be unfurnished if paired with carrier.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "a", "a"),         // Recessive black/solid
        locus("B", "Brown", "b", "b"),          // Brown/chocolate
        locus("D", "Dilute", "D", "D"),
        locus("E", "Extension", "E", "E"),
        locus("K", "Black Extension", "KB", "ky"), // Dominant black, carries pattern
      ],
      coatType: [
        locus("F", "Furnishings", "F", "f"),    // FURNISHED CARRIER
        locus("Cu", "Curly", "Cu", "Cu"),       // Curly
        locus("L", "Long Hair", "l", "l"),      // Long
        locus("Sd", "Shedding", "Sd", "sd"),    // Low shed carrier
      ],
      health: [
        healthLocus("PRA", "Progressive Retinal Atrophy", "Clear"),
        healthLocus("vWD", "Von Willebrand Disease", "Clear"),
        healthLocus("DM", "Degenerative Myelopathy", "N/m"), // Carrier
      ],
    },
  },
  {
    name: "Daisy (Unfurnished Carrier Golden)",
    species: "DOG",
    sex: "FEMALE",
    breed: "Golden Retriever",
    birthDate: new Date("2022-02-14"),
    notes: "Unfurnished carrier. May produce unfurnished puppies if paired with another carrier.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "Ay"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("E", "Extension", "e", "e"),      // Cream/red (golden color)
        locus("K", "Black Extension", "ky", "ky"),
      ],
      coatType: [
        locus("F", "Furnishings", "f", "f"),    // UNFURNISHED (smooth face)
        locus("Cu", "Curly", "+", "+"),         // Straight coat
        locus("L", "Long Hair", "l", "l"),      // Long
      ],
      health: [
        healthLocus("GR_PRA1", "Golden Retriever PRA 1", "N/m"), // CARRIER
        healthLocus("GR_PRA2", "Golden Retriever PRA 2", "Clear"),
        healthLocus("ICT_A", "Ichthyosis Type A", "N/m"),        // CARRIER
        healthLocus("DM", "Degenerative Myelopathy", "Clear"),
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LABRADOR TESTING - Health Carrier Scenarios
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Max (EIC Carrier Lab)",
    species: "DOG",
    sex: "MALE",
    breed: "Labrador Retriever",
    birthDate: new Date("2021-09-05"),
    notes: "EIC carrier male. Pair with Sadie to test carrier x carrier scenario.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "Ay"),
        locus("B", "Brown", "B", "B"),          // Black
        locus("D", "Dilute", "D", "D"),
        locus("E", "Extension", "E", "E"),
        locus("K", "Black Extension", "KB", "KB"), // Dominant black
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/m"),  // CARRIER
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "Clear"),
        healthLocus("CNM", "Centronuclear Myopathy", "Clear"),
        healthLocus("DM", "Degenerative Myelopathy", "Clear"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "Clear"),
      ],
    },
  },
  {
    name: "Sadie (EIC Carrier Lab Female)",
    species: "DOG",
    sex: "FEMALE",
    breed: "Labrador Retriever",
    birthDate: new Date("2022-04-18"),
    notes: "EIC carrier female. Pair with Max to test carrier x carrier - 25% affected risk.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "Ay"),
        locus("B", "Brown", "b", "b"),          // Chocolate
        locus("D", "Dilute", "D", "D"),
        locus("E", "Extension", "E", "E"),
        locus("K", "Black Extension", "KB", "KB"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "N/m"),  // CARRIER
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "N/m"), // CARRIER
        healthLocus("CNM", "Centronuclear Myopathy", "Clear"),
        healthLocus("DM", "Degenerative Myelopathy", "N/m"),     // CARRIER
        healthLocus("PRA", "Progressive Retinal Atrophy", "Clear"),
      ],
    },
  },
  {
    name: "Duke (Clear Lab Male)",
    species: "DOG",
    sex: "MALE",
    breed: "Labrador Retriever",
    birthDate: new Date("2020-07-12"),
    notes: "All clear male. Safe to breed with any female - no carrier concerns.",
    testProvider: "Wisdom Panel",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "Ay"),
        locus("B", "Brown", "B", "b"),          // Black, carries chocolate
        locus("D", "Dilute", "d", "d"),         // DILUTE - Silver/Charcoal
        locus("E", "Extension", "E", "e"),      // Carries yellow
        locus("K", "Black Extension", "KB", "ky"),
      ],
      health: [
        healthLocus("EIC", "Exercise-Induced Collapse", "Clear"),
        healthLocus("HNPK", "Hereditary Nasal Parakeratosis", "Clear"),
        healthLocus("CNM", "Centronuclear Myopathy", "Clear"),
        healthLocus("DM", "Degenerative Myelopathy", "Clear"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "Clear"),
        healthLocus("SD2", "Skeletal Dysplasia 2", "Clear"),
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // FRENCH BULLDOG TESTING - Fluffy Gene & Health
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Pierre (Fluffy Carrier Frenchie)",
    species: "DOG",
    sex: "MALE",
    breed: "French Bulldog",
    birthDate: new Date("2022-06-30"),
    notes: "Fluffy (L4) carrier. Pair with Fifi to see fluffy offspring predictions.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "at"),       // Fawn, carries tan points
        locus("B", "Brown", "B", "b"),          // Black, carries chocolate
        locus("D", "Dilute", "D", "d"),         // Full color, carries blue
        locus("E", "Extension", "Em", "E"),     // Melanistic mask
        locus("K", "Black Extension", "ky", "ky"),
      ],
      coatType: [
        locus("L", "Long Hair", "L", "L"),      // Short
        locus("L4", "Fluffy Gene", "L4", "N"),  // FLUFFY CARRIER
      ],
      health: [
        healthLocus("JHC", "Juvenile Hereditary Cataracts", "Clear"),
        healthLocus("CMR1", "Canine Multifocal Retinopathy 1", "N/m"), // Carrier
        healthLocus("Cystinuria", "Cystinuria", "Clear"),
        healthLocus("DM", "Degenerative Myelopathy", "Clear"),
      ],
    },
  },
  {
    name: "Fifi (Fluffy Carrier Frenchie Female)",
    species: "DOG",
    sex: "FEMALE",
    breed: "French Bulldog",
    birthDate: new Date("2023-01-15"),
    notes: "Fluffy (L4) carrier. 25% fluffy offspring when bred to Pierre.",
    testProvider: "Embark",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),       // Tan points (brindle base)
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "d", "d"),         // BLUE/LILAC
        locus("E", "Extension", "E", "e"),      // Carries cream
        locus("K", "Black Extension", "kbr", "ky"), // Brindle
      ],
      coatType: [
        locus("L", "Long Hair", "L", "L"),
        locus("L4", "Fluffy Gene", "L4", "N"),  // FLUFFY CARRIER
      ],
      health: [
        healthLocus("JHC", "Juvenile Hereditary Cataracts", "Clear"),
        healthLocus("CMR1", "Canine Multifocal Retinopathy 1", "Clear"),
        healthLocus("Cystinuria", "Cystinuria", "N/m"),  // Carrier
        healthLocus("DM", "Degenerative Myelopathy", "N/m"), // Carrier
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST ANIMALS - Horses
// ═══════════════════════════════════════════════════════════════════════════════

const HORSE_TEST_ANIMALS: TestAnimal[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // LETHAL WHITE OVERO TESTING
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Painted Lady (Frame Overo Mare)",
    species: "HORSE",
    sex: "FEMALE",
    breed: "Paint Horse",
    birthDate: new Date("2019-04-10"),
    notes: "Frame Overo carrier (O/n). DANGER: Breeding to another O/n = 25% lethal white foals.",
    testProvider: "UC Davis VGL",
    genetics: {
      coatColor: [
        locus("E", "Extension", "E", "e"),      // Black-based, carries red
        locus("A", "Agouti", "A", "a"),         // Bay
        locus("O", "Overo (OLWS)", "O", "n"),   // FRAME OVERO - LETHAL WHITE RISK
        locus("TO", "Tobiano", "to", "to"),     // Non-tobiano
        locus("Cr", "Cream", "n", "n"),         // No cream
        locus("Rn", "Roan", "n", "n"),
      ],
      health: [
        healthLocus("OLWS", "Overo Lethal White Syndrome", "O/n"),  // CARRIER
        healthLocus("HYPP", "Hyperkalemic Periodic Paralysis", "N/N"),
        healthLocus("GBED", "Glycogen Branching Enzyme Deficiency", "N/N"),
        healthLocus("HERDA", "Hereditary Equine Regional Dermal Asthenia", "N/N"),
      ],
    },
  },
  {
    name: "Storm Chaser (Frame Overo Stallion)",
    species: "HORSE",
    sex: "MALE",
    breed: "Paint Horse",
    birthDate: new Date("2018-05-22"),
    notes: "Frame Overo carrier. DO NOT breed to Painted Lady - lethal white risk!",
    testProvider: "UC Davis VGL",
    genetics: {
      coatColor: [
        locus("E", "Extension", "E", "E"),
        locus("A", "Agouti", "A", "A"),         // Bay
        locus("O", "Overo (OLWS)", "O", "n"),   // FRAME OVERO - LETHAL WHITE RISK
        locus("TO", "Tobiano", "to", "to"),
        locus("SB", "Sabino", "SB", "n"),       // Some sabino
        locus("Cr", "Cream", "Cr", "n"),        // Single cream = buckskin
      ],
      health: [
        healthLocus("OLWS", "Overo Lethal White Syndrome", "O/n"),  // CARRIER
        healthLocus("HYPP", "Hyperkalemic Periodic Paralysis", "N/N"),
        healthLocus("PSSM", "Polysaccharide Storage Myopathy", "N/N"),
      ],
    },
  },
  {
    name: "Midnight Run (Safe Tobiano Stallion)",
    species: "HORSE",
    sex: "MALE",
    breed: "Paint Horse",
    birthDate: new Date("2020-03-15"),
    notes: "Tobiano only, no frame overo. Safe to breed with any mare.",
    testProvider: "UC Davis VGL",
    genetics: {
      coatColor: [
        locus("E", "Extension", "E", "e"),
        locus("A", "Agouti", "a", "a"),         // Black
        locus("O", "Overo (OLWS)", "n", "n"),   // NO OVERO - SAFE
        locus("TO", "Tobiano", "TO", "to"),     // Tobiano pattern
        locus("Cr", "Cream", "n", "n"),
        locus("G", "Gray", "n", "n"),
      ],
      health: [
        healthLocus("OLWS", "Overo Lethal White Syndrome", "N/N"),  // CLEAR
        healthLocus("HYPP", "Hyperkalemic Periodic Paralysis", "N/N"),
        healthLocus("GBED", "Glycogen Branching Enzyme Deficiency", "N/N"),
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // QUARTER HORSE TESTING - HYPP
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Impressive Legacy (HYPP Carrier QH)",
    species: "HORSE",
    sex: "MALE",
    breed: "Quarter Horse",
    birthDate: new Date("2017-06-08"),
    notes: "HYPP carrier (N/H). Offspring have 50% chance of being carriers.",
    testProvider: "UC Davis VGL",
    genetics: {
      coatColor: [
        locus("E", "Extension", "e", "e"),      // Chestnut/Sorrel
        locus("A", "Agouti", "A", "a"),
        locus("Cr", "Cream", "n", "n"),
      ],
      health: [
        healthLocus("HYPP", "Hyperkalemic Periodic Paralysis", "N/H"),  // CARRIER
        healthLocus("GBED", "Glycogen Branching Enzyme Deficiency", "N/N"),
        healthLocus("HERDA", "Hereditary Equine Regional Dermal Asthenia", "N/N"),
        healthLocus("PSSM", "Polysaccharide Storage Myopathy", "N/N"),
        healthLocus("MH", "Malignant Hyperthermia", "N/N"),
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST ANIMALS - Cats
// ═══════════════════════════════════════════════════════════════════════════════

const CAT_TEST_ANIMALS: TestAnimal[] = [
  {
    name: "Whiskers (Pointed Carrier)",
    species: "CAT",
    sex: "FEMALE",
    breed: "Ragdoll",
    birthDate: new Date("2022-08-12"),
    notes: "Colorpoint carrier. Can produce pointed kittens if bred to another carrier.",
    testProvider: "UC Davis VGL",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "a", "a"),         // Solid (non-tabby)
        locus("B", "Brown", "B", "B"),          // Black
        locus("C", "Colorpoint", "C", "cs"),    // Full color, carries pointed
        locus("D", "Dilute", "D", "d"),         // Full color, carries blue
        locus("O", "Orange", "o", "o"),         // Non-orange (black-based)
        locus("S", "White Spotting", "S", "s"), // Some white
      ],
      coatType: [
        locus("L", "Long Hair", "l", "l"),      // Longhair
      ],
      health: [
        healthLocus("HCM_RD", "HCM (Ragdoll MYBPC3)", "N/m"),  // CARRIER
        healthLocus("PKD", "Polycystic Kidney Disease", "N/N"),
        healthLocus("PK_Def", "Pyruvate Kinase Deficiency", "N/N"),
      ],
    },
  },
  {
    name: "Shadow (Seal Point Male)",
    species: "CAT",
    sex: "MALE",
    breed: "Siamese",
    birthDate: new Date("2021-11-25"),
    notes: "Seal point male. All offspring will carry pointed gene.",
    testProvider: "UC Davis VGL",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "a", "a"),
        locus("B", "Brown", "B", "B"),
        locus("C", "Colorpoint", "cs", "cs"),   // POINTED
        locus("D", "Dilute", "D", "D"),
        locus("O", "Orange", "o", "Y"),         // Non-orange male
        locus("S", "White Spotting", "s", "s"), // No white
      ],
      coatType: [
        locus("L", "Long Hair", "L", "L"),      // Shorthair
      ],
      health: [
        healthLocus("GM1", "Gangliosidosis Type 1", "N/N"),
        healthLocus("PRA", "Progressive Retinal Atrophy", "N/N"),
        healthLocus("Amyloidosis", "Renal Amyloidosis", "At Risk"), // Siamese predisposition
      ],
    },
  },
  {
    name: "Luna (Tortie Female)",
    species: "CAT",
    sex: "FEMALE",
    breed: "Domestic Shorthair",
    birthDate: new Date("2023-02-14"),
    notes: "Tortoiseshell female (O/o). Can produce orange males and tortie females.",
    testProvider: "Wisdom Panel",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "A", "a"),         // Tabby, carries solid
        locus("B", "Brown", "B", "b"),          // Black, carries chocolate
        locus("C", "Colorpoint", "C", "C"),     // Full color
        locus("D", "Dilute", "D", "D"),
        locus("O", "Orange", "O", "o"),         // TORTOISESHELL
        locus("S", "White Spotting", "s", "s"),
        locus("W", "Dominant White", "w", "w"), // Normal color
      ],
      coatType: [
        locus("L", "Long Hair", "L", "l"),      // Short, carries long
        locus("Mc", "Tabby Pattern", "Mc", "mc"), // Mackerel, carries classic
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST ANIMALS - Rabbits
// ═══════════════════════════════════════════════════════════════════════════════

const RABBIT_TEST_ANIMALS: TestAnimal[] = [
  {
    name: "Patches (Broken Pattern Carrier)",
    species: "RABBIT",
    sex: "FEMALE",
    breed: "Holland Lop",
    birthDate: new Date("2023-03-20"),
    notes: "Broken pattern (En/en). Breeding to another En/en = 25% Charlie (health issues).",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "A", "a"),         // Agouti, carries self
        locus("B", "Brown", "B", "B"),          // Black
        locus("C", "Color Series", "C", "cchd"),// Full color, carries chinchilla
        locus("D", "Dilute", "D", "d"),         // Full color, carries blue
        locus("E", "Extension", "E", "e"),      // Normal, carries tort
        locus("En", "English Spotting", "En", "en"), // BROKEN PATTERN
        locus("V", "Vienna", "V", "V"),         // Normal eyes
      ],
      health: [
        healthLocus("Dw", "Dwarf Gene", "Dw", "dw"),  // Dwarf
      ],
    },
  },
  {
    name: "Oreo (Broken Pattern Male)",
    species: "RABBIT",
    sex: "MALE",
    breed: "Holland Lop",
    birthDate: new Date("2023-01-08"),
    notes: "Broken pattern male. Pair with Patches for 25% Charlie warning.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "a", "a"),         // Self/solid
        locus("B", "Brown", "B", "b"),          // Black, carries chocolate
        locus("C", "Color Series", "C", "ch"),  // Full color, carries himalayan
        locus("D", "Dilute", "D", "D"),
        locus("E", "Extension", "E", "E"),
        locus("En", "English Spotting", "En", "en"), // BROKEN PATTERN
        locus("V", "Vienna", "V", "v"),         // Vienna carrier (may show blue eye)
      ],
      health: [
        healthLocus("Dw", "Dwarf Gene", "Dw", "dw"),  // Dwarf
      ],
    },
  },
  {
    name: "Snowball (BEW)",
    species: "RABBIT",
    sex: "FEMALE",
    breed: "Netherland Dwarf",
    birthDate: new Date("2022-09-15"),
    notes: "Blue-Eyed White (v/v Vienna). All offspring will be Vienna carriers minimum.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "A", "A"),
        locus("B", "Brown", "B", "B"),
        locus("C", "Color Series", "C", "C"),
        locus("D", "Dilute", "D", "D"),
        locus("E", "Extension", "E", "E"),
        locus("En", "English Spotting", "en", "en"), // Solid
        locus("V", "Vienna", "v", "v"),         // BEW
      ],
      health: [
        healthLocus("Dw", "Dwarf Gene", "Dw", "dw"),
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST ANIMALS - Goats
// ═══════════════════════════════════════════════════════════════════════════════

const GOAT_TEST_ANIMALS: TestAnimal[] = [
  {
    name: "Buttercup (Polled Doe)",
    species: "GOAT",
    sex: "FEMALE",
    breed: "Nigerian Dwarf",
    birthDate: new Date("2022-04-12"),
    notes: "Polled female (P/p). WARNING: Breeding to polled buck = intersex risk.",
    genetics: {
      coatColor: [
        locus("A", "Agouti Pattern", "Awt", "Ag"), // White/tan, carries grey
        locus("B", "Brown", "B", "b"),          // Black, carries brown
        locus("E", "Extension", "E", "e"),      // Normal, carries red
        locus("S", "Spotting", "S", "s"),       // Some spots
      ],
      physicalTraits: [
        locus("P", "Polled", "P", "p"),         // POLLED
      ],
      health: [
        healthLocus("G6S", "G6S (Beta-Mannosidosis)", "N/N"),
        healthLocus("Scrapie", "Scrapie Susceptibility", "QR"), // Partially resistant
      ],
    },
  },
  {
    name: "Thunder (Polled Buck)",
    species: "GOAT",
    sex: "MALE",
    breed: "Nigerian Dwarf",
    birthDate: new Date("2021-07-18"),
    notes: "Polled buck (P/p). DO NOT breed to polled does - intersex risk!",
    genetics: {
      coatColor: [
        locus("A", "Agouti Pattern", "Ab", "Ab"), // Badgerface
        locus("B", "Brown", "B", "B"),
        locus("E", "Extension", "Ed", "E"),     // Dominant black, carries normal
        locus("S", "Spotting", "s", "s"),       // No random spots
        locus("Rn", "Roan", "Rn", "rn"),        // Roan
      ],
      physicalTraits: [
        locus("P", "Polled", "P", "p"),         // POLLED
        locus("Wd", "Wattles", "Wd", "wd"),     // Has wattles
      ],
      health: [
        healthLocus("G6S", "G6S (Beta-Mannosidosis)", "N/N"),
        healthLocus("Scrapie", "Scrapie Susceptibility", "RR"), // Resistant
        healthLocus("CAE", "CAE", "Negative"),
        healthLocus("CL", "CL (Caseous Lymphadenitis)", "Negative"),
      ],
    },
  },
  {
    name: "Clover (Horned Doe)",
    species: "GOAT",
    sex: "FEMALE",
    breed: "Nigerian Dwarf",
    birthDate: new Date("2022-11-05"),
    notes: "Horned female (p/p). Safe to breed with any buck.",
    genetics: {
      coatColor: [
        locus("A", "Agouti Pattern", "As", "a"), // Swiss marked, carries solid
        locus("B", "Brown", "b", "b"),          // Brown/chocolate
        locus("E", "Extension", "E", "E"),
        locus("S", "Spotting", "S", "S"),       // Spotted
      ],
      physicalTraits: [
        locus("P", "Polled", "p", "p"),         // HORNED - safe
      ],
      health: [
        healthLocus("G6S", "G6S (Beta-Mannosidosis)", "N/m"),  // Carrier
        healthLocus("Scrapie", "Scrapie Susceptibility", "QQ"), // Susceptible
        healthLocus("CAE", "CAE", "Negative"),
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST ANIMALS - COI Testing (with Lineage)
// These animals form a family tree to test Coefficient of Inbreeding calculations
// ═══════════════════════════════════════════════════════════════════════════════

// We'll create these programmatically with relationships in the main function
// Family tree structure:
//
// Generation 0 (Great-grandparents):
//   Anakin Skybarker (M) ─┬─ Shmi Skybarker (F)
//                         │
// Generation 1 (Grandparents):
//   King Veruna Naberrie (M) ─┬─ Queen Amidala Pawdmé (F)     Jaina Solo Dam (F) ─┬─ Corell Solo (M)
//                              │                                                    │
// Generation 2 (Parents):      │                                                    │
//   Elder Skybarker Sire (M) ──┼── Elder Skybarker Dam (F)   Royal Naberrie Sire ──┼── Royal Naberrie Dam (F)
//          │                   │         │                           │              │
// Gen 3:   └───────────────────┴─────────┴───────────────────────────┴──────────────┘
//                              │                                     │
//              Omega (F) ──────┴───── Echo (M) ─────────────┬────────┘
//                                                           │
// Generation 4:                                     Fives (M), Captain Rex (M), Commander Cody (M)
//
// COI Test Cases:
// - Omega × Echo = Moderate COI (half-siblings share grandparents)
// - Omega × Fives = High COI (aunt-nephew)
// - Captain Rex × Commander Cody = Same generation, high COI

const COI_FAMILY_TREE_DOGS: Array<{
  name: string;
  sex: Sex;
  breed: string;
  generation: number;
  sireRef?: string;  // Reference by name
  damRef?: string;   // Reference by name
  notes: string;
  genetics: GeneticsData;
}> = [
  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATION 0 - Great-grandparents (founders, no inbreeding)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Anakin Skybarker",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 0,
    notes: "Founder sire. No known ancestry.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "Shmi Skybarker",
    sex: "FEMALE",
    breed: "German Shepherd",
    generation: 0,
    notes: "Founder dam. No known ancestry.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "King Veruna Naberrie",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 0,
    notes: "Founder sire (Naberrie line). No known ancestry.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "at"),
        locus("B", "Brown", "B", "b"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "Queen Amidala Pawdmé",
    sex: "FEMALE",
    breed: "German Shepherd",
    generation: 0,
    notes: "Founder dam (Naberrie line). No known ancestry.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "Ay"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "d"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "Corell Solo",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 0,
    notes: "Founder sire (Solo line). Unrelated to Skybarker/Naberrie lines.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "a"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "Mallatobuck",
    sex: "FEMALE",
    breed: "German Shepherd",
    generation: 0,
    notes: "Founder dam (Solo line). Unrelated to Skybarker/Naberrie lines.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "Attichitcuk",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 0,
    notes: "Founder sire (Wookie line). Completely unrelated.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "Ay"),
        locus("B", "Brown", "b", "b"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATION 1 - Grandparents
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Elder Skybarker Sire",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 1,
    sireRef: "Anakin Skybarker",
    damRef: "Shmi Skybarker",
    notes: "Son of Anakin and Shmi. Grandfather in linebreeding.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "Elder Skybarker Dam",
    sex: "FEMALE",
    breed: "German Shepherd",
    generation: 1,
    sireRef: "Anakin Skybarker",
    damRef: "Shmi Skybarker",
    notes: "Daughter of Anakin and Shmi. Full sibling to Elder Skybarker Sire.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "Royal Naberrie Sire",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 1,
    sireRef: "King Veruna Naberrie",
    damRef: "Queen Amidala Pawdmé",
    notes: "Son of King Veruna and Queen Amidala.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "d"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "Royal Naberrie Dam",
    sex: "FEMALE",
    breed: "German Shepherd",
    generation: 1,
    sireRef: "King Veruna Naberrie",
    damRef: "Queen Amidala Pawdmé",
    notes: "Daughter of King Veruna and Queen Amidala. Full sibling to Royal Naberrie Sire.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "at"),
        locus("B", "Brown", "B", "b"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "Jaina Solo Dam",
    sex: "FEMALE",
    breed: "German Shepherd",
    generation: 1,
    sireRef: "Corell Solo",
    damRef: "Mallatobuck",
    notes: "Daughter of Corell and Mallatobuck. Solo line.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATION 2 - Parents (some inbreeding starts here)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Omega",
    sex: "FEMALE",
    breed: "German Shepherd",
    generation: 2,
    sireRef: "Elder Skybarker Sire",
    damRef: "Elder Skybarker Dam",
    notes: "Daughter of FULL SIBLINGS. High COI from sibling mating. Use for COI testing.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
      health: [
        healthLocus("DM", "Degenerative Myelopathy", "Clear"),
      ],
    },
  },
  {
    name: "Echo",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 2,
    sireRef: "Royal Naberrie Sire",
    damRef: "Royal Naberrie Dam",
    notes: "Son of FULL SIBLINGS (Naberrie line). High COI. Pair with Omega for moderate COI offspring.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "d"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
      health: [
        healthLocus("DM", "Degenerative Myelopathy", "N/m"),
      ],
    },
  },
  {
    name: "Concord Dawn Dam",
    sex: "FEMALE",
    breed: "German Shepherd",
    generation: 2,
    sireRef: "Royal Naberrie Sire",
    damRef: "Jaina Solo Dam",
    notes: "Daughter of Royal Naberrie Sire and Jaina Solo. Mixed lines.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATION 3 - Current breeding stock
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Fives",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 3,
    sireRef: "Echo",
    damRef: "Omega",
    notes: "Son of Omega and Echo. VERY HIGH COI (both parents from sibling matings). Testing extreme inbreeding.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
      health: [
        healthLocus("DM", "Degenerative Myelopathy", "N/m"),
      ],
    },
  },
  {
    name: "Captain Rex",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 3,
    sireRef: "Echo",
    damRef: "Omega",
    notes: "Full brother to Fives. Use to test sibling pairing warnings.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "d"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
      health: [
        healthLocus("DM", "Degenerative Myelopathy", "Clear"),
      ],
    },
  },
  {
    name: "Commander Cody",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 3,
    sireRef: "Echo",
    damRef: "Concord Dawn Dam",
    notes: "Half-brother to Fives and Rex (same sire, different dam). Lower COI.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "Ay", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
      health: [
        healthLocus("DM", "Degenerative Myelopathy", "N/m"),
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // ADDITIONAL - Clone program with known lineage for testing
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: "Jango Fett (Template)",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 0,
    notes: "Clone template sire. Founder with no known ancestry.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
        locus("M", "Merle", "m", "m"),
      ],
      health: [
        healthLocus("DM", "Degenerative Myelopathy", "Clear"),
        healthLocus("MDR1", "MDR1 Drug Sensitivity", "Clear"),
      ],
    },
  },
  {
    name: "Nala Se's Project Dam",
    sex: "FEMALE",
    breed: "German Shepherd",
    generation: 0,
    notes: "Clone project dam. Founder with no known ancestry.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
        locus("M", "Merle", "m", "m"),
      ],
    },
  },
  {
    name: "Kamino Clone Dam Alpha",
    sex: "FEMALE",
    breed: "German Shepherd",
    generation: 1,
    sireRef: "Jango Fett (Template)",
    damRef: "Nala Se's Project Dam",
    notes: "First generation clone dam.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "Kamino Clone Dam Beta",
    sex: "FEMALE",
    breed: "German Shepherd",
    generation: 1,
    sireRef: "Jango Fett (Template)",
    damRef: "Nala Se's Project Dam",
    notes: "Full sister to Alpha. Second generation clone dam.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "Kamino Clone Dam Gamma",
    sex: "FEMALE",
    breed: "German Shepherd",
    generation: 1,
    sireRef: "Jango Fett (Template)",
    damRef: "Nala Se's Project Dam",
    notes: "Full sister to Alpha and Beta. Third clone dam.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
  {
    name: "Enhanced Clone Sire",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 2,
    sireRef: "Jango Fett (Template)",
    damRef: "Kamino Clone Dam Alpha",
    notes: "Father-daughter breeding. VERY HIGH COI. Use for extreme COI testing.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
      health: [
        healthLocus("DM", "Degenerative Myelopathy", "Clear"),
      ],
    },
  },
  {
    name: "Mandalorian Bounty Sire",
    sex: "MALE",
    breed: "German Shepherd",
    generation: 2,
    sireRef: "Jango Fett (Template)",
    damRef: "Kamino Clone Dam Beta",
    notes: "Father-daughter from different dam. High COI but slightly different line.",
    genetics: {
      coatColor: [
        locus("A", "Agouti", "at", "at"),
        locus("B", "Brown", "B", "B"),
        locus("D", "Dilute", "D", "D"),
        locus("K", "Black Extension", "ky", "ky"),
      ],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('🧬 Starting Genetics Test Animals seed...\n');

  // Find Luke Skywalker's tenant
  const lukeUser = await prisma.user.findFirst({
    where: { email: 'luke.skywalker@tester.local' }
  });

  if (!lukeUser) {
    console.log('❌ luke.skywalker@tester.local user not found!');
    console.log('Please create the Luke Skywalker user and tenant first.');
    process.exit(1);
  }

  const lukeMembership = await prisma.tenantMembership.findFirst({
    where: { userId: lukeUser.id },
    include: { tenant: true }
  });

  if (!lukeMembership) {
    console.log('❌ Luke Skywalker has no tenant membership!');
    process.exit(1);
  }

  const tenantId = lukeMembership.tenant.id;
  console.log(`✓ Found Luke's tenant: ${lukeMembership.tenant.name} (ID: ${tenantId})\n`);

  // Combine all test animals
  const allTestAnimals: TestAnimal[] = [
    ...DOG_TEST_ANIMALS,
    ...HORSE_TEST_ANIMALS,
    ...CAT_TEST_ANIMALS,
    ...RABBIT_TEST_ANIMALS,
    ...GOAT_TEST_ANIMALS,
  ];

  console.log(`📦 Creating ${allTestAnimals.length} basic test animals with genetics...\n`);

  let created = 0;
  let skipped = 0;

  for (const animal of allTestAnimals) {
    // Check if animal already exists
    const existing = await prisma.animal.findFirst({
      where: {
        tenantId,
        name: animal.name,
        species: animal.species,
      }
    });

    if (existing) {
      console.log(`⏭️  Skipped (exists): ${animal.name} (${animal.species})`);
      skipped++;
      continue;
    }

    // Create animal with genetics in transaction
    await prisma.$transaction(async (tx) => {
      // Create the animal
      const newAnimal = await tx.animal.create({
        data: {
          tenantId,
          name: animal.name,
          species: animal.species,
          sex: animal.sex,
          breed: animal.breed,
          birthDate: animal.birthDate,
          notes: animal.notes,
          status: AnimalStatus.ACTIVE,
        }
      });

      // Create genetics record
      await tx.animalGenetics.create({
        data: {
          animalId: newAnimal.id,
          testProvider: animal.testProvider || null,
          testDate: animal.birthDate ? new Date(animal.birthDate.getTime() + 180 * 24 * 60 * 60 * 1000) : null, // 6 months after birth
          coatColorData: animal.genetics.coatColor || [],
          coatTypeData: animal.genetics.coatType || [],
          physicalTraitsData: animal.genetics.physicalTraits || [],
          eyeColorData: animal.genetics.eyeColor || [],
          healthGeneticsData: animal.genetics.health || [],
        }
      });

      console.log(`✅ Created: ${animal.name} (${animal.species} - ${animal.breed})`);
    });

    created++;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CREATE COI FAMILY TREE ANIMALS (with lineage relationships)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('\n📦 Creating COI family tree animals with lineage...\n');

  // Map to store created animal IDs by name for relationship linking
  const animalIdMap = new Map<string, number>();

  // Sort by generation to ensure parents exist before children
  const sortedCoiAnimals = [...COI_FAMILY_TREE_DOGS].sort((a, b) => a.generation - b.generation);

  let coiCreated = 0;
  let coiSkipped = 0;

  for (const animal of sortedCoiAnimals) {
    // Check if animal already exists
    const existing = await prisma.animal.findFirst({
      where: {
        tenantId,
        name: animal.name,
        species: 'DOG',
      }
    });

    if (existing) {
      console.log(`⏭️  Skipped (exists): ${animal.name}`);
      animalIdMap.set(animal.name, existing.id);
      coiSkipped++;
      continue;
    }

    // Look up parent IDs if specified
    let sireId: number | null = null;
    let damId: number | null = null;

    if (animal.sireRef) {
      sireId = animalIdMap.get(animal.sireRef) || null;
      if (!sireId) {
        // Try to find existing animal
        const sire = await prisma.animal.findFirst({
          where: { tenantId, name: animal.sireRef, species: 'DOG' }
        });
        sireId = sire?.id || null;
      }
    }

    if (animal.damRef) {
      damId = animalIdMap.get(animal.damRef) || null;
      if (!damId) {
        // Try to find existing animal
        const dam = await prisma.animal.findFirst({
          where: { tenantId, name: animal.damRef, species: 'DOG' }
        });
        damId = dam?.id || null;
      }
    }

    // Calculate birthDate based on generation (roughly 2 years per generation, starting from 2015)
    const baseBirthYear = 2015;
    const birthYear = baseBirthYear + (animal.generation * 2);
    const birthDate = new Date(`${birthYear}-06-15`);

    // Create the animal with lineage
    const newAnimal = await prisma.animal.create({
      data: {
        tenantId,
        name: animal.name,
        species: 'DOG',
        sex: animal.sex,
        breed: animal.breed,
        birthDate,
        notes: animal.notes,
        status: AnimalStatus.ACTIVE,
        sireId,
        damId,
      }
    });

    // Create genetics record
    await prisma.animalGenetics.create({
      data: {
        animalId: newAnimal.id,
        testProvider: 'Embark',
        testDate: new Date(birthDate.getTime() + 180 * 24 * 60 * 60 * 1000),
        coatColorData: animal.genetics.coatColor || [],
        coatTypeData: animal.genetics.coatType || [],
        physicalTraitsData: animal.genetics.physicalTraits || [],
        eyeColorData: animal.genetics.eyeColor || [],
        healthGeneticsData: animal.genetics.health || [],
      }
    });

    // Store in map for children
    animalIdMap.set(animal.name, newAnimal.id);

    const parentInfo = [];
    if (animal.sireRef) parentInfo.push(`Sire: ${animal.sireRef}`);
    if (animal.damRef) parentInfo.push(`Dam: ${animal.damRef}`);
    const parentStr = parentInfo.length > 0 ? ` [${parentInfo.join(', ')}]` : ' [Founder]';

    console.log(`✅ Created: ${animal.name} (Gen ${animal.generation})${parentStr}`);
    coiCreated++;
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🎉 Genetics Test Animals seed completed!');
  console.log('═'.repeat(70));
  console.log(`   Basic animals created: ${created}`);
  console.log(`   Basic animals skipped: ${skipped} (already existed)`);
  console.log(`   COI family created:    ${coiCreated}`);
  console.log(`   COI family skipped:    ${coiSkipped} (already existed)`);
  console.log(`   Total animals:         ${allTestAnimals.length + COI_FAMILY_TREE_DOGS.length}\n`);

  console.log('📋 TEST SCENARIOS:');
  console.log('─'.repeat(70));
  console.log('🐕 DOGS - Genetics:');
  console.log('   • Luna × Maverick = DOUBLE MERLE WARNING (M/m × M/m)');
  console.log('   • Luna × Shadow = Safe merle breeding');
  console.log('   • Bella × Cooper = Doodle furnishings test');
  console.log('   • Max × Sadie = EIC carrier × carrier (25% affected)');
  console.log('   • Pierre × Fifi = Fluffy French Bulldog test');
  console.log('');
  console.log('🧬 DOGS - COI Testing (with lineage):');
  console.log('   • Omega × Echo = HIGH COI (both from sibling matings)');
  console.log('   • Omega × Fives = CRITICAL COI (mother-son pairing!)');
  console.log('   • Fives × Captain Rex = CRITICAL COI (full siblings)');
  console.log('   • Commander Cody × Fives = HIGH COI (half-siblings)');
  console.log('   • Enhanced Clone Sire × any = HIGH COI (father-daughter origin)');
  console.log('   • Jango Fett × Kamino Clone Dam Alpha = CRITICAL (father-daughter)');
  console.log('');
  console.log('🐴 HORSES:');
  console.log('   • Painted Lady × Storm Chaser = LETHAL WHITE OVERO WARNING');
  console.log('   • Painted Lady × Midnight Run = Safe paint breeding');
  console.log('   • Impressive Legacy = HYPP carrier testing');
  console.log('');
  console.log('🐱 CATS:');
  console.log('   • Whiskers × Shadow = Colorpoint genetics test');
  console.log('   • Luna (Tortie) = Orange gene sex-linkage');
  console.log('');
  console.log('🐰 RABBITS:');
  console.log('   • Patches × Oreo = CHARLIE WARNING (En/en × En/en)');
  console.log('   • Snowball = Vienna/BEW genetics');
  console.log('');
  console.log('🐐 GOATS:');
  console.log('   • Buttercup × Thunder = POLLED × POLLED WARNING (intersex)');
  console.log('   • Buttercup × (horned) or Clover × Thunder = Safe breeding');
  console.log('─'.repeat(70));
  console.log('\n💡 Login as luke.skywalker@tester.local to test in Genetics Lab\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
