#!/usr/bin/env node
/**
 * Seed realistic Quarter Horse genetics data for Tenant 45 (Video Demo)
 *
 * Creates comprehensive genetics profiles to showcase the Genetics Lab:
 *   - Punnett Squares (coat color inheritance across 7 loci)
 *   - Health Risk Summary (HYPP + HERDA carrier × carrier warnings)
 *   - Offspring Simulator (100+ simulated offspring distribution)
 *   - Goal-Based Breeding (varied stallion/mare profiles for discovery)
 *   - COI Check (inbreeding coefficient — requires lineage data)
 *
 * Animals seeded:
 *   KNOWN (IDs hard-coded):
 *     • Phoebe          (ID 1977) — Buckskin QH Mare, HYPP + HERDA carrier
 *     • VS Code Red     (ID 1999) — Sorrel QH Stallion, HYPP + GBED carrier
 *
 *   DISCOVERED (queried from Tenant 45 — up to 6 more horses):
 *     Assigned one of 6 curated profiles based on sex + index:
 *       Stallion profiles: "Cremello Powerhouse", "Grullo Speedster", "Gray Ghost"
 *       Mare profiles:     "Red Roan Beauty", "Palomino Princess", "Black Velvet"
 *
 * Demo storyline:
 *   1. Select Phoebe (dam) + VS Code Red (sire)
 *   2. Calculate Pairing → 6+ coat color loci with Punnett Squares
 *      Possible foals: Buckskin, Bay, Smoky Black, Black, Palomino, Sorrel
 *   3. Health tab → HYPP carrier×carrier WARNING (25% affected)
 *                  → HERDA carrier×carrier WARNING (25% affected)
 *                  → GBED, MH, PSSM1 all clear ✅
 *   4. Performance → Sprint vs Versatile MSTN prediction
 *   5. Goal-Based Breeding → "I want a Palomino" → finds Cremello stallion
 *   6. COI → calculated from lineage tree (if parent data exists)
 *
 * Usage:
 *   node scripts/seed-demo-genetics.js          (dry run)
 *   node scripts/seed-demo-genetics.js --apply   (insert into dev DB)
 */

const TENANT_ID = 45;

// ─── Known Animals ──────────────────────────────────────────────────────────
const PHOEBE_ID = 1977;
const VS_CODE_RED_ID = 1999;

// ─── Genetics Profiles ──────────────────────────────────────────────────────

/**
 * Phoebe — Buckskin Quarter Horse Mare
 *
 * Phenotype: Rich golden body with black points (mane, tail, legs)
 * Genotype highlights:
 *   - E/e: Black-based, carries red → foals could be sorrel
 *   - A/a: Bay pattern, carries black → could produce true blacks
 *   - Cr/n: Single cream dilution → Buckskin phenotype
 *   - HYPP N/H: CARRIER (Impressive bloodline trait)
 *   - HERDA N/HRD: CARRIER (adds second health warning)
 *   - MSTN C/C: Sprint genotype (classic reining/cutting QH)
 */
const PHOEBE_GENETICS = {
  testProvider: "UC Davis VGL",
  testDate: "2024-06-15",
  testId: "VGL-2024-QH-88421",

  coatColorData: [
    { locus: "E", locusName: "Extension (Red Factor)", allele1: "E", allele2: "e", genotype: "E/e" },
    { locus: "A", locusName: "Agouti", allele1: "A", allele2: "a", genotype: "A/a" },
    { locus: "Cr", locusName: "Cream", allele1: "Cr", allele2: "n", genotype: "Cr/n" },
    { locus: "D", locusName: "Dun", allele1: "d", allele2: "d", genotype: "d/d" },
    { locus: "G", locusName: "Gray", allele1: "g", allele2: "g", genotype: "g/g" },
    { locus: "TO", locusName: "Tobiano", allele1: "to", allele2: "to", genotype: "to/to" },
    { locus: "O", locusName: "Frame Overo (OLWS)", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "Rn", locusName: "Roan", allele1: "rn", allele2: "rn", genotype: "rn/rn" },
    { locus: "W20", locusName: "W20 (Sabino-like White)", allele1: "W20", allele2: "n", genotype: "W20/n" },
    { locus: "SB1", locusName: "Sabino 1", allele1: "N", allele2: "N", genotype: "N/N" },
  ],

  healthGeneticsData: [
    { locus: "HYPP", locusName: "Hyperkalemic Periodic Paralysis", allele1: "N", allele2: "H", genotype: "N/H" },
    { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "HRD", genotype: "N/HRD" },
    { locus: "GBED", locusName: "Glycogen Branching Enzyme Deficiency", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "OLWS", locusName: "Overo Lethal White Syndrome", allele1: "N", allele2: "N", genotype: "N/N" },
  ],

  performanceData: [
    { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "C", allele2: "C", genotype: "C/C" },
    { locus: "DMRT3", locusName: "Gait Keeper", allele1: "C", allele2: "C", genotype: "C/C" },
  ],

  physicalTraitsData: [
    { locus: "LCORL", locusName: "Height (LCORL)", allele1: "T", allele2: "C", genotype: "T/C" },
    { locus: "HMGA2", locusName: "Height (HMGA2)", allele1: "G", allele2: "A", genotype: "G/A" },
  ],

  temperamentData: [
    { locus: "SLC6A4", locusName: "Serotonin Transporter", allele1: "L", allele2: "S", genotype: "L/S" },
  ],

  coatTypeData: [],
  eyeColorData: [],
  otherTraitsData: [],

  breedComposition: [
    { breed: "Quarter Horse", percentage: 87.5 },
    { breed: "Thoroughbred", percentage: 12.5 },
  ],

  coi: {
    coefficient: 0.0312,
    percentage: 3.12,
    riskLevel: "excellent",
    source: "calculated",
  },

  lineage: {
    mtHaplotype: "D1a",
    mtHaplogroup: "D1",
  },

  predictedAdultWeight: { value: 1050, unit: "lbs" },
  mhcDiversity: null,
  lifeStage: "Adult",
};

/**
 * VS Code Red — Sorrel Quarter Horse Stallion
 *
 * Phenotype: Rich reddish-copper body, flaxen mane/tail
 * Genotype highlights:
 *   - e/e: Red base (sorrel/chestnut) — no black pigment
 *   - A/a: Carries agouti (masked by ee, but passes to offspring)
 *   - HYPP N/H: CARRIER → paired with Phoebe = 25% affected
 *   - GBED N/GBD: CARRIER (shows moderate risk on health panel)
 *   - MSTN C/T: Versatile (middle-distance) — contrasts Phoebe's sprint type
 */
const VS_CODE_RED_GENETICS = {
  testProvider: "UC Davis VGL",
  testDate: "2024-03-10",
  testId: "VGL-2024-QH-77103",

  coatColorData: [
    { locus: "E", locusName: "Extension (Red Factor)", allele1: "e", allele2: "e", genotype: "e/e" },
    { locus: "A", locusName: "Agouti", allele1: "A", allele2: "a", genotype: "A/a" },
    { locus: "Cr", locusName: "Cream", allele1: "n", allele2: "n", genotype: "n/n" },
    { locus: "D", locusName: "Dun", allele1: "d", allele2: "d", genotype: "d/d" },
    { locus: "G", locusName: "Gray", allele1: "g", allele2: "g", genotype: "g/g" },
    { locus: "TO", locusName: "Tobiano", allele1: "to", allele2: "to", genotype: "to/to" },
    { locus: "O", locusName: "Frame Overo (OLWS)", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "Rn", locusName: "Roan", allele1: "rn", allele2: "rn", genotype: "rn/rn" },
    { locus: "W20", locusName: "W20 (Sabino-like White)", allele1: "n", allele2: "n", genotype: "n/n" },
    { locus: "SB1", locusName: "Sabino 1", allele1: "N", allele2: "N", genotype: "N/N" },
  ],

  healthGeneticsData: [
    { locus: "HYPP", locusName: "Hyperkalemic Periodic Paralysis", allele1: "N", allele2: "H", genotype: "N/H" },
    { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "HRD", genotype: "N/HRD" },
    { locus: "GBED", locusName: "Glycogen Branching Enzyme Deficiency", allele1: "N", allele2: "GBD", genotype: "N/GBD" },
    { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "OLWS", locusName: "Overo Lethal White Syndrome", allele1: "N", allele2: "N", genotype: "N/N" },
  ],

  performanceData: [
    { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "C", allele2: "T", genotype: "C/T" },
    { locus: "DMRT3", locusName: "Gait Keeper", allele1: "C", allele2: "C", genotype: "C/C" },
  ],

  physicalTraitsData: [
    { locus: "LCORL", locusName: "Height (LCORL)", allele1: "T", allele2: "T", genotype: "T/T" },
    { locus: "HMGA2", locusName: "Height (HMGA2)", allele1: "G", allele2: "G", genotype: "G/G" },
  ],

  temperamentData: [
    { locus: "SLC6A4", locusName: "Serotonin Transporter", allele1: "L", allele2: "L", genotype: "L/L" },
  ],

  coatTypeData: [],
  eyeColorData: [],
  otherTraitsData: [],

  breedComposition: [
    { breed: "Quarter Horse", percentage: 93.75 },
    { breed: "Thoroughbred", percentage: 6.25 },
  ],

  coi: {
    coefficient: 0.0156,
    percentage: 1.56,
    riskLevel: "excellent",
    source: "calculated",
  },

  lineage: {
    mtHaplotype: "A2b",
    mtHaplogroup: "A2",
    yHaplotype: "TB-1",
    yHaplogroup: "TB",
  },

  predictedAdultWeight: { value: 1150, unit: "lbs" },
  mhcDiversity: null,
  lifeStage: "Adult",
};

// ─── Extra Profiles (for Goal-Based Breeding discovery) ─────────────────────

/**
 * Cremello Powerhouse — Stallion
 * Double-cream dilution guarantees ALL foals get at least one cream allele.
 * Pair with ANY mare → foals are buckskin/palomino/smoky.
 * Health: 100% clear on 5-panel — the "safe choice" stallion.
 */
const STALLION_PROFILE_CREMELLO = {
  label: "Cremello Powerhouse",
  testProvider: "Etalon Diagnostics",
  testDate: "2025-01-20",
  testId: "ET-2025-EQ-14892",
  coatColorData: [
    { locus: "E", locusName: "Extension (Red Factor)", allele1: "E", allele2: "E", genotype: "E/E" },
    { locus: "A", locusName: "Agouti", allele1: "A", allele2: "A", genotype: "A/A" },
    { locus: "Cr", locusName: "Cream", allele1: "Cr", allele2: "Cr", genotype: "Cr/Cr" },
    { locus: "D", locusName: "Dun", allele1: "d", allele2: "d", genotype: "d/d" },
    { locus: "G", locusName: "Gray", allele1: "g", allele2: "g", genotype: "g/g" },
    { locus: "Rn", locusName: "Roan", allele1: "rn", allele2: "rn", genotype: "rn/rn" },
    { locus: "O", locusName: "Frame Overo (OLWS)", allele1: "N", allele2: "N", genotype: "N/N" },
  ],
  healthGeneticsData: [
    { locus: "HYPP", locusName: "Hyperkalemic Periodic Paralysis", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "GBED", locusName: "Glycogen Branching Enzyme Deficiency", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "N", genotype: "N/N" },
  ],
  performanceData: [
    { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "C", allele2: "C", genotype: "C/C" },
    { locus: "DMRT3", locusName: "Gait Keeper", allele1: "C", allele2: "C", genotype: "C/C" },
  ],
  physicalTraitsData: [
    { locus: "LCORL", locusName: "Height (LCORL)", allele1: "T", allele2: "C", genotype: "T/C" },
  ],
  temperamentData: [
    { locus: "SLC6A4", locusName: "Serotonin Transporter", allele1: "L", allele2: "L", genotype: "L/L" },
  ],
};

/**
 * Grullo Speedster — Stallion
 * Dun + black base = grullo (rare, striking color).
 * GBED carrier adds interesting health contrast.
 */
const STALLION_PROFILE_GRULLO = {
  label: "Grullo Speedster",
  testProvider: "Animal Genetics Inc.",
  testDate: "2024-11-05",
  testId: "AGI-2024-EQ-33017",
  coatColorData: [
    { locus: "E", locusName: "Extension (Red Factor)", allele1: "E", allele2: "E", genotype: "E/E" },
    { locus: "A", locusName: "Agouti", allele1: "a", allele2: "a", genotype: "a/a" },
    { locus: "Cr", locusName: "Cream", allele1: "n", allele2: "n", genotype: "n/n" },
    { locus: "D", locusName: "Dun", allele1: "D", allele2: "d", genotype: "D/d" },
    { locus: "G", locusName: "Gray", allele1: "g", allele2: "g", genotype: "g/g" },
    { locus: "Rn", locusName: "Roan", allele1: "rn", allele2: "rn", genotype: "rn/rn" },
    { locus: "O", locusName: "Frame Overo (OLWS)", allele1: "N", allele2: "N", genotype: "N/N" },
  ],
  healthGeneticsData: [
    { locus: "HYPP", locusName: "Hyperkalemic Periodic Paralysis", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "GBED", locusName: "Glycogen Branching Enzyme Deficiency", allele1: "N", allele2: "GBD", genotype: "N/GBD" },
    { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "N", genotype: "N/N" },
  ],
  performanceData: [
    { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "C", allele2: "T", genotype: "C/T" },
    { locus: "DMRT3", locusName: "Gait Keeper", allele1: "C", allele2: "C", genotype: "C/C" },
  ],
  physicalTraitsData: [
    { locus: "LCORL", locusName: "Height (LCORL)", allele1: "C", allele2: "C", genotype: "C/C" },
  ],
  temperamentData: [
    { locus: "SLC6A4", locusName: "Serotonin Transporter", allele1: "L", allele2: "S", genotype: "L/S" },
  ],
};

/**
 * Gray Ghost — Stallion
 * Gray gene means this horse will progressively gray out.
 * Interesting for Punnett Square: 50% of offspring will gray out too.
 */
const STALLION_PROFILE_GRAY = {
  label: "Gray Ghost",
  testProvider: "UC Davis VGL",
  testDate: "2025-02-01",
  testId: "VGL-2025-QH-90044",
  coatColorData: [
    { locus: "E", locusName: "Extension (Red Factor)", allele1: "E", allele2: "e", genotype: "E/e" },
    { locus: "A", locusName: "Agouti", allele1: "A", allele2: "A", genotype: "A/A" },
    { locus: "Cr", locusName: "Cream", allele1: "n", allele2: "n", genotype: "n/n" },
    { locus: "D", locusName: "Dun", allele1: "d", allele2: "d", genotype: "d/d" },
    { locus: "G", locusName: "Gray", allele1: "G", allele2: "g", genotype: "G/g" },
    { locus: "Rn", locusName: "Roan", allele1: "rn", allele2: "rn", genotype: "rn/rn" },
    { locus: "O", locusName: "Frame Overo (OLWS)", allele1: "N", allele2: "N", genotype: "N/N" },
  ],
  healthGeneticsData: [
    { locus: "HYPP", locusName: "Hyperkalemic Periodic Paralysis", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "GBED", locusName: "Glycogen Branching Enzyme Deficiency", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "N", genotype: "N/N" },
  ],
  performanceData: [
    { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "T", allele2: "T", genotype: "T/T" },
    { locus: "DMRT3", locusName: "Gait Keeper", allele1: "C", allele2: "C", genotype: "C/C" },
  ],
  physicalTraitsData: [
    { locus: "LCORL", locusName: "Height (LCORL)", allele1: "T", allele2: "T", genotype: "T/T" },
  ],
  temperamentData: [
    { locus: "SLC6A4", locusName: "Serotonin Transporter", allele1: "S", allele2: "S", genotype: "S/S" },
  ],
};

/**
 * Red Roan Beauty — Mare
 * Roan gene creates stunning white-flecked pattern.
 * Clear 5-panel makes her the "safe pairing" option.
 */
const MARE_PROFILE_ROAN = {
  label: "Red Roan Beauty",
  testProvider: "UC Davis VGL",
  testDate: "2024-09-12",
  testId: "VGL-2024-QH-82115",
  coatColorData: [
    { locus: "E", locusName: "Extension (Red Factor)", allele1: "e", allele2: "e", genotype: "e/e" },
    { locus: "A", locusName: "Agouti", allele1: "A", allele2: "A", genotype: "A/A" },
    { locus: "Cr", locusName: "Cream", allele1: "n", allele2: "n", genotype: "n/n" },
    { locus: "D", locusName: "Dun", allele1: "d", allele2: "d", genotype: "d/d" },
    { locus: "G", locusName: "Gray", allele1: "g", allele2: "g", genotype: "g/g" },
    { locus: "Rn", locusName: "Roan", allele1: "Rn", allele2: "rn", genotype: "Rn/rn" },
    { locus: "O", locusName: "Frame Overo (OLWS)", allele1: "N", allele2: "N", genotype: "N/N" },
  ],
  healthGeneticsData: [
    { locus: "HYPP", locusName: "Hyperkalemic Periodic Paralysis", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "GBED", locusName: "Glycogen Branching Enzyme Deficiency", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "N", genotype: "N/N" },
  ],
  performanceData: [
    { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "C", allele2: "C", genotype: "C/C" },
  ],
  physicalTraitsData: [
    { locus: "LCORL", locusName: "Height (LCORL)", allele1: "T", allele2: "C", genotype: "T/C" },
  ],
  temperamentData: [
    { locus: "SLC6A4", locusName: "Serotonin Transporter", allele1: "L", allele2: "L", genotype: "L/L" },
  ],
};

/**
 * Palomino Princess — Mare
 * ee + single cream = gorgeous golden palomino.
 * Paired with Cremello stallion → 100% palomino/cremello offspring.
 */
const MARE_PROFILE_PALOMINO = {
  label: "Palomino Princess",
  testProvider: "Etalon Diagnostics",
  testDate: "2024-08-22",
  testId: "ET-2024-EQ-11576",
  coatColorData: [
    { locus: "E", locusName: "Extension (Red Factor)", allele1: "e", allele2: "e", genotype: "e/e" },
    { locus: "A", locusName: "Agouti", allele1: "A", allele2: "a", genotype: "A/a" },
    { locus: "Cr", locusName: "Cream", allele1: "Cr", allele2: "n", genotype: "Cr/n" },
    { locus: "D", locusName: "Dun", allele1: "d", allele2: "d", genotype: "d/d" },
    { locus: "G", locusName: "Gray", allele1: "g", allele2: "g", genotype: "g/g" },
    { locus: "Rn", locusName: "Roan", allele1: "rn", allele2: "rn", genotype: "rn/rn" },
    { locus: "O", locusName: "Frame Overo (OLWS)", allele1: "N", allele2: "N", genotype: "N/N" },
  ],
  healthGeneticsData: [
    { locus: "HYPP", locusName: "Hyperkalemic Periodic Paralysis", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "HRD", genotype: "N/HRD" },
    { locus: "GBED", locusName: "Glycogen Branching Enzyme Deficiency", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "N", genotype: "N/N" },
  ],
  performanceData: [
    { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "C", allele2: "C", genotype: "C/C" },
  ],
  physicalTraitsData: [
    { locus: "LCORL", locusName: "Height (LCORL)", allele1: "C", allele2: "C", genotype: "C/C" },
  ],
  temperamentData: [
    { locus: "SLC6A4", locusName: "Serotonin Transporter", allele1: "L", allele2: "S", genotype: "L/S" },
  ],
};

/**
 * Black Velvet — Mare
 * True black (EE + aa). No dilutions, no white patterns.
 * PSSM1 carrier — adds variety to health comparisons.
 */
const MARE_PROFILE_BLACK = {
  label: "Black Velvet",
  testProvider: "Animal Genetics Inc.",
  testDate: "2025-01-10",
  testId: "AGI-2025-EQ-40221",
  coatColorData: [
    { locus: "E", locusName: "Extension (Red Factor)", allele1: "E", allele2: "E", genotype: "E/E" },
    { locus: "A", locusName: "Agouti", allele1: "a", allele2: "a", genotype: "a/a" },
    { locus: "Cr", locusName: "Cream", allele1: "n", allele2: "n", genotype: "n/n" },
    { locus: "D", locusName: "Dun", allele1: "d", allele2: "d", genotype: "d/d" },
    { locus: "G", locusName: "Gray", allele1: "g", allele2: "g", genotype: "g/g" },
    { locus: "Rn", locusName: "Roan", allele1: "rn", allele2: "rn", genotype: "rn/rn" },
    { locus: "O", locusName: "Frame Overo (OLWS)", allele1: "N", allele2: "N", genotype: "N/N" },
  ],
  healthGeneticsData: [
    { locus: "HYPP", locusName: "Hyperkalemic Periodic Paralysis", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "HERDA", locusName: "Hereditary Equine Regional Dermal Asthenia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "GBED", locusName: "Glycogen Branching Enzyme Deficiency", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "MH", locusName: "Malignant Hyperthermia", allele1: "N", allele2: "N", genotype: "N/N" },
    { locus: "PSSM1", locusName: "Polysaccharide Storage Myopathy Type 1", allele1: "N", allele2: "P1", genotype: "N/P1" },
  ],
  performanceData: [
    { locus: "MSTN", locusName: "Myostatin (Speed Gene)", allele1: "T", allele2: "T", genotype: "T/T" },
  ],
  physicalTraitsData: [
    { locus: "LCORL", locusName: "Height (LCORL)", allele1: "T", allele2: "T", genotype: "T/T" },
  ],
  temperamentData: [
    { locus: "SLC6A4", locusName: "Serotonin Transporter", allele1: "L", allele2: "L", genotype: "L/L" },
  ],
};

const STALLION_PROFILES = [STALLION_PROFILE_CREMELLO, STALLION_PROFILE_GRULLO, STALLION_PROFILE_GRAY];
const MARE_PROFILES = [MARE_PROFILE_ROAN, MARE_PROFILE_PALOMINO, MARE_PROFILE_BLACK];

// ─── Dry Run Summary ────────────────────────────────────────────────────────

function printDryRunSummary() {
  console.log("─── Known Animals (hard-coded IDs) ───\n");

  console.log("  ★ Phoebe (ID 1977) — Buckskin QH Mare (PRIMARY DAM)");
  console.log("    Provider: UC Davis VGL (2024-06-15)");
  console.log("    Coat Color: 10 loci (E/e, A/a, Cr/n, D, G, TO, OLWS, Rn, W20, SB1)");
  console.log("    Health: 6 loci (HYPP, HERDA, GBED, MH, PSSM1, OLWS)");
  console.log("    ⚠️  Carriers: HYPP (N/H), HERDA (N/HRD)");
  console.log("    Performance: MSTN (C/C Sprint), DMRT3 (C/C)");
  console.log("    Height: LCORL (T/C), HMGA2 (G/A) — ~15.1 hands");
  console.log("    Temperament: SLC6A4 (L/S — Intermediate)");
  console.log();

  console.log("  ★ VS Code Red (ID 1999) — Sorrel QH Stallion (PRIMARY SIRE)");
  console.log("    Provider: UC Davis VGL (2024-03-10)");
  console.log("    Coat Color: 10 loci (e/e, A/a, n/n Cr, D, G, TO, OLWS, Rn, W20, SB1)");
  console.log("    Health: 6 loci (HYPP, HERDA, GBED, MH, PSSM1, OLWS)");
  console.log("    ⚠️  Carriers: HYPP (N/H), HERDA (N/HRD), GBED (N/GBD)");
  console.log("    Performance: MSTN (C/T Versatile), DMRT3 (C/C)");
  console.log("    Height: LCORL (T/T), HMGA2 (G/G) — ~16.0 hands");
  console.log("    Temperament: SLC6A4 (L/L — Calm)");
  console.log();

  console.log("─── Additional Animals (discovered at runtime) ───\n");
  console.log("  Up to 3 extra stallions assigned profiles:");
  console.log("    1. Cremello Powerhouse — Cr/Cr (double cream), all clear health");
  console.log("    2. Grullo Speedster — E/E a/a D/d (dun+black), GBED carrier");
  console.log("    3. Gray Ghost — G/g (gray gene), MSTN T/T (endurance)");
  console.log();
  console.log("  Up to 3 extra mares assigned profiles:");
  console.log("    1. Red Roan Beauty — e/e Rn/rn (roan), all clear health");
  console.log("    2. Palomino Princess — e/e Cr/n (palomino), HERDA carrier");
  console.log("    3. Black Velvet — E/E a/a (true black), PSSM1 carrier");
  console.log();

  console.log("─── Primary Pairing Prediction (Phoebe × VS Code Red) ───\n");
  console.log("  Coat Color Offspring Possibilities:");
  console.log("    E locus: E/e × e/e → 50% E/e (black-based), 50% e/e (red-based)");
  console.log("    A locus: A/a × A/a → 25% A/A, 50% A/a, 25% a/a");
  console.log("    Cr locus: Cr/n × n/n → 50% Cr/n (cream dilute), 50% n/n");
  console.log("    W20 locus: W20/n × n/n → 50% W20/n (white markings), 50% n/n");
  console.log();
  console.log("  Combined Phenotypes:");
  console.log("    ~12.5%  Buckskin       (E/_, A/_, Cr/n)");
  console.log("    ~12.5%  Bay            (E/_, A/_, n/n)");
  console.log("     ~6.25% Smoky Black    (E/_, a/a, Cr/n)");
  console.log("     ~6.25% Black          (E/_, a/a, n/n)");
  console.log("    ~25%    Palomino       (e/e, _, Cr/n)");
  console.log("    ~25%    Sorrel/Chestnut (e/e, _, n/n)");
  console.log();
  console.log("  Health Risks:");
  console.log("    ⚠️  HYPP:  N/H × N/H   → 25% H/H (AFFECTED — muscle tremors/collapse)");
  console.log("    ⚠️  HERDA: N/HRD × N/HRD → 25% HRD/HRD (AFFECTED — skin fragility)");
  console.log("    ℹ️  GBED:  N/N × N/GBD  → 50% carrier (no affected risk)");
  console.log("    ✅ MH:    Clear × Clear");
  console.log("    ✅ PSSM1: Clear × Clear");
  console.log();
  console.log("  Performance:");
  console.log("    MSTN: C/C × C/T → 50% Sprint (C/C), 50% Versatile (C/T)");
  console.log("    DMRT3: C/C × C/C → 100% Standard gait");
  console.log();
  console.log("  Height Prediction:");
  console.log("    LCORL: T/C × T/T → 50% T/T (tall), 50% T/C (medium-tall)");
  console.log("    HMGA2: G/A × G/G → 50% G/G (taller), 50% G/A (average)");
  console.log();
  console.log("  Temperament:");
  console.log("    SLC6A4: L/S × L/L → 50% L/L (calm), 50% L/S (intermediate)");
  console.log();

  console.log("─── Goal-Based Breeding Scenarios ───\n");
  console.log('  "I want a Palomino"');
  console.log("    → System recommends Cremello Powerhouse (Cr/Cr guarantees cream allele)");
  console.log("    → Paired with Phoebe: 50% palomino/cremello guaranteed");
  console.log();
  console.log('  "I want all health-clear offspring"');
  console.log("    → System recommends Red Roan Beauty (all 5-panel clear)");
  console.log("    → Paired with any clear stallion: 0% affected risk");
  console.log();
  console.log('  "I want a Grullo foal"');
  console.log("    → System recommends Grullo Speedster (D/d + a/a = dun dilution on black)");
  console.log("    → Paired with Black Velvet mare: 50% dun offspring");
  console.log();

  console.log("─── Pass --apply to write to database ───");
}

// ─── Main Logic ─────────────────────────────────────────────────────────────

async function main() {
  const dryRun = !process.argv.includes("--apply");

  console.log("🧬 Genetics Lab Demo Seed — Tenant 45 (Quarter Horses)");
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
    // 1. Verify known animals exist
    const phoebe = await prisma.animal.findFirst({
      where: { id: PHOEBE_ID, tenantId: TENANT_ID },
      select: { id: true, name: true, sex: true, species: true, breed: true },
    });
    const vsCodeRed = await prisma.animal.findFirst({
      where: { id: VS_CODE_RED_ID, tenantId: TENANT_ID },
      select: { id: true, name: true, sex: true, species: true, breed: true },
    });

    if (!phoebe) console.warn(`⚠️  Phoebe (ID ${PHOEBE_ID}) not found in Tenant ${TENANT_ID}`);
    if (!vsCodeRed) console.warn(`⚠️  VS Code Red (ID ${VS_CODE_RED_ID}) not found in Tenant ${TENANT_ID}`);

    // 2. Find additional horses for Goal-Based Breeding
    const additionalHorses = await prisma.animal.findMany({
      where: {
        tenantId: TENANT_ID,
        species: "HORSE",
        id: { notIn: [PHOEBE_ID, VS_CODE_RED_ID] },
      },
      select: { id: true, name: true, sex: true, breed: true },
      orderBy: { name: "asc" },
      take: 20,
    });

    const extraStallions = additionalHorses.filter((a) => a.sex === "MALE");
    const extraMares = additionalHorses.filter((a) => a.sex === "FEMALE");

    console.log(`  Found ${additionalHorses.length} additional horses (${extraStallions.length}M, ${extraMares.length}F)\n`);

    // 3. Build seed plan
    const seedPlan = [];

    if (phoebe) {
      seedPlan.push({
        animal: phoebe,
        genetics: PHOEBE_GENETICS,
        label: "★ Phoebe — Buckskin QH Mare (PRIMARY DAM)",
      });
    }

    if (vsCodeRed) {
      seedPlan.push({
        animal: vsCodeRed,
        genetics: VS_CODE_RED_GENETICS,
        label: "★ VS Code Red — Sorrel QH Stallion (PRIMARY SIRE)",
      });
    }

    // Assign profiles to extra stallions (up to 3)
    extraStallions.slice(0, 3).forEach((s, i) => {
      const profile = STALLION_PROFILES[i];
      seedPlan.push({
        animal: s,
        genetics: {
          testProvider: profile.testProvider,
          testDate: profile.testDate,
          testId: profile.testId,
          coatColorData: profile.coatColorData,
          healthGeneticsData: profile.healthGeneticsData,
          performanceData: profile.performanceData,
          physicalTraitsData: profile.physicalTraitsData,
          temperamentData: profile.temperamentData,
          coatTypeData: [],
          eyeColorData: [],
          otherTraitsData: [],
          breedComposition: [{ breed: "Quarter Horse", percentage: 100 }],
          coi: null,
          lineage: null,
          predictedAdultWeight: null,
          mhcDiversity: null,
          lifeStage: "Adult",
        },
        label: `  ${profile.label} (${s.name})`,
      });
    });

    // Assign profiles to extra mares (up to 3)
    extraMares.slice(0, 3).forEach((m, i) => {
      const profile = MARE_PROFILES[i];
      seedPlan.push({
        animal: m,
        genetics: {
          testProvider: profile.testProvider,
          testDate: profile.testDate,
          testId: profile.testId,
          coatColorData: profile.coatColorData,
          healthGeneticsData: profile.healthGeneticsData,
          performanceData: profile.performanceData,
          physicalTraitsData: profile.physicalTraitsData,
          temperamentData: profile.temperamentData,
          coatTypeData: [],
          eyeColorData: [],
          otherTraitsData: [],
          breedComposition: [{ breed: "Quarter Horse", percentage: 100 }],
          coi: null,
          lineage: null,
          predictedAdultWeight: null,
          mhcDiversity: null,
          lifeStage: "Adult",
        },
        label: `  ${profile.label} (${m.name})`,
      });
    });

    // 4. Print plan
    console.log("─── Seed Plan ───");
    for (const entry of seedPlan) {
      const g = entry.genetics;
      const cc = g.coatColorData?.length || 0;
      const hp = g.healthGeneticsData?.length || 0;
      const pf = g.performanceData?.length || 0;
      const pt = g.physicalTraitsData?.length || 0;
      const tm = g.temperamentData?.length || 0;
      console.log(`\n  ${entry.label}`);
      console.log(`    ID: ${entry.animal.id} | ${entry.animal.breed || "QH"} | ${entry.animal.sex}`);
      console.log(`    Provider: ${g.testProvider} (${g.testDate})`);
      console.log(`    Loci: ${cc} coat, ${hp} health, ${pf} perf, ${pt} phys, ${tm} temp`);

      const carriers = (g.healthGeneticsData || []).filter(
        (h) => h.allele1 !== h.allele2 && h.allele2 !== "N"
      );
      if (carriers.length > 0) {
        console.log(`    ⚠️  Carriers: ${carriers.map((c) => `${c.locus} (${c.genotype})`).join(", ")}`);
      } else {
        console.log(`    ✅ 5-Panel Clear`);
      }
    }

    // 5. Execute upserts
    console.log("\n─── Executing Upserts ───");
    for (const entry of seedPlan) {
      const g = entry.genetics;
      const data = {
        testProvider: g.testProvider || null,
        testDate: g.testDate ? new Date(g.testDate) : null,
        testId: g.testId || null,
        coatColorData: g.coatColorData || [],
        healthGeneticsData: g.healthGeneticsData || [],
        coatTypeData: g.coatTypeData || [],
        eyeColorData: g.eyeColorData || [],
        otherTraitsData: g.otherTraitsData || [],
        physicalTraitsData: g.physicalTraitsData || [],
        performanceData: g.performanceData || [],
        temperamentData: g.temperamentData || [],
        breedComposition: g.breedComposition || [],
        coi: g.coi || null,
        lineage: g.lineage || null,
        predictedAdultWeight: g.predictedAdultWeight || null,
        mhcDiversity: g.mhcDiversity || null,
        lifeStage: g.lifeStage || null,
      };

      await prisma.animalGenetics.upsert({
        where: { animalId: entry.animal.id },
        create: { animalId: entry.animal.id, ...data },
        update: data,
      });

      console.log(`  ✓ ${entry.label}`);
    }

    console.log(`\n✅ Done! Seeded genetics for ${seedPlan.length} horses.`);
    console.log("   → Open Genetics Lab, select Phoebe as dam + VS Code Red as sire");
    console.log("   → Click Calculate Pairing to see full analysis");
    console.log("   → Check Health tab for HYPP + HERDA carrier warnings");
    console.log("   → Try Goal-Based Breeding: 'I want a Palomino' → finds Cremello stallion");
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await prisma["$disconnect"]();
  }
}

main();
