/**
 * Embark CSV Parser
 *
 * Parses Embark dog DNA test results CSV files and converts them to our genetics schema.
 * Embark CSV format has three columns: Category, Name, Value
 *
 * Known Categories in Embark exports:
 * - "Color" - Coat color loci (E, K, A, B, D, M, S, etc.)
 * - "Trait" - Physical traits (Furnishings, Coat Length, etc.)
 * - "Health" - Health condition carrier status
 * - "Haplotype" - Maternal/Paternal lineage markers
 */

// Types for parsed data
export interface ParsedLocus {
  locus: string;
  locusName: string;
  allele1?: string;
  allele2?: string;
  genotype: string;
  source: 'embark';
}

export interface ParsedGenetics {
  coatColor: ParsedLocus[];
  coatType: ParsedLocus[];
  physicalTraits: ParsedLocus[];
  eyeColor: ParsedLocus[];
  health: ParsedLocus[];
  otherTraits: ParsedLocus[];
  unmapped: Array<{ category: string; name: string; value: string }>;
}

// Categories that contain ParsedLocus arrays (excludes 'unmapped')
type LocusCategory = 'coatColor' | 'coatType' | 'physicalTraits' | 'eyeColor' | 'health' | 'otherTraits';

export interface EmbarkParseResult {
  success: boolean;
  genetics: ParsedGenetics;
  warnings: string[];
  errors: string[];
}

// Mapping from Embark names to our locus codes and categories
const EMBARK_LOCUS_MAP: Record<string, { locus: string; locusName: string; category: LocusCategory }> = {
  // Coat Color Loci
  'E Locus (MC1R)': { locus: 'E', locusName: 'Extension', category: 'coatColor' },
  'E Locus': { locus: 'E', locusName: 'Extension', category: 'coatColor' },
  'Extension': { locus: 'E', locusName: 'Extension', category: 'coatColor' },
  'K Locus (CBD103)': { locus: 'K', locusName: 'Dominant Black', category: 'coatColor' },
  'K Locus': { locus: 'K', locusName: 'Dominant Black', category: 'coatColor' },
  'Dominant Black': { locus: 'K', locusName: 'Dominant Black', category: 'coatColor' },
  'A Locus (ASIP)': { locus: 'A', locusName: 'Agouti', category: 'coatColor' },
  'A Locus': { locus: 'A', locusName: 'Agouti', category: 'coatColor' },
  'Agouti': { locus: 'A', locusName: 'Agouti', category: 'coatColor' },
  'B Locus (TYRP1)': { locus: 'B', locusName: 'Brown', category: 'coatColor' },
  'B Locus': { locus: 'B', locusName: 'Brown', category: 'coatColor' },
  'Brown': { locus: 'B', locusName: 'Brown', category: 'coatColor' },
  'Cocoa': { locus: 'co', locusName: 'Cocoa', category: 'coatColor' },
  'D Locus (MLPH)': { locus: 'D', locusName: 'Dilute', category: 'coatColor' },
  'D Locus': { locus: 'D', locusName: 'Dilute', category: 'coatColor' },
  'Dilute': { locus: 'D', locusName: 'Dilute', category: 'coatColor' },
  'M Locus (PMEL)': { locus: 'M', locusName: 'Merle', category: 'coatColor' },
  'M Locus': { locus: 'M', locusName: 'Merle', category: 'coatColor' },
  'Merle': { locus: 'M', locusName: 'Merle', category: 'coatColor' },
  'H Locus (Harlequin)': { locus: 'H', locusName: 'Harlequin', category: 'coatColor' },
  'Harlequin': { locus: 'H', locusName: 'Harlequin', category: 'coatColor' },
  'S Locus (MITF)': { locus: 'S', locusName: 'White Spotting', category: 'coatColor' },
  'S Locus': { locus: 'S', locusName: 'White Spotting', category: 'coatColor' },
  'White Spotting': { locus: 'S', locusName: 'White Spotting', category: 'coatColor' },
  'T Locus (Ticking)': { locus: 'T', locusName: 'Ticking', category: 'coatColor' },
  'Ticking': { locus: 'T', locusName: 'Ticking', category: 'coatColor' },
  'R Locus (Roan)': { locus: 'R', locusName: 'Roan', category: 'coatColor' },
  'Roan': { locus: 'R', locusName: 'Roan', category: 'coatColor' },
  'I Locus (Intensity)': { locus: 'I', locusName: 'Intensity', category: 'coatColor' },
  'Intensity': { locus: 'I', locusName: 'Intensity', category: 'coatColor' },
  'Saddle Tan': { locus: 'RALY', locusName: 'Saddle Tan', category: 'coatColor' },

  // Coat Type Loci
  'Furnishings (RSPO2)': { locus: 'F', locusName: 'Furnishings', category: 'coatType' },
  'Furnishings': { locus: 'F', locusName: 'Furnishings', category: 'coatType' },
  'Improper Coat': { locus: 'IC', locusName: 'Improper Coat', category: 'coatType' },
  'Coat Length (FGF5)': { locus: 'L', locusName: 'Long Hair', category: 'coatType' },
  'Coat Length': { locus: 'L', locusName: 'Long Hair', category: 'coatType' },
  'Long Hair': { locus: 'L', locusName: 'Long Hair', category: 'coatType' },
  'Curly Coat (KRT71)': { locus: 'Cu', locusName: 'Curly', category: 'coatType' },
  'Curly Coat': { locus: 'Cu', locusName: 'Curly', category: 'coatType' },
  'Curly': { locus: 'Cu', locusName: 'Curly', category: 'coatType' },
  'Shedding (MC5R)': { locus: 'Sh', locusName: 'Shedding', category: 'coatType' },
  'Shedding': { locus: 'Sh', locusName: 'Shedding', category: 'coatType' },
  'Hairlessness (FOXI3)': { locus: 'Hr', locusName: 'Hairless', category: 'coatType' },
  'Hairlessness': { locus: 'Hr', locusName: 'Hairless', category: 'coatType' },
  'L4 (Fluffy)': { locus: 'L4', locusName: 'Fluffy (French Bulldog)', category: 'coatType' },
  'Fluffy': { locus: 'L4', locusName: 'Fluffy (French Bulldog)', category: 'coatType' },

  // Physical Traits
  'Body Size (IGF1)': { locus: 'IGF1', locusName: 'Body Size', category: 'physicalTraits' },
  'Body Size': { locus: 'IGF1', locusName: 'Body Size', category: 'physicalTraits' },
  'Natural Bobtail (T gene)': { locus: 'BT', locusName: 'Bobtail', category: 'physicalTraits' },
  'Bobtail': { locus: 'BT', locusName: 'Bobtail', category: 'physicalTraits' },
  'Hind Dewclaws': { locus: 'DC', locusName: 'Dewclaws', category: 'physicalTraits' },
  'Dewclaws': { locus: 'DC', locusName: 'Dewclaws', category: 'physicalTraits' },
  'Leg Length (CDKN2)': { locus: 'LL', locusName: 'Leg Length', category: 'physicalTraits' },
  'Leg Length': { locus: 'LL', locusName: 'Leg Length', category: 'physicalTraits' },
  'Back Muscling': { locus: 'BM', locusName: 'Back Muscling', category: 'physicalTraits' },
  'Blue Eyes': { locus: 'BE', locusName: 'Blue Eyes', category: 'eyeColor' },
  'ALX4': { locus: 'ALX4', locusName: 'Blue Eyes (ALX4)', category: 'eyeColor' },

  // ============================================================================
  // HEALTH CONDITIONS - BLOOD DISORDERS (35+)
  // ============================================================================

  // MDR1 Drug Sensitivity
  'MDR1': { locus: 'ABCB1', locusName: 'MDR1 Drug Sensitivity', category: 'health' },
  'MDR1 Drug Sensitivity': { locus: 'ABCB1', locusName: 'MDR1 Drug Sensitivity', category: 'health' },
  'ABCB1': { locus: 'ABCB1', locusName: 'MDR1 Drug Sensitivity', category: 'health' },
  'Multidrug Resistance 1': { locus: 'ABCB1', locusName: 'MDR1 Drug Sensitivity', category: 'health' },
  'Ivermectin Sensitivity': { locus: 'ABCB1', locusName: 'MDR1 Drug Sensitivity', category: 'health' },

  // Hemophilia / Clotting Factor Deficiencies
  'Factor IX Deficiency': { locus: 'F9', locusName: 'Factor IX Deficiency (Hemophilia B)', category: 'health' },
  'Hemophilia B': { locus: 'F9', locusName: 'Factor IX Deficiency (Hemophilia B)', category: 'health' },
  'F9': { locus: 'F9', locusName: 'Factor IX Deficiency (Hemophilia B)', category: 'health' },
  'Factor VII Deficiency': { locus: 'F7', locusName: 'Factor VII Deficiency', category: 'health' },
  'F7': { locus: 'F7', locusName: 'Factor VII Deficiency', category: 'health' },
  'Factor VIII Deficiency': { locus: 'F8', locusName: 'Factor VIII Deficiency (Hemophilia A)', category: 'health' },
  'Hemophilia A': { locus: 'F8', locusName: 'Factor VIII Deficiency (Hemophilia A)', category: 'health' },
  'F8': { locus: 'F8', locusName: 'Factor VIII Deficiency (Hemophilia A)', category: 'health' },
  'Factor XI Deficiency': { locus: 'F11', locusName: 'Factor XI Deficiency', category: 'health' },
  'F11': { locus: 'F11', locusName: 'Factor XI Deficiency', category: 'health' },

  // Von Willebrand Disease
  'Von Willebrand Disease': { locus: 'VWF', locusName: 'Von Willebrand Disease', category: 'health' },
  'vWD': { locus: 'VWF', locusName: 'Von Willebrand Disease', category: 'health' },
  'VWF': { locus: 'VWF', locusName: 'Von Willebrand Disease', category: 'health' },
  'Von Willebrand Disease Type I': { locus: 'VWF-1', locusName: 'Von Willebrand Disease Type I', category: 'health' },
  'vWD Type 1': { locus: 'VWF-1', locusName: 'Von Willebrand Disease Type I', category: 'health' },
  'vWD Type I': { locus: 'VWF-1', locusName: 'Von Willebrand Disease Type I', category: 'health' },
  'vWD1': { locus: 'VWF-1', locusName: 'Von Willebrand Disease Type I', category: 'health' },
  'Von Willebrand Disease Type II': { locus: 'VWF-2', locusName: 'Von Willebrand Disease Type II', category: 'health' },
  'vWD Type 2': { locus: 'VWF-2', locusName: 'Von Willebrand Disease Type II', category: 'health' },
  'vWD Type II': { locus: 'VWF-2', locusName: 'Von Willebrand Disease Type II', category: 'health' },
  'vWD2': { locus: 'VWF-2', locusName: 'Von Willebrand Disease Type II', category: 'health' },
  'Von Willebrand Disease Type III': { locus: 'VWF-3', locusName: 'Von Willebrand Disease Type III', category: 'health' },
  'vWD Type 3': { locus: 'VWF-3', locusName: 'Von Willebrand Disease Type III', category: 'health' },
  'vWD Type III': { locus: 'VWF-3', locusName: 'Von Willebrand Disease Type III', category: 'health' },
  'vWD3': { locus: 'VWF-3', locusName: 'Von Willebrand Disease Type III', category: 'health' },

  // Pyruvate Kinase Deficiency
  'Pyruvate Kinase Deficiency': { locus: 'PKLR', locusName: 'Pyruvate Kinase Deficiency', category: 'health' },
  'PKD': { locus: 'PKLR', locusName: 'Pyruvate Kinase Deficiency', category: 'health' },
  'PKLR': { locus: 'PKLR', locusName: 'Pyruvate Kinase Deficiency', category: 'health' },
  'Pyruvate Kinase Deficiency (Basenji Type)': { locus: 'PKLR-BAS', locusName: 'Pyruvate Kinase Deficiency (Basenji)', category: 'health' },
  'Pyruvate Kinase Deficiency (Labrador Retriever Type)': { locus: 'PKLR-LAB', locusName: 'Pyruvate Kinase Deficiency (Labrador)', category: 'health' },
  'Pyruvate Kinase Deficiency (Beagle Type)': { locus: 'PKLR-BEA', locusName: 'Pyruvate Kinase Deficiency (Beagle)', category: 'health' },
  'Pyruvate Kinase Deficiency (Pug Type)': { locus: 'PKLR-PUG', locusName: 'Pyruvate Kinase Deficiency (Pug)', category: 'health' },

  // Phosphofructokinase Deficiency
  'Phosphofructokinase Deficiency': { locus: 'PFKM', locusName: 'Phosphofructokinase Deficiency', category: 'health' },
  'PFK Deficiency': { locus: 'PFKM', locusName: 'Phosphofructokinase Deficiency', category: 'health' },
  'PFKM': { locus: 'PFKM', locusName: 'Phosphofructokinase Deficiency', category: 'health' },

  // Canine Leukocyte Adhesion Deficiency
  'Canine Leukocyte Adhesion Deficiency': { locus: 'ITGB2', locusName: 'Canine Leukocyte Adhesion Deficiency', category: 'health' },
  'CLAD': { locus: 'ITGB2', locusName: 'Canine Leukocyte Adhesion Deficiency', category: 'health' },
  'ITGB2': { locus: 'ITGB2', locusName: 'Canine Leukocyte Adhesion Deficiency', category: 'health' },

  // Trapped Neutrophil Syndrome
  'Trapped Neutrophil Syndrome': { locus: 'VPS13B', locusName: 'Trapped Neutrophil Syndrome', category: 'health' },
  'TNS': { locus: 'VPS13B', locusName: 'Trapped Neutrophil Syndrome', category: 'health' },
  'VPS13B': { locus: 'VPS13B', locusName: 'Trapped Neutrophil Syndrome', category: 'health' },

  // Cyclic Neutropenia
  'Cyclic Neutropenia': { locus: 'AP3B1', locusName: 'Cyclic Neutropenia (Gray Collie Syndrome)', category: 'health' },
  'Gray Collie Syndrome': { locus: 'AP3B1', locusName: 'Cyclic Neutropenia (Gray Collie Syndrome)', category: 'health' },
  'AP3B1': { locus: 'AP3B1', locusName: 'Cyclic Neutropenia (Gray Collie Syndrome)', category: 'health' },

  // Macrothrombocytopenia
  'Macrothrombocytopenia': { locus: 'TUBB1', locusName: 'Macrothrombocytopenia', category: 'health' },
  'TUBB1': { locus: 'TUBB1', locusName: 'Macrothrombocytopenia', category: 'health' },

  // Scott Syndrome
  'Scott Syndrome': { locus: 'ANO6', locusName: 'Scott Syndrome', category: 'health' },
  'ANO6': { locus: 'ANO6', locusName: 'Scott Syndrome', category: 'health' },

  // Prekallikrein Deficiency
  'Prekallikrein Deficiency': { locus: 'KLKB1', locusName: 'Prekallikrein Deficiency', category: 'health' },
  'KLKB1': { locus: 'KLKB1', locusName: 'Prekallikrein Deficiency', category: 'health' },

  // Glanzmann Thrombasthenia
  'Glanzmann Thrombasthenia Type I': { locus: 'ITGA2B', locusName: 'Glanzmann Thrombasthenia Type I', category: 'health' },
  'ITGA2B': { locus: 'ITGA2B', locusName: 'Glanzmann Thrombasthenia Type I', category: 'health' },
  'Glanzmann Thrombasthenia Type II': { locus: 'ITGB3', locusName: 'Glanzmann Thrombasthenia Type II', category: 'health' },
  'ITGB3': { locus: 'ITGB3', locusName: 'Glanzmann Thrombasthenia Type II', category: 'health' },

  // P2Y12 Receptor Platelet Disorder
  'P2Y12 Receptor Platelet Disorder': { locus: 'P2RY12', locusName: 'P2Y12 Receptor Platelet Disorder', category: 'health' },
  'P2RY12': { locus: 'P2RY12', locusName: 'P2Y12 Receptor Platelet Disorder', category: 'health' },

  // Thrombopathia
  'Thrombopathia': { locus: 'RASGRP2', locusName: 'Thrombopathia', category: 'health' },
  'RASGRP2': { locus: 'RASGRP2', locusName: 'Thrombopathia', category: 'health' },

  // May-Hegglin Anomaly
  'May-Hegglin Anomaly': { locus: 'MYH9', locusName: 'May-Hegglin Anomaly', category: 'health' },
  'MYH9': { locus: 'MYH9', locusName: 'May-Hegglin Anomaly', category: 'health' },

  // Hemolytic Anemia
  'Congenital Hemolytic Anemia': { locus: 'SLC4A1', locusName: 'Congenital Hemolytic Anemia', category: 'health' },
  'SLC4A1': { locus: 'SLC4A1', locusName: 'Congenital Hemolytic Anemia', category: 'health' },

  // Methemoglobinemia
  'Methemoglobinemia': { locus: 'CYB5R3', locusName: 'Methemoglobinemia', category: 'health' },
  'CYB5R3': { locus: 'CYB5R3', locusName: 'Methemoglobinemia', category: 'health' },

  // Severe Combined Immunodeficiency
  'Severe Combined Immunodeficiency': { locus: 'PRKDC', locusName: 'Severe Combined Immunodeficiency', category: 'health' },
  'SCID': { locus: 'PRKDC', locusName: 'Severe Combined Immunodeficiency', category: 'health' },
  'PRKDC': { locus: 'PRKDC', locusName: 'Severe Combined Immunodeficiency', category: 'health' },
  'X-Linked Severe Combined Immunodeficiency': { locus: 'IL2RG', locusName: 'X-Linked Severe Combined Immunodeficiency', category: 'health' },
  'X-SCID': { locus: 'IL2RG', locusName: 'X-Linked Severe Combined Immunodeficiency', category: 'health' },
  'IL2RG': { locus: 'IL2RG', locusName: 'X-Linked Severe Combined Immunodeficiency', category: 'health' },

  // Complement 3 Deficiency
  'Complement 3 Deficiency': { locus: 'C3', locusName: 'Complement 3 Deficiency', category: 'health' },
  'C3': { locus: 'C3', locusName: 'Complement 3 Deficiency', category: 'health' },

  // ============================================================================
  // HEALTH CONDITIONS - EYE CONDITIONS (38+)
  // ============================================================================

  // Progressive Retinal Atrophy - Multiple Variants
  'Progressive Retinal Atrophy': { locus: 'PRA', locusName: 'Progressive Retinal Atrophy', category: 'health' },
  'PRA': { locus: 'PRA', locusName: 'Progressive Retinal Atrophy', category: 'health' },

  'Progressive Retinal Atrophy, prcd': { locus: 'PRCD', locusName: 'Progressive Retinal Atrophy (prcd)', category: 'health' },
  'PRA-prcd': { locus: 'PRCD', locusName: 'Progressive Retinal Atrophy (prcd)', category: 'health' },
  'prcd-PRA': { locus: 'PRCD', locusName: 'Progressive Retinal Atrophy (prcd)', category: 'health' },
  'PRCD': { locus: 'PRCD', locusName: 'Progressive Retinal Atrophy (prcd)', category: 'health' },

  'Progressive Retinal Atrophy, rcd1': { locus: 'PDE6B-RCD1', locusName: 'Progressive Retinal Atrophy (rcd1)', category: 'health' },
  'PRA-rcd1': { locus: 'PDE6B-RCD1', locusName: 'Progressive Retinal Atrophy (rcd1)', category: 'health' },
  'rcd1': { locus: 'PDE6B-RCD1', locusName: 'Progressive Retinal Atrophy (rcd1)', category: 'health' },

  'Progressive Retinal Atrophy, rcd1a': { locus: 'PDE6B-RCD1A', locusName: 'Progressive Retinal Atrophy (rcd1a)', category: 'health' },
  'PRA-rcd1a': { locus: 'PDE6B-RCD1A', locusName: 'Progressive Retinal Atrophy (rcd1a)', category: 'health' },
  'rcd1a': { locus: 'PDE6B-RCD1A', locusName: 'Progressive Retinal Atrophy (rcd1a)', category: 'health' },

  'Progressive Retinal Atrophy, rcd2': { locus: 'RD3', locusName: 'Progressive Retinal Atrophy (rcd2)', category: 'health' },
  'PRA-rcd2': { locus: 'RD3', locusName: 'Progressive Retinal Atrophy (rcd2)', category: 'health' },
  'rcd2': { locus: 'RD3', locusName: 'Progressive Retinal Atrophy (rcd2)', category: 'health' },

  'Progressive Retinal Atrophy, rcd3': { locus: 'PDE6A', locusName: 'Progressive Retinal Atrophy (rcd3)', category: 'health' },
  'PRA-rcd3': { locus: 'PDE6A', locusName: 'Progressive Retinal Atrophy (rcd3)', category: 'health' },
  'rcd3': { locus: 'PDE6A', locusName: 'Progressive Retinal Atrophy (rcd3)', category: 'health' },
  'PDE6A': { locus: 'PDE6A', locusName: 'Progressive Retinal Atrophy (rcd3)', category: 'health' },

  'Progressive Retinal Atrophy, rcd4': { locus: 'C2orf71', locusName: 'Progressive Retinal Atrophy (rcd4)', category: 'health' },
  'PRA-rcd4': { locus: 'C2orf71', locusName: 'Progressive Retinal Atrophy (rcd4)', category: 'health' },
  'rcd4': { locus: 'C2orf71', locusName: 'Progressive Retinal Atrophy (rcd4)', category: 'health' },
  'C2orf71': { locus: 'C2orf71', locusName: 'Progressive Retinal Atrophy (rcd4)', category: 'health' },

  'Progressive Retinal Atrophy, crd1': { locus: 'PDE6B-CRD1', locusName: 'Progressive Retinal Atrophy (crd1)', category: 'health' },
  'PRA-crd1': { locus: 'PDE6B-CRD1', locusName: 'Progressive Retinal Atrophy (crd1)', category: 'health' },
  'crd1': { locus: 'PDE6B-CRD1', locusName: 'Progressive Retinal Atrophy (crd1)', category: 'health' },

  'Progressive Retinal Atrophy, crd2': { locus: 'IQCB1', locusName: 'Progressive Retinal Atrophy (crd2)', category: 'health' },
  'PRA-crd2': { locus: 'IQCB1', locusName: 'Progressive Retinal Atrophy (crd2)', category: 'health' },
  'crd2': { locus: 'IQCB1', locusName: 'Progressive Retinal Atrophy (crd2)', category: 'health' },
  'IQCB1': { locus: 'IQCB1', locusName: 'Progressive Retinal Atrophy (crd2)', category: 'health' },

  'Progressive Retinal Atrophy, crd4/cord1': { locus: 'RPGRIP1', locusName: 'Progressive Retinal Atrophy (crd4/cord1)', category: 'health' },
  'PRA-cord1': { locus: 'RPGRIP1', locusName: 'Progressive Retinal Atrophy (crd4/cord1)', category: 'health' },
  'cord1': { locus: 'RPGRIP1', locusName: 'Progressive Retinal Atrophy (crd4/cord1)', category: 'health' },
  'crd4': { locus: 'RPGRIP1', locusName: 'Progressive Retinal Atrophy (crd4/cord1)', category: 'health' },
  'RPGRIP1': { locus: 'RPGRIP1', locusName: 'Progressive Retinal Atrophy (crd4/cord1)', category: 'health' },

  'Progressive Retinal Atrophy, GR-PRA1': { locus: 'SLC4A3', locusName: 'Progressive Retinal Atrophy (GR-PRA1)', category: 'health' },
  'GR-PRA1': { locus: 'SLC4A3', locusName: 'Progressive Retinal Atrophy (GR-PRA1)', category: 'health' },
  'SLC4A3': { locus: 'SLC4A3', locusName: 'Progressive Retinal Atrophy (GR-PRA1)', category: 'health' },

  'Progressive Retinal Atrophy, GR-PRA2': { locus: 'TTC8', locusName: 'Progressive Retinal Atrophy (GR-PRA2)', category: 'health' },
  'GR-PRA2': { locus: 'TTC8', locusName: 'Progressive Retinal Atrophy (GR-PRA2)', category: 'health' },
  'TTC8': { locus: 'TTC8', locusName: 'Progressive Retinal Atrophy (GR-PRA2)', category: 'health' },

  'Progressive Retinal Atrophy, Type A': { locus: 'CNGA1', locusName: 'Progressive Retinal Atrophy (Type A)', category: 'health' },
  'PRA Type A': { locus: 'CNGA1', locusName: 'Progressive Retinal Atrophy (Type A)', category: 'health' },
  'CNGA1': { locus: 'CNGA1', locusName: 'Progressive Retinal Atrophy (Type A)', category: 'health' },

  'Progressive Retinal Atrophy, Type B': { locus: 'CNGB1', locusName: 'Progressive Retinal Atrophy (Type B)', category: 'health' },
  'PRA Type B': { locus: 'CNGB1', locusName: 'Progressive Retinal Atrophy (Type B)', category: 'health' },
  'CNGB1': { locus: 'CNGB1', locusName: 'Progressive Retinal Atrophy (Type B)', category: 'health' },

  'Progressive Retinal Atrophy (Papillon Type)': { locus: 'CNGB1-PAP', locusName: 'Progressive Retinal Atrophy (Papillon)', category: 'health' },
  'Papillon PRA': { locus: 'CNGB1-PAP', locusName: 'Progressive Retinal Atrophy (Papillon)', category: 'health' },

  'Progressive Retinal Atrophy (Basenji Type)': { locus: 'SAG', locusName: 'Progressive Retinal Atrophy (Basenji)', category: 'health' },
  'SAG': { locus: 'SAG', locusName: 'Progressive Retinal Atrophy (Basenji)', category: 'health' },

  'Progressive Retinal Atrophy (Lhasa Apso Type)': { locus: 'IMPG2', locusName: 'Progressive Retinal Atrophy (Lhasa Apso)', category: 'health' },
  'IMPG2': { locus: 'IMPG2', locusName: 'Progressive Retinal Atrophy (Lhasa Apso)', category: 'health' },

  'Progressive Retinal Atrophy, PDE6B': { locus: 'PDE6B', locusName: 'Progressive Retinal Atrophy (PDE6B)', category: 'health' },
  'PDE6B': { locus: 'PDE6B', locusName: 'Progressive Retinal Atrophy (PDE6B)', category: 'health' },

  'X-Linked Progressive Retinal Atrophy 1': { locus: 'RPGR', locusName: 'X-Linked Progressive Retinal Atrophy 1', category: 'health' },
  'XLPRA1': { locus: 'RPGR', locusName: 'X-Linked Progressive Retinal Atrophy 1', category: 'health' },
  'RPGR': { locus: 'RPGR', locusName: 'X-Linked Progressive Retinal Atrophy 1', category: 'health' },

  'X-Linked Progressive Retinal Atrophy 2': { locus: 'RPGR-2', locusName: 'X-Linked Progressive Retinal Atrophy 2', category: 'health' },
  'XLPRA2': { locus: 'RPGR-2', locusName: 'X-Linked Progressive Retinal Atrophy 2', category: 'health' },

  // Collie Eye Anomaly
  'Collie Eye Anomaly': { locus: 'NHEJ1', locusName: 'Collie Eye Anomaly', category: 'health' },
  'CEA': { locus: 'NHEJ1', locusName: 'Collie Eye Anomaly', category: 'health' },
  'Choroidal Hypoplasia': { locus: 'NHEJ1', locusName: 'Collie Eye Anomaly', category: 'health' },
  'NHEJ1': { locus: 'NHEJ1', locusName: 'Collie Eye Anomaly', category: 'health' },

  // Hereditary Cataracts
  'Hereditary Cataracts': { locus: 'HSF4', locusName: 'Hereditary Cataracts', category: 'health' },
  'HSF4': { locus: 'HSF4', locusName: 'Hereditary Cataracts', category: 'health' },
  'Hereditary Cataracts (Australian Shepherd Type)': { locus: 'HSF4-AS', locusName: 'Hereditary Cataracts (Australian Shepherd)', category: 'health' },
  'Hereditary Cataracts (French Bulldog Type)': { locus: 'HSF4-FB', locusName: 'Hereditary Cataracts (French Bulldog)', category: 'health' },
  'Early-Onset Hereditary Cataracts': { locus: 'HSF4-EO', locusName: 'Early-Onset Hereditary Cataracts', category: 'health' },

  // Primary Lens Luxation
  'Primary Lens Luxation': { locus: 'ADAMTS17', locusName: 'Primary Lens Luxation', category: 'health' },
  'PLL': { locus: 'ADAMTS17', locusName: 'Primary Lens Luxation', category: 'health' },
  'ADAMTS17': { locus: 'ADAMTS17', locusName: 'Primary Lens Luxation', category: 'health' },

  // Canine Multifocal Retinopathy
  'Canine Multifocal Retinopathy 1': { locus: 'BEST1-CMR1', locusName: 'Canine Multifocal Retinopathy 1', category: 'health' },
  'CMR1': { locus: 'BEST1-CMR1', locusName: 'Canine Multifocal Retinopathy 1', category: 'health' },
  'Canine Multifocal Retinopathy 2': { locus: 'BEST1-CMR2', locusName: 'Canine Multifocal Retinopathy 2', category: 'health' },
  'CMR2': { locus: 'BEST1-CMR2', locusName: 'Canine Multifocal Retinopathy 2', category: 'health' },
  'Canine Multifocal Retinopathy 3': { locus: 'BEST1-CMR3', locusName: 'Canine Multifocal Retinopathy 3', category: 'health' },
  'CMR3': { locus: 'BEST1-CMR3', locusName: 'Canine Multifocal Retinopathy 3', category: 'health' },
  'BEST1': { locus: 'BEST1', locusName: 'Canine Multifocal Retinopathy', category: 'health' },

  // Primary Open-Angle Glaucoma
  'Primary Open Angle Glaucoma': { locus: 'ADAMTS10', locusName: 'Primary Open-Angle Glaucoma', category: 'health' },
  'POAG': { locus: 'ADAMTS10', locusName: 'Primary Open-Angle Glaucoma', category: 'health' },
  'ADAMTS10': { locus: 'ADAMTS10', locusName: 'Primary Open-Angle Glaucoma', category: 'health' },
  'Glaucoma': { locus: 'ADAMTS10', locusName: 'Primary Open-Angle Glaucoma', category: 'health' },
  'Goniodysgenesis and Glaucoma': { locus: 'OLFML3', locusName: 'Goniodysgenesis and Glaucoma', category: 'health' },
  'OLFML3': { locus: 'OLFML3', locusName: 'Goniodysgenesis and Glaucoma', category: 'health' },

  // Achromatopsia
  'Achromatopsia': { locus: 'CNGB3', locusName: 'Achromatopsia (Day Blindness)', category: 'health' },
  'Day Blindness': { locus: 'CNGB3', locusName: 'Achromatopsia (Day Blindness)', category: 'health' },
  'CNGB3': { locus: 'CNGB3', locusName: 'Achromatopsia (Day Blindness)', category: 'health' },
  'Cone Degeneration': { locus: 'CNGA3', locusName: 'Cone Degeneration', category: 'health' },
  'CNGA3': { locus: 'CNGA3', locusName: 'Cone Degeneration', category: 'health' },

  // Congenital Stationary Night Blindness
  'Congenital Stationary Night Blindness': { locus: 'RPE65', locusName: 'Congenital Stationary Night Blindness', category: 'health' },
  'CSNB': { locus: 'RPE65', locusName: 'Congenital Stationary Night Blindness', category: 'health' },
  'RPE65': { locus: 'RPE65', locusName: 'Congenital Stationary Night Blindness', category: 'health' },

  // Microphthalmia
  'Microphthalmia': { locus: 'RBP4', locusName: 'Microphthalmia', category: 'health' },
  'RBP4': { locus: 'RBP4', locusName: 'Microphthalmia', category: 'health' },

  // Oculoskeletal Dysplasia
  'Oculoskeletal Dysplasia 1': { locus: 'COL9A3', locusName: 'Oculoskeletal Dysplasia 1', category: 'health' },
  'OSD1': { locus: 'COL9A3', locusName: 'Oculoskeletal Dysplasia 1', category: 'health' },
  'COL9A3': { locus: 'COL9A3', locusName: 'Oculoskeletal Dysplasia 1', category: 'health' },
  'Oculoskeletal Dysplasia 2': { locus: 'COL9A2', locusName: 'Oculoskeletal Dysplasia 2', category: 'health' },
  'OSD2': { locus: 'COL9A2', locusName: 'Oculoskeletal Dysplasia 2', category: 'health' },
  'COL9A2': { locus: 'COL9A2', locusName: 'Oculoskeletal Dysplasia 2', category: 'health' },

  // Persistent Pupillary Membrane
  'Persistent Pupillary Membrane': { locus: 'PPM', locusName: 'Persistent Pupillary Membrane', category: 'health' },

  // ============================================================================
  // HEALTH CONDITIONS - BRAIN AND SPINAL CORD (36+)
  // ============================================================================

  // Degenerative Myelopathy
  'Degenerative Myelopathy': { locus: 'SOD1', locusName: 'Degenerative Myelopathy', category: 'health' },
  'DM': { locus: 'SOD1', locusName: 'Degenerative Myelopathy', category: 'health' },
  'SOD1': { locus: 'SOD1', locusName: 'Degenerative Myelopathy', category: 'health' },
  'Degenerative Myelopathy (SOD1A)': { locus: 'SOD1-A', locusName: 'Degenerative Myelopathy (SOD1A)', category: 'health' },
  'SOD1A': { locus: 'SOD1-A', locusName: 'Degenerative Myelopathy (SOD1A)', category: 'health' },
  'Degenerative Myelopathy (SOD1B)': { locus: 'SOD1-B', locusName: 'Degenerative Myelopathy (SOD1B)', category: 'health' },
  'SOD1B': { locus: 'SOD1-B', locusName: 'Degenerative Myelopathy (SOD1B)', category: 'health' },

  // Exercise-Induced Collapse
  'Exercise-Induced Collapse': { locus: 'DNM1', locusName: 'Exercise-Induced Collapse', category: 'health' },
  'EIC': { locus: 'DNM1', locusName: 'Exercise-Induced Collapse', category: 'health' },
  'DNM1': { locus: 'DNM1', locusName: 'Exercise-Induced Collapse', category: 'health' },

  // Cerebellar Ataxias
  'Cerebellar Ataxia': { locus: 'CA', locusName: 'Cerebellar Ataxia', category: 'health' },
  'Neonatal Cerebellar Cortical Degeneration': { locus: 'SPTBN2', locusName: 'Neonatal Cerebellar Cortical Degeneration', category: 'health' },
  'NCCD': { locus: 'SPTBN2', locusName: 'Neonatal Cerebellar Cortical Degeneration', category: 'health' },
  'SPTBN2': { locus: 'SPTBN2', locusName: 'Neonatal Cerebellar Cortical Degeneration', category: 'health' },
  'Spinocerebellar Ataxia': { locus: 'CAPN1', locusName: 'Spinocerebellar Ataxia', category: 'health' },
  'CAPN1': { locus: 'CAPN1', locusName: 'Spinocerebellar Ataxia', category: 'health' },
  'Late-Onset Ataxia': { locus: 'CAPN1', locusName: 'Late-Onset Ataxia', category: 'health' },
  'Cerebellar Ataxia (Italian Spinone Type)': { locus: 'ITPR1', locusName: 'Cerebellar Ataxia (Italian Spinone)', category: 'health' },
  'ITPR1': { locus: 'ITPR1', locusName: 'Cerebellar Ataxia (Italian Spinone)', category: 'health' },
  'Cerebellar Ataxia (Finnish Hound Type)': { locus: 'SEL1L', locusName: 'Cerebellar Ataxia (Finnish Hound)', category: 'health' },
  'SEL1L': { locus: 'SEL1L', locusName: 'Cerebellar Ataxia (Finnish Hound)', category: 'health' },
  'Cerebellar Abiotrophy': { locus: 'SNIP1', locusName: 'Cerebellar Abiotrophy', category: 'health' },
  'SNIP1': { locus: 'SNIP1', locusName: 'Cerebellar Abiotrophy', category: 'health' },
  'Hereditary Ataxia': { locus: 'RAB24', locusName: 'Hereditary Ataxia', category: 'health' },
  'RAB24': { locus: 'RAB24', locusName: 'Hereditary Ataxia', category: 'health' },
  'Progressive Early-Onset Cerebellar Ataxia': { locus: 'SEL1L', locusName: 'Progressive Early-Onset Cerebellar Ataxia', category: 'health' },

  // Narcolepsy
  'Narcolepsy': { locus: 'HCRTR2', locusName: 'Narcolepsy', category: 'health' },
  'HCRTR2': { locus: 'HCRTR2', locusName: 'Narcolepsy', category: 'health' },

  // Epilepsies
  'Benign Familial Juvenile Epilepsy': { locus: 'LGI2', locusName: 'Benign Familial Juvenile Epilepsy', category: 'health' },
  'BFJE': { locus: 'LGI2', locusName: 'Benign Familial Juvenile Epilepsy', category: 'health' },
  'LGI2': { locus: 'LGI2', locusName: 'Benign Familial Juvenile Epilepsy', category: 'health' },
  'Lafora Disease': { locus: 'EPM2B', locusName: 'Lafora Disease', category: 'health' },
  'Progressive Myoclonic Epilepsy': { locus: 'EPM2B', locusName: 'Lafora Disease', category: 'health' },
  'EPM2B': { locus: 'EPM2B', locusName: 'Lafora Disease', category: 'health' },
  'NHLRC1': { locus: 'EPM2B', locusName: 'Lafora Disease', category: 'health' },
  'Juvenile Myoclonic Epilepsy': { locus: 'DIRAS1', locusName: 'Juvenile Myoclonic Epilepsy', category: 'health' },
  'DIRAS1': { locus: 'DIRAS1', locusName: 'Juvenile Myoclonic Epilepsy', category: 'health' },

  // Alexander Disease
  'Alexander Disease': { locus: 'GFAP', locusName: 'Alexander Disease', category: 'health' },
  'GFAP': { locus: 'GFAP', locusName: 'Alexander Disease', category: 'health' },

  // Canine Multiple System Degeneration
  'Canine Multiple System Degeneration': { locus: 'SERAC1', locusName: 'Canine Multiple System Degeneration', category: 'health' },
  'CMSD': { locus: 'SERAC1', locusName: 'Canine Multiple System Degeneration', category: 'health' },
  'SERAC1': { locus: 'SERAC1', locusName: 'Canine Multiple System Degeneration', category: 'health' },

  // Spongy Degeneration with Cerebellar Ataxia
  'Spongy Degeneration with Cerebellar Ataxia': { locus: 'KCNJ10', locusName: 'Spongy Degeneration with Cerebellar Ataxia', category: 'health' },
  'SeSAME': { locus: 'KCNJ10', locusName: 'Spongy Degeneration with Cerebellar Ataxia', category: 'health' },
  'KCNJ10': { locus: 'KCNJ10', locusName: 'Spongy Degeneration with Cerebellar Ataxia', category: 'health' },

  // L-2-Hydroxyglutaric Aciduria
  'L-2-Hydroxyglutaric Aciduria': { locus: 'L2HGDH', locusName: 'L-2-Hydroxyglutaric Aciduria', category: 'health' },
  'L2HGA': { locus: 'L2HGDH', locusName: 'L-2-Hydroxyglutaric Aciduria', category: 'health' },
  'L2HGDH': { locus: 'L2HGDH', locusName: 'L-2-Hydroxyglutaric Aciduria', category: 'health' },

  // Globoid Cell Leukodystrophy
  'Globoid Cell Leukodystrophy': { locus: 'GALC', locusName: 'Globoid Cell Leukodystrophy (Krabbe Disease)', category: 'health' },
  'Krabbe Disease': { locus: 'GALC', locusName: 'Globoid Cell Leukodystrophy (Krabbe Disease)', category: 'health' },
  'GALC': { locus: 'GALC', locusName: 'Globoid Cell Leukodystrophy (Krabbe Disease)', category: 'health' },

  // Canine Neuroaxonal Dystrophy
  'Neuroaxonal Dystrophy': { locus: 'PLA2G6', locusName: 'Neuroaxonal Dystrophy', category: 'health' },
  'NAD': { locus: 'PLA2G6', locusName: 'Neuroaxonal Dystrophy', category: 'health' },
  'PLA2G6': { locus: 'PLA2G6', locusName: 'Neuroaxonal Dystrophy', category: 'health' },
  'Neuroaxonal Dystrophy (Spanish Water Dog Type)': { locus: 'TECPR2', locusName: 'Neuroaxonal Dystrophy (Spanish Water Dog)', category: 'health' },
  'TECPR2': { locus: 'TECPR2', locusName: 'Neuroaxonal Dystrophy (Spanish Water Dog)', category: 'health' },

  // Sensory Neuropathies
  'Sensory Ataxic Neuropathy': { locus: 'tRNA-Tyr', locusName: 'Sensory Ataxic Neuropathy', category: 'health' },
  'SAN': { locus: 'tRNA-Tyr', locusName: 'Sensory Ataxic Neuropathy', category: 'health' },
  'Sensory Neuropathy': { locus: 'FAM134B', locusName: 'Sensory Neuropathy', category: 'health' },
  'FAM134B': { locus: 'FAM134B', locusName: 'Sensory Neuropathy', category: 'health' },
  'Polyneuropathy': { locus: 'NDRG1', locusName: 'Polyneuropathy', category: 'health' },
  'NDRG1': { locus: 'NDRG1', locusName: 'Polyneuropathy', category: 'health' },

  // Hypomyelination
  'Hypomyelination': { locus: 'FNIP2', locusName: 'Hypomyelination', category: 'health' },
  'FNIP2': { locus: 'FNIP2', locusName: 'Hypomyelination', category: 'health' },

  // Spongiform Leukoencephalomyelopathy
  'Spongiform Leukoencephalomyelopathy': { locus: 'CYTB', locusName: 'Spongiform Leukoencephalomyelopathy', category: 'health' },
  'CYTB': { locus: 'CYTB', locusName: 'Spongiform Leukoencephalomyelopathy', category: 'health' },

  // Shaking Puppy Syndrome
  'Shaking Puppy Syndrome': { locus: 'PLP1', locusName: 'Shaking Puppy Syndrome', category: 'health' },
  'PLP1': { locus: 'PLP1', locusName: 'Shaking Puppy Syndrome', category: 'health' },

  // Paroxysmal Dyskinesia
  'Paroxysmal Dyskinesia': { locus: 'PIGN', locusName: 'Paroxysmal Dyskinesia', category: 'health' },
  'PIGN': { locus: 'PIGN', locusName: 'Paroxysmal Dyskinesia', category: 'health' },

  // Bandera Neonatal Ataxia
  'Bandera Neonatal Ataxia': { locus: 'GRM1', locusName: 'Bandera Neonatal Ataxia', category: 'health' },
  'BNAt': { locus: 'GRM1', locusName: 'Bandera Neonatal Ataxia', category: 'health' },
  'GRM1': { locus: 'GRM1', locusName: 'Bandera Neonatal Ataxia', category: 'health' },

  // Intervertebral Disc Disease
  'IVDD': { locus: 'FGF4-IVDD', locusName: 'Intervertebral Disc Disease', category: 'health' },
  'Intervertebral Disc Disease': { locus: 'FGF4-IVDD', locusName: 'Intervertebral Disc Disease', category: 'health' },
  'Chondrodystrophy (CDDY)': { locus: 'FGF4-CDDY', locusName: 'Chondrodystrophy with IVDD Risk', category: 'health' },
  'CDDY': { locus: 'FGF4-CDDY', locusName: 'Chondrodystrophy with IVDD Risk', category: 'health' },
  'Chondrodysplasia (CDPA)': { locus: 'FGF4-CDPA', locusName: 'Chondrodysplasia', category: 'health' },
  'CDPA': { locus: 'FGF4-CDPA', locusName: 'Chondrodysplasia', category: 'health' },

  // ============================================================================
  // HEALTH CONDITIONS - KIDNEY AND BLADDER (14+)
  // ============================================================================

  // Hyperuricosuria
  'Hyperuricosuria': { locus: 'SLC2A9', locusName: 'Hyperuricosuria', category: 'health' },
  'HUU': { locus: 'SLC2A9', locusName: 'Hyperuricosuria', category: 'health' },
  'SLC2A9': { locus: 'SLC2A9', locusName: 'Hyperuricosuria', category: 'health' },

  // Cystinuria
  'Cystinuria Type I-A': { locus: 'SLC3A1', locusName: 'Cystinuria Type I-A', category: 'health' },
  'Cystinuria': { locus: 'SLC3A1', locusName: 'Cystinuria', category: 'health' },
  'SLC3A1': { locus: 'SLC3A1', locusName: 'Cystinuria Type I-A', category: 'health' },
  'Cystinuria Type II-A': { locus: 'SLC7A9', locusName: 'Cystinuria Type II-A', category: 'health' },
  'SLC7A9': { locus: 'SLC7A9', locusName: 'Cystinuria Type II-A', category: 'health' },
  'Cystinuria Type II-B': { locus: 'SLC7A9-2B', locusName: 'Cystinuria Type II-B', category: 'health' },

  // Fanconi Syndrome
  'Fanconi Syndrome': { locus: 'FAN1', locusName: 'Fanconi Syndrome', category: 'health' },
  'FAN1': { locus: 'FAN1', locusName: 'Fanconi Syndrome', category: 'health' },

  // Polycystic Kidney Disease
  'Polycystic Kidney Disease': { locus: 'PKD1', locusName: 'Polycystic Kidney Disease', category: 'health' },
  // Note: 'PKD' abbreviation conflicts with Pyruvate Kinase Deficiency (PKLR), using gene name instead
  'PKD1': { locus: 'PKD1', locusName: 'Polycystic Kidney Disease', category: 'health' },

  // Hereditary Nephritis
  'Hereditary Nephritis (X-Linked)': { locus: 'COL4A5', locusName: 'X-Linked Hereditary Nephritis', category: 'health' },
  'X-Linked Hereditary Nephritis': { locus: 'COL4A5', locusName: 'X-Linked Hereditary Nephritis', category: 'health' },
  'COL4A5': { locus: 'COL4A5', locusName: 'X-Linked Hereditary Nephritis', category: 'health' },
  'Autosomal Hereditary Nephritis': { locus: 'COL4A4', locusName: 'Autosomal Hereditary Nephritis', category: 'health' },
  'COL4A4': { locus: 'COL4A4', locusName: 'Autosomal Hereditary Nephritis', category: 'health' },
  'Alport Syndrome': { locus: 'COL4A5', locusName: 'X-Linked Hereditary Nephritis', category: 'health' },

  // Protein Losing Nephropathy
  'Protein Losing Nephropathy': { locus: 'NPHS1', locusName: 'Protein Losing Nephropathy', category: 'health' },
  'PLN': { locus: 'NPHS1', locusName: 'Protein Losing Nephropathy', category: 'health' },
  'NPHS1': { locus: 'NPHS1', locusName: 'Protein Losing Nephropathy', category: 'health' },

  // Primary Hyperoxaluria
  'Primary Hyperoxaluria': { locus: 'AGXT', locusName: 'Primary Hyperoxaluria', category: 'health' },
  'AGXT': { locus: 'AGXT', locusName: 'Primary Hyperoxaluria', category: 'health' },

  // Xanthinuria
  'Xanthinuria': { locus: 'XDH', locusName: 'Xanthinuria', category: 'health' },
  'XDH': { locus: 'XDH', locusName: 'Xanthinuria', category: 'health' },

  // ============================================================================
  // HEALTH CONDITIONS - HEART (5+)
  // ============================================================================

  // Dilated Cardiomyopathy
  'Dilated Cardiomyopathy 1 (DCM1)': { locus: 'PDK4', locusName: 'Dilated Cardiomyopathy (DCM1)', category: 'health' },
  'DCM1': { locus: 'PDK4', locusName: 'Dilated Cardiomyopathy (DCM1)', category: 'health' },
  'PDK4': { locus: 'PDK4', locusName: 'Dilated Cardiomyopathy (DCM1)', category: 'health' },
  'Dilated Cardiomyopathy 2 (DCM2)': { locus: 'TTN', locusName: 'Dilated Cardiomyopathy (DCM2)', category: 'health' },
  'DCM2': { locus: 'TTN', locusName: 'Dilated Cardiomyopathy (DCM2)', category: 'health' },
  'TTN': { locus: 'TTN', locusName: 'Dilated Cardiomyopathy (DCM2)', category: 'health' },
  'Dilated Cardiomyopathy': { locus: 'DCM', locusName: 'Dilated Cardiomyopathy', category: 'health' },
  'DCM': { locus: 'DCM', locusName: 'Dilated Cardiomyopathy', category: 'health' },
  'Dilated Cardiomyopathy (RBM20)': { locus: 'RBM20', locusName: 'Dilated Cardiomyopathy (RBM20)', category: 'health' },
  'RBM20': { locus: 'RBM20', locusName: 'Dilated Cardiomyopathy (RBM20)', category: 'health' },

  // Arrhythmogenic Right Ventricular Cardiomyopathy
  'Arrhythmogenic Right Ventricular Cardiomyopathy': { locus: 'STRN', locusName: 'Arrhythmogenic Right Ventricular Cardiomyopathy', category: 'health' },
  'ARVC': { locus: 'STRN', locusName: 'Arrhythmogenic Right Ventricular Cardiomyopathy', category: 'health' },
  'STRN': { locus: 'STRN', locusName: 'Arrhythmogenic Right Ventricular Cardiomyopathy', category: 'health' },

  // Myxomatous Mitral Valve Disease
  'Myxomatous Mitral Valve Disease': { locus: 'MMVD', locusName: 'Myxomatous Mitral Valve Disease', category: 'health' },
  'MMVD': { locus: 'MMVD', locusName: 'Myxomatous Mitral Valve Disease', category: 'health' },

  // ============================================================================
  // HEALTH CONDITIONS - MUSCULAR (17+)
  // ============================================================================

  // Muscular Dystrophy
  'Muscular Dystrophy (Duchenne Type)': { locus: 'DMD', locusName: 'Muscular Dystrophy (Duchenne Type)', category: 'health' },
  'DMD': { locus: 'DMD', locusName: 'Muscular Dystrophy (Duchenne Type)', category: 'health' },
  'X-Linked Muscular Dystrophy': { locus: 'DMD', locusName: 'Muscular Dystrophy (Duchenne Type)', category: 'health' },
  'XLMD': { locus: 'DMD', locusName: 'Muscular Dystrophy (Duchenne Type)', category: 'health' },
  'Muscular Dystrophy (Golden Retriever Type)': { locus: 'DMD-GR', locusName: 'Muscular Dystrophy (Golden Retriever)', category: 'health' },
  'GRMD': { locus: 'DMD-GR', locusName: 'Muscular Dystrophy (Golden Retriever)', category: 'health' },
  'Muscular Dystrophy (Cavalier King Charles Spaniel Type)': { locus: 'DMD-CKCS', locusName: 'Muscular Dystrophy (Cavalier)', category: 'health' },

  // Centronuclear Myopathy
  'Centronuclear Myopathy': { locus: 'PTPLA', locusName: 'Centronuclear Myopathy', category: 'health' },
  'CNM': { locus: 'PTPLA', locusName: 'Centronuclear Myopathy', category: 'health' },
  'PTPLA': { locus: 'PTPLA', locusName: 'Centronuclear Myopathy', category: 'health' },
  'Centronuclear Myopathy (Great Dane Type)': { locus: 'BIN1', locusName: 'Centronuclear Myopathy (Great Dane)', category: 'health' },
  'BIN1': { locus: 'BIN1', locusName: 'Centronuclear Myopathy (Great Dane)', category: 'health' },

  // Myotonia Congenita
  'Myotonia Congenita': { locus: 'CLCN1', locusName: 'Myotonia Congenita', category: 'health' },
  'CLCN1': { locus: 'CLCN1', locusName: 'Myotonia Congenita', category: 'health' },

  // Myotubular Myopathy
  'Myotubular Myopathy 1': { locus: 'MTM1', locusName: 'Myotubular Myopathy 1', category: 'health' },
  'MTM1': { locus: 'MTM1', locusName: 'Myotubular Myopathy 1', category: 'health' },
  'X-Linked Myotubular Myopathy': { locus: 'MTM1', locusName: 'Myotubular Myopathy 1', category: 'health' },

  // Malignant Hyperthermia
  'Malignant Hyperthermia': { locus: 'RYR1', locusName: 'Malignant Hyperthermia', category: 'health' },
  'MH': { locus: 'RYR1', locusName: 'Malignant Hyperthermia', category: 'health' },
  'RYR1': { locus: 'RYR1', locusName: 'Malignant Hyperthermia', category: 'health' },

  // Limber Tail Syndrome
  'Limber Tail Syndrome': { locus: 'LIMBER', locusName: 'Limber Tail Syndrome', category: 'health' },

  // Episodic Falling
  'Episodic Falling': { locus: 'BCAN', locusName: 'Episodic Falling', category: 'health' },
  'EF': { locus: 'BCAN', locusName: 'Episodic Falling', category: 'health' },
  'BCAN': { locus: 'BCAN', locusName: 'Episodic Falling', category: 'health' },

  // Hereditary Myopathy
  'Hereditary Myopathy': { locus: 'HMYOP', locusName: 'Hereditary Myopathy', category: 'health' },
  'Myopathy': { locus: 'HMYOP', locusName: 'Hereditary Myopathy', category: 'health' },

  // Nemaline Myopathy
  'Nemaline Myopathy': { locus: 'NEB', locusName: 'Nemaline Myopathy', category: 'health' },
  'NEB': { locus: 'NEB', locusName: 'Nemaline Myopathy', category: 'health' },

  // Congenital Myasthenic Syndrome
  'Congenital Myasthenic Syndrome': { locus: 'CHRNE', locusName: 'Congenital Myasthenic Syndrome', category: 'health' },
  'CMS': { locus: 'CHRNE', locusName: 'Congenital Myasthenic Syndrome', category: 'health' },
  'CHRNE': { locus: 'CHRNE', locusName: 'Congenital Myasthenic Syndrome', category: 'health' },
  'Congenital Myasthenic Syndrome (COLQ)': { locus: 'COLQ', locusName: 'Congenital Myasthenic Syndrome (COLQ)', category: 'health' },
  'COLQ': { locus: 'COLQ', locusName: 'Congenital Myasthenic Syndrome (COLQ)', category: 'health' },
  'Congenital Myasthenic Syndrome (CHAT)': { locus: 'CHAT', locusName: 'Congenital Myasthenic Syndrome (CHAT)', category: 'health' },
  'CHAT': { locus: 'CHAT', locusName: 'Congenital Myasthenic Syndrome (CHAT)', category: 'health' },

  // ============================================================================
  // HEALTH CONDITIONS - MULTISYSTEM (38+)
  // ============================================================================

  // Glycogen Storage Diseases
  'Glycogen Storage Disease Type Ia': { locus: 'G6PC', locusName: 'Glycogen Storage Disease Type Ia', category: 'health' },
  'GSD Ia': { locus: 'G6PC', locusName: 'Glycogen Storage Disease Type Ia', category: 'health' },
  'G6PC': { locus: 'G6PC', locusName: 'Glycogen Storage Disease Type Ia', category: 'health' },
  'Glycogen Storage Disease Type II': { locus: 'GAA', locusName: 'Glycogen Storage Disease Type II (Pompe)', category: 'health' },
  'GSD II': { locus: 'GAA', locusName: 'Glycogen Storage Disease Type II (Pompe)', category: 'health' },
  'Pompe Disease': { locus: 'GAA', locusName: 'Glycogen Storage Disease Type II (Pompe)', category: 'health' },
  'GAA': { locus: 'GAA', locusName: 'Glycogen Storage Disease Type II (Pompe)', category: 'health' },
  'Glycogen Storage Disease Type IIIa': { locus: 'AGL', locusName: 'Glycogen Storage Disease Type IIIa', category: 'health' },
  'GSD IIIa': { locus: 'AGL', locusName: 'Glycogen Storage Disease Type IIIa', category: 'health' },
  'AGL': { locus: 'AGL', locusName: 'Glycogen Storage Disease Type IIIa', category: 'health' },
  'Glycogen Storage Disease Type VII': { locus: 'PFKM', locusName: 'Glycogen Storage Disease Type VII', category: 'health' },
  'GSD VII': { locus: 'PFKM', locusName: 'Glycogen Storage Disease Type VII', category: 'health' },

  // Neuronal Ceroid Lipofuscinosis (NCL) Variants
  'Neuronal Ceroid Lipofuscinosis': { locus: 'NCL', locusName: 'Neuronal Ceroid Lipofuscinosis', category: 'health' },
  'NCL': { locus: 'NCL', locusName: 'Neuronal Ceroid Lipofuscinosis', category: 'health' },
  'Neuronal Ceroid Lipofuscinosis 1': { locus: 'PPT1', locusName: 'Neuronal Ceroid Lipofuscinosis 1', category: 'health' },
  'NCL1': { locus: 'PPT1', locusName: 'Neuronal Ceroid Lipofuscinosis 1', category: 'health' },
  'PPT1': { locus: 'PPT1', locusName: 'Neuronal Ceroid Lipofuscinosis 1', category: 'health' },
  'Neuronal Ceroid Lipofuscinosis 2': { locus: 'TPP1', locusName: 'Neuronal Ceroid Lipofuscinosis 2', category: 'health' },
  'NCL2': { locus: 'TPP1', locusName: 'Neuronal Ceroid Lipofuscinosis 2', category: 'health' },
  'TPP1': { locus: 'TPP1', locusName: 'Neuronal Ceroid Lipofuscinosis 2', category: 'health' },
  'Neuronal Ceroid Lipofuscinosis 4A': { locus: 'ARSG', locusName: 'Neuronal Ceroid Lipofuscinosis 4A', category: 'health' },
  'NCL4A': { locus: 'ARSG', locusName: 'Neuronal Ceroid Lipofuscinosis 4A', category: 'health' },
  'ARSG': { locus: 'ARSG', locusName: 'Neuronal Ceroid Lipofuscinosis 4A', category: 'health' },
  'Neuronal Ceroid Lipofuscinosis 5': { locus: 'CLN5', locusName: 'Neuronal Ceroid Lipofuscinosis 5', category: 'health' },
  'NCL5': { locus: 'CLN5', locusName: 'Neuronal Ceroid Lipofuscinosis 5', category: 'health' },
  'CLN5': { locus: 'CLN5', locusName: 'Neuronal Ceroid Lipofuscinosis 5', category: 'health' },
  'Neuronal Ceroid Lipofuscinosis 6': { locus: 'CLN6', locusName: 'Neuronal Ceroid Lipofuscinosis 6', category: 'health' },
  'NCL6': { locus: 'CLN6', locusName: 'Neuronal Ceroid Lipofuscinosis 6', category: 'health' },
  'CLN6': { locus: 'CLN6', locusName: 'Neuronal Ceroid Lipofuscinosis 6', category: 'health' },
  'Neuronal Ceroid Lipofuscinosis 7': { locus: 'MFSD8', locusName: 'Neuronal Ceroid Lipofuscinosis 7', category: 'health' },
  'NCL7': { locus: 'MFSD8', locusName: 'Neuronal Ceroid Lipofuscinosis 7', category: 'health' },
  'MFSD8': { locus: 'MFSD8', locusName: 'Neuronal Ceroid Lipofuscinosis 7', category: 'health' },
  'Neuronal Ceroid Lipofuscinosis 8': { locus: 'CLN8', locusName: 'Neuronal Ceroid Lipofuscinosis 8', category: 'health' },
  'NCL8': { locus: 'CLN8', locusName: 'Neuronal Ceroid Lipofuscinosis 8', category: 'health' },
  'CLN8': { locus: 'CLN8', locusName: 'Neuronal Ceroid Lipofuscinosis 8', category: 'health' },
  'Neuronal Ceroid Lipofuscinosis 10': { locus: 'CTSD', locusName: 'Neuronal Ceroid Lipofuscinosis 10', category: 'health' },
  'NCL10': { locus: 'CTSD', locusName: 'Neuronal Ceroid Lipofuscinosis 10', category: 'health' },
  'CTSD': { locus: 'CTSD', locusName: 'Neuronal Ceroid Lipofuscinosis 10', category: 'health' },
  'Neuronal Ceroid Lipofuscinosis 12': { locus: 'ATP13A2', locusName: 'Neuronal Ceroid Lipofuscinosis 12', category: 'health' },
  'NCL12': { locus: 'ATP13A2', locusName: 'Neuronal Ceroid Lipofuscinosis 12', category: 'health' },
  'ATP13A2': { locus: 'ATP13A2', locusName: 'Neuronal Ceroid Lipofuscinosis 12', category: 'health' },

  // GM1 Gangliosidosis
  'GM1 Gangliosidosis': { locus: 'GLB1', locusName: 'GM1 Gangliosidosis', category: 'health' },
  'GLB1': { locus: 'GLB1', locusName: 'GM1 Gangliosidosis', category: 'health' },

  // GM2 Gangliosidosis
  'GM2 Gangliosidosis': { locus: 'HEXA', locusName: 'GM2 Gangliosidosis', category: 'health' },
  'HEXA': { locus: 'HEXA', locusName: 'GM2 Gangliosidosis', category: 'health' },
  'Tay-Sachs Disease': { locus: 'HEXA', locusName: 'GM2 Gangliosidosis', category: 'health' },
  'GM2 Gangliosidosis Type II': { locus: 'HEXB', locusName: 'GM2 Gangliosidosis Type II (Sandhoff)', category: 'health' },
  'Sandhoff Disease': { locus: 'HEXB', locusName: 'GM2 Gangliosidosis Type II (Sandhoff)', category: 'health' },
  'HEXB': { locus: 'HEXB', locusName: 'GM2 Gangliosidosis Type II (Sandhoff)', category: 'health' },

  // Mucopolysaccharidosis
  'Mucopolysaccharidosis I': { locus: 'IDUA', locusName: 'Mucopolysaccharidosis I', category: 'health' },
  'MPS I': { locus: 'IDUA', locusName: 'Mucopolysaccharidosis I', category: 'health' },
  'IDUA': { locus: 'IDUA', locusName: 'Mucopolysaccharidosis I', category: 'health' },
  'Mucopolysaccharidosis IIIA': { locus: 'SGSH', locusName: 'Mucopolysaccharidosis IIIA', category: 'health' },
  'MPS IIIA': { locus: 'SGSH', locusName: 'Mucopolysaccharidosis IIIA', category: 'health' },
  'SGSH': { locus: 'SGSH', locusName: 'Mucopolysaccharidosis IIIA', category: 'health' },
  'Mucopolysaccharidosis IIIB': { locus: 'NAGLU', locusName: 'Mucopolysaccharidosis IIIB', category: 'health' },
  'MPS IIIB': { locus: 'NAGLU', locusName: 'Mucopolysaccharidosis IIIB', category: 'health' },
  'NAGLU': { locus: 'NAGLU', locusName: 'Mucopolysaccharidosis IIIB', category: 'health' },
  'Mucopolysaccharidosis VI': { locus: 'ARSB', locusName: 'Mucopolysaccharidosis VI', category: 'health' },
  'MPS VI': { locus: 'ARSB', locusName: 'Mucopolysaccharidosis VI', category: 'health' },
  'ARSB': { locus: 'ARSB', locusName: 'Mucopolysaccharidosis VI', category: 'health' },
  'Mucopolysaccharidosis VII': { locus: 'GUSB', locusName: 'Mucopolysaccharidosis VII', category: 'health' },
  'MPS VII': { locus: 'GUSB', locusName: 'Mucopolysaccharidosis VII', category: 'health' },
  'GUSB': { locus: 'GUSB', locusName: 'Mucopolysaccharidosis VII', category: 'health' },

  // Fucosidosis
  'Fucosidosis': { locus: 'FUCA1', locusName: 'Fucosidosis', category: 'health' },
  'FUCA1': { locus: 'FUCA1', locusName: 'Fucosidosis', category: 'health' },

  // Degenerative Conditions
  'Hip Dysplasia': { locus: 'HD', locusName: 'Hip Dysplasia', category: 'health' },
  'Elbow Dysplasia': { locus: 'ED', locusName: 'Elbow Dysplasia', category: 'health' },

  // Osteochondrodysplasia
  'Osteochondrodysplasia': { locus: 'TRPV4', locusName: 'Osteochondrodysplasia', category: 'health' },
  'TRPV4': { locus: 'TRPV4', locusName: 'Osteochondrodysplasia', category: 'health' },
  'Skeletal Dysplasia 2': { locus: 'COL11A2', locusName: 'Skeletal Dysplasia 2', category: 'health' },
  'SD2': { locus: 'COL11A2', locusName: 'Skeletal Dysplasia 2', category: 'health' },
  'COL11A2': { locus: 'COL11A2', locusName: 'Skeletal Dysplasia 2', category: 'health' },

  // Osteogenesis Imperfecta
  'Osteogenesis Imperfecta': { locus: 'COL1A1', locusName: 'Osteogenesis Imperfecta', category: 'health' },
  'Brittle Bone Disease': { locus: 'COL1A1', locusName: 'Osteogenesis Imperfecta', category: 'health' },
  'COL1A1': { locus: 'COL1A1', locusName: 'Osteogenesis Imperfecta', category: 'health' },
  'COL1A2': { locus: 'COL1A2', locusName: 'Osteogenesis Imperfecta (COL1A2)', category: 'health' },

  // Dental/Jaw Conditions
  'Craniomandibular Osteopathy': { locus: 'SLC37A2', locusName: 'Craniomandibular Osteopathy', category: 'health' },
  'CMO': { locus: 'SLC37A2', locusName: 'Craniomandibular Osteopathy', category: 'health' },
  'SLC37A2': { locus: 'SLC37A2', locusName: 'Craniomandibular Osteopathy', category: 'health' },
  'Ectodermal Dysplasia': { locus: 'FOXI3', locusName: 'Ectodermal Dysplasia', category: 'health' },

  // Copper Toxicosis
  'Copper Toxicosis': { locus: 'ATP7B', locusName: 'Copper Toxicosis', category: 'health' },
  'ATP7B': { locus: 'ATP7B', locusName: 'Copper Toxicosis', category: 'health' },
  'Copper Toxicosis (Labrador Retriever Type)': { locus: 'ATP7A', locusName: 'Copper Toxicosis (Labrador)', category: 'health' },
  'ATP7A': { locus: 'ATP7A', locusName: 'Copper Toxicosis (Labrador)', category: 'health' },

  // Hypocatalasia
  'Hypocatalasia': { locus: 'CAT', locusName: 'Hypocatalasia (Acatalasemia)', category: 'health' },
  'Acatalasemia': { locus: 'CAT', locusName: 'Hypocatalasia (Acatalasemia)', category: 'health' },
  'CAT': { locus: 'CAT', locusName: 'Hypocatalasia (Acatalasemia)', category: 'health' },

  // Congenital Hypothyroidism
  'Congenital Hypothyroidism': { locus: 'TPO', locusName: 'Congenital Hypothyroidism', category: 'health' },
  'TPO': { locus: 'TPO', locusName: 'Congenital Hypothyroidism', category: 'health' },

  // Congenital Adrenal Hyperplasia
  'Congenital Adrenal Hyperplasia': { locus: 'CYP11B1', locusName: 'Congenital Adrenal Hyperplasia', category: 'health' },
  'CYP11B1': { locus: 'CYP11B1', locusName: 'Congenital Adrenal Hyperplasia', category: 'health' },

  // Hypoadrenocorticism
  'Hypoadrenocorticism': { locus: 'HAC', locusName: 'Hypoadrenocorticism (Addison Disease)', category: 'health' },
  'Addison Disease': { locus: 'HAC', locusName: 'Hypoadrenocorticism (Addison Disease)', category: 'health' },

  // Exocrine Pancreatic Insufficiency
  'Exocrine Pancreatic Insufficiency': { locus: 'EPI', locusName: 'Exocrine Pancreatic Insufficiency', category: 'health' },
  'EPI': { locus: 'EPI', locusName: 'Exocrine Pancreatic Insufficiency', category: 'health' },

  // Intestinal Cobalamin Malabsorption
  'Intestinal Cobalamin Malabsorption': { locus: 'CUBN', locusName: 'Intestinal Cobalamin Malabsorption', category: 'health' },
  'Imerslund-Grasbeck Syndrome': { locus: 'CUBN', locusName: 'Intestinal Cobalamin Malabsorption', category: 'health' },
  'CUBN': { locus: 'CUBN', locusName: 'Intestinal Cobalamin Malabsorption', category: 'health' },
  'AMN': { locus: 'AMN', locusName: 'Intestinal Cobalamin Malabsorption (AMN)', category: 'health' },
  'Cobalamin Deficiency': { locus: 'CUBN', locusName: 'Intestinal Cobalamin Malabsorption', category: 'health' },

  // Anhidrotic Ectodermal Dysplasia
  'Anhidrotic Ectodermal Dysplasia': { locus: 'EDA', locusName: 'Anhidrotic Ectodermal Dysplasia', category: 'health' },
  'EDA': { locus: 'EDA', locusName: 'Anhidrotic Ectodermal Dysplasia', category: 'health' },

  // Dermatomyositis
  'Dermatomyositis': { locus: 'PAN2', locusName: 'Dermatomyositis', category: 'health' },
  'DMS': { locus: 'PAN2', locusName: 'Dermatomyositis', category: 'health' },
  'PAN2': { locus: 'PAN2', locusName: 'Dermatomyositis', category: 'health' },

  // Ichthyosis
  'Ichthyosis': { locus: 'ICH', locusName: 'Ichthyosis', category: 'health' },
  'Ichthyosis (Golden Retriever Type)': { locus: 'PNPLA1', locusName: 'Ichthyosis (Golden Retriever)', category: 'health' },
  'PNPLA1': { locus: 'PNPLA1', locusName: 'Ichthyosis (Golden Retriever)', category: 'health' },
  'Ichthyosis (American Bulldog Type)': { locus: 'NIPAL4', locusName: 'Ichthyosis (American Bulldog)', category: 'health' },
  'NIPAL4': { locus: 'NIPAL4', locusName: 'Ichthyosis (American Bulldog)', category: 'health' },
  'Ichthyosis (Great Dane Type)': { locus: 'SLC27A4', locusName: 'Ichthyosis (Great Dane)', category: 'health' },
  'SLC27A4': { locus: 'SLC27A4', locusName: 'Ichthyosis (Great Dane)', category: 'health' },
  'Epidermolytic Ichthyosis': { locus: 'KRT10', locusName: 'Epidermolytic Ichthyosis', category: 'health' },
  'KRT10': { locus: 'KRT10', locusName: 'Epidermolytic Ichthyosis', category: 'health' },

  // Epidermolysis Bullosa
  'Epidermolysis Bullosa': { locus: 'COL7A1', locusName: 'Epidermolysis Bullosa', category: 'health' },
  'COL7A1': { locus: 'COL7A1', locusName: 'Epidermolysis Bullosa', category: 'health' },
  'Epidermolysis Bullosa Simplex': { locus: 'KRT14', locusName: 'Epidermolysis Bullosa Simplex', category: 'health' },
  'KRT14': { locus: 'KRT14', locusName: 'Epidermolysis Bullosa Simplex', category: 'health' },

  // Hereditary Footpad Hyperkeratosis
  'Hereditary Footpad Hyperkeratosis': { locus: 'FAM83G', locusName: 'Hereditary Footpad Hyperkeratosis', category: 'health' },
  'FAM83G': { locus: 'FAM83G', locusName: 'Hereditary Footpad Hyperkeratosis', category: 'health' },
  'Digital Hyperkeratosis': { locus: 'FAM83G', locusName: 'Hereditary Footpad Hyperkeratosis', category: 'health' },

  // Hereditary Nasal Parakeratosis
  'Hereditary Nasal Parakeratosis': { locus: 'SUV39H2', locusName: 'Hereditary Nasal Parakeratosis', category: 'health' },
  'HNPK': { locus: 'SUV39H2', locusName: 'Hereditary Nasal Parakeratosis', category: 'health' },
  'SUV39H2': { locus: 'SUV39H2', locusName: 'Hereditary Nasal Parakeratosis', category: 'health' },

  // Primary Ciliary Dyskinesia
  'Primary Ciliary Dyskinesia': { locus: 'CCDC39', locusName: 'Primary Ciliary Dyskinesia', category: 'health' },
  'PCD': { locus: 'CCDC39', locusName: 'Primary Ciliary Dyskinesia', category: 'health' },
  'CCDC39': { locus: 'CCDC39', locusName: 'Primary Ciliary Dyskinesia', category: 'health' },
  'Primary Ciliary Dyskinesia (Old English Sheepdog Type)': { locus: 'NME5', locusName: 'Primary Ciliary Dyskinesia (OES)', category: 'health' },
  'NME5': { locus: 'NME5', locusName: 'Primary Ciliary Dyskinesia (OES)', category: 'health' },

  // Canine Elliptocytosis
  'Canine Elliptocytosis': { locus: 'SPTB', locusName: 'Canine Elliptocytosis', category: 'health' },
  'SPTB': { locus: 'SPTB', locusName: 'Canine Elliptocytosis', category: 'health' },

  // Deafness
  'Congenital Deafness': { locus: 'DEAF', locusName: 'Congenital Deafness', category: 'health' },
  'Deafness': { locus: 'DEAF', locusName: 'Congenital Deafness', category: 'health' },
  'Congenital Deafness (Dalmatian Type)': { locus: 'MITF', locusName: 'Congenital Deafness (Dalmatian)', category: 'health' },

  // Cleft Palate
  'Cleft Palate': { locus: 'ADAMTS20', locusName: 'Cleft Palate', category: 'health' },
  'ADAMTS20': { locus: 'ADAMTS20', locusName: 'Cleft Palate', category: 'health' },
  'Cleft Lip/Palate': { locus: 'ADAMTS20', locusName: 'Cleft Palate', category: 'health' },

  // Bleeding Disorders (Additional)
  'Canine Factor VII Deficiency': { locus: 'F7', locusName: 'Factor VII Deficiency', category: 'health' },

  // Stargardt Disease
  'Stargardt Disease': { locus: 'ABCA4', locusName: 'Stargardt Disease', category: 'health' },
  'ABCA4': { locus: 'ABCA4', locusName: 'Stargardt Disease', category: 'health' },

  // Legg-Calve-Perthes Disease
  'Legg-Calve-Perthes Disease': { locus: 'LCP', locusName: 'Legg-Calve-Perthes Disease', category: 'health' },
  'Avascular Necrosis of the Femoral Head': { locus: 'LCP', locusName: 'Legg-Calve-Perthes Disease', category: 'health' },

  // Patellar Luxation
  'Patellar Luxation': { locus: 'PL', locusName: 'Patellar Luxation', category: 'health' },

  // Syringomyelia
  'Syringomyelia': { locus: 'SM', locusName: 'Syringomyelia', category: 'health' },
  'Chiari-like Malformation': { locus: 'CM', locusName: 'Chiari-like Malformation', category: 'health' },

  // Brachycephalic Airway Syndrome
  'Brachycephalic Obstructive Airway Syndrome': { locus: 'BOAS', locusName: 'Brachycephalic Obstructive Airway Syndrome', category: 'health' },
  'BOAS': { locus: 'BOAS', locusName: 'Brachycephalic Obstructive Airway Syndrome', category: 'health' },

  // Laryngeal Paralysis
  'Laryngeal Paralysis': { locus: 'LP', locusName: 'Laryngeal Paralysis', category: 'health' },

  // Additional Breed-Specific Conditions
  'Canine Cyclic Neutropenia': { locus: 'AP3B1', locusName: 'Cyclic Neutropenia (Gray Collie Syndrome)', category: 'health' },
  'Canine Parvovirus Susceptibility': { locus: 'CPV-S', locusName: 'Canine Parvovirus Susceptibility', category: 'health' },
  'Canine Coronavirus Susceptibility': { locus: 'CCV-S', locusName: 'Canine Coronavirus Susceptibility', category: 'health' },
};

// Genotype value mappings for Embark format
const GENOTYPE_VALUE_MAP: Record<string, string> = {
  // Clear/Normal
  'Clear': 'N/N',
  'Normal': 'N/N',
  'Clear/Normal': 'N/N',
  'No copies': 'N/N',
  'WT/WT': 'N/N',

  // Carrier
  'Carrier': 'N/m',
  'One copy': 'N/m',
  'WT/M': 'N/m',

  // Affected
  'At Risk': 'm/m',
  'Two copies': 'm/m',
  'Affected': 'm/m',
  'M/M': 'm/m',
};

/**
 * Parse a CSV string into rows
 */
function parseCSV(csvContent: string): Array<{ category: string; name: string; value: string }> {
  const rows: Array<{ category: string; name: string; value: string }> = [];
  const lines = csvContent.trim().split(/\r?\n/);

  // Skip header row if present
  const startIndex = lines[0]?.toLowerCase().includes('category') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values and commas
    const parts = parseCSVLine(line);
    if (parts.length >= 3) {
      rows.push({
        category: parts[0].trim(),
        name: parts[1].trim(),
        value: parts[2].trim(),
      });
    }
  }

  return rows;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse genotype value from Embark format
 * Examples: "E/E", "Em/E", "Ee", "Clear", "Carrier", etc.
 */
function parseGenotypeValue(value: string): { allele1?: string; allele2?: string; genotype: string } {
  // Check if it's a status word first
  const mappedValue = GENOTYPE_VALUE_MAP[value];
  if (mappedValue) {
    const parts = mappedValue.split('/');
    return {
      allele1: parts[0],
      allele2: parts[1],
      genotype: mappedValue,
    };
  }

  // Handle slash-separated format (E/E, Em/e, etc.)
  if (value.includes('/')) {
    const parts = value.split('/');
    return {
      allele1: parts[0],
      allele2: parts[1],
      genotype: value,
    };
  }

  // Handle concatenated format (EE, Ee, ee)
  // Look for uppercase followed by lowercase or another uppercase
  const match = value.match(/^([A-Z][a-z]*)([A-Z][a-z]*|[a-z]+)$/);
  if (match) {
    return {
      allele1: match[1],
      allele2: match[2],
      genotype: `${match[1]}/${match[2]}`,
    };
  }

  // Return as-is if we can't parse it
  return { genotype: value };
}

/**
 * Main parser function for Embark CSV
 */
export function parseEmbarkCSV(csvContent: string): EmbarkParseResult {
  const result: EmbarkParseResult = {
    success: true,
    genetics: {
      coatColor: [],
      coatType: [],
      physicalTraits: [],
      eyeColor: [],
      health: [],
      otherTraits: [],
      unmapped: [],
    },
    warnings: [],
    errors: [],
  };

  try {
    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      result.success = false;
      result.errors.push('No data found in CSV file');
      return result;
    }

    for (const row of rows) {
      // Skip empty or header-like rows
      if (!row.name || !row.value) continue;

      // Try to find a mapping for this locus
      const mapping = EMBARK_LOCUS_MAP[row.name];

      if (mapping) {
        const parsed = parseGenotypeValue(row.value);
        const locus: ParsedLocus = {
          locus: mapping.locus,
          locusName: mapping.locusName,
          allele1: parsed.allele1,
          allele2: parsed.allele2,
          genotype: parsed.genotype,
          source: 'embark',
        };

        result.genetics[mapping.category].push(locus);
      } else {
        // Store unmapped rows for review
        result.genetics.unmapped.push(row);
        result.warnings.push(`Unknown locus: "${row.name}" (${row.value})`);
      }
    }

    // Check if we got any meaningful data
    const totalMapped =
      result.genetics.coatColor.length +
      result.genetics.coatType.length +
      result.genetics.physicalTraits.length +
      result.genetics.eyeColor.length +
      result.genetics.health.length;

    if (totalMapped === 0) {
      result.warnings.push('No recognized genetic markers found. The file may not be an Embark results file.');
    }

  } catch (error) {
    result.success = false;
    result.errors.push(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Convert parsed genetics to our database format
 */
export function toDatabaseFormat(parsed: ParsedGenetics): {
  coatColorData: any[];
  coatTypeData: any[];
  physicalTraitsData: any[];
  eyeColorData: any[];
  healthGeneticsData: any[];
  otherTraitsData: any[];
} {
  const toDbLocus = (locus: ParsedLocus) => ({
    locus: locus.locus,
    locusName: locus.locusName,
    allele1: locus.allele1,
    allele2: locus.allele2,
    genotype: locus.genotype,
  });

  return {
    coatColorData: parsed.coatColor.map(toDbLocus),
    coatTypeData: parsed.coatType.map(toDbLocus),
    physicalTraitsData: parsed.physicalTraits.map(toDbLocus),
    eyeColorData: parsed.eyeColor.map(toDbLocus),
    healthGeneticsData: parsed.health.map(toDbLocus),
    otherTraitsData: parsed.otherTraits.map(toDbLocus),
  };
}

/**
 * Get list of supported loci for display
 */
export function getSupportedLoci(): Array<{ name: string; locus: string; category: string }> {
  const seen = new Set<string>();
  const result: Array<{ name: string; locus: string; category: string }> = [];

  for (const [name, mapping] of Object.entries(EMBARK_LOCUS_MAP)) {
    const key = `${mapping.locus}-${mapping.category}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        name: mapping.locusName,
        locus: mapping.locus,
        category: mapping.category,
      });
    }
  }

  return result.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
