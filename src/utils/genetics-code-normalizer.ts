/**
 * Normalizes genetic locus codes to standard short codes
 * Prevents mismatches between database storage and UI expectations
 */

export interface LocusCodeMapping {
  [fullCode: string]: string;
}

/**
 * Standard locus code mappings by species
 * Maps full/long codes and variations to canonical short codes
 */
const SPECIES_CODE_MAPPINGS: Record<string, LocusCodeMapping> = {
  DOG: {
    // Coat Color
    'AGOUTI': 'A',
    'BROWN': 'B',
    'DILUTE': 'D',
    'EXTENSION': 'E',
    'BLACK_EXTENSION': 'K',
    'DOMINANT_BLACK': 'K',
    'MERLE': 'M',
    'WHITE_SPOTTING': 'S',
    'SPOTTING': 'S',
    'HARLEQUIN': 'H',
    'MASK': 'Em',
    'MELANISTIC_MASK': 'Em',

    // Coat Type
    'LONG_HAIR': 'L',
    'LENGTH': 'L',
    'FURNISHINGS': 'F',
    'CURLY': 'Cu',
    'CURL': 'Cu',
    'SHEDDING': 'Sd',
    'IMPROPER_COAT': 'IC',
    'FLUFFY': 'L4',
    'FLUFFY_GENE': 'L4',

    // Physical Traits
    'IGF1': 'IGF1',
    'SIZE': 'IGF1',
    'BOBTAIL': 'BT',
    'NATURAL_BOBTAIL': 'BT',
    'DEWCLAWS': 'Dw',
    'REAR_DEWCLAWS': 'Dw',
  },

  CAT: {
    // Coat Color
    'AGOUTI': 'A',
    'BROWN': 'B',
    'COLORPOINT': 'C',
    'COLOR_POINT': 'C',
    'DILUTE': 'D',
    'ORANGE': 'O',
    'RED': 'O',
    'WHITE_SPOTTING': 'S',
    'SPOTTING': 'S',
    'DOMINANT_WHITE': 'W',
    'WHITE': 'W',

    // Coat Type
    'LONG_HAIR': 'L',
    'LENGTH': 'L',
    'MACKEREL': 'Mc',
    'TABBY_PATTERN': 'Mc',
    'REX': 'R',
    'CURLY': 'R',
    'FOLD': 'Fd',
    'FOLDED_EARS': 'Fd',

    // Physical
    'POLYDACTYL': 'Pd',
    'EXTRA_TOES': 'Pd',
  },

  HORSE: {
    // Coat Color - Most critical for horses!
    'EXTENSION': 'E',
    'AGOUTI': 'A',
    'CREAM': 'Cr',
    'CREAM_DILUTION': 'Cr',
    'DUN': 'D',
    'DUN_DILUTION': 'D',
    'GRAY': 'G',
    'GREY': 'G',
    'PROGRESSIVE_GRAY': 'G',
    'CHAMPAGNE': 'Ch',
    'CHAMPAGNE_DILUTION': 'Ch',
    'SILVER': 'Z',
    'SILVER_DAPPLE': 'Z',
    'TOBIANO': 'TO',
    'TOBIANO_SPOTTING': 'TO',
    'OVERO': 'O',
    'FRAME': 'O',
    'FRAME_OVERO': 'O',
    'OLWS': 'O',
    'SABINO': 'SB',
    'SABINO_SPOTTING': 'SB',
    'LEOPARD_COMPLEX': 'LP',
    'LEOPARD': 'LP',
    'APPALOOSA': 'LP',
    'ROAN': 'Rn',
    'DOMINANT_WHITE': 'W',
    'WHITE': 'W',
    'SPLASHED_WHITE': 'SW',
    'SPLASH': 'SW',
    'CHESTNUT_FACTOR': 'nCh',
    'RED_FACTOR': 'nCh',

    // Performance
    'MYOSTATIN': 'MSTN',
    'SPEED_GENE': 'MSTN',
    'SPEED': 'MSTN',
    'DMRT3': 'DMRT3',
    'GAIT_KEEPER': 'DMRT3',
    'GAIT': 'DMRT3',
    'GAITED': 'DMRT3',
    'PPARGC1A': 'PPARGC1A',
    'ENDURANCE': 'PPARGC1A',
    'ENDURANCE_GENE': 'PPARGC1A',

    // Health
    'HYPERKALEMIC_PERIODIC_PARALYSIS': 'HYPP',
    'HYPP_GENE': 'HYPP',
    'GLYCOGEN_BRANCHING_ENZYME_DEFICIENCY': 'GBED',
    'GBED_GENE': 'GBED',
    'HEREDITARY_EQUINE_REGIONAL_DERMAL_ASTHENIA': 'HERDA',
    'HERDA_GENE': 'HERDA',
    'POLYSACCHARIDE_STORAGE_MYOPATHY_TYPE_1': 'PSSM1',
    'PSSM_TYPE_1': 'PSSM1',
    'PSSM1_GENE': 'PSSM1',
    'POLYSACCHARIDE_STORAGE_MYOPATHY_TYPE_2': 'PSSM2',
    'PSSM_TYPE_2': 'PSSM2',
    'CEREBELLAR_ABIOTROPHY': 'CA',
    'CA_GENE': 'CA',
    'LAVENDER_FOAL_SYNDROME': 'LFS',
    'LFS_GENE': 'LFS',
    'SEVERE_COMBINED_IMMUNODEFICIENCY': 'SCID',
    'SCID_GENE': 'SCID',
    'MALIGNANT_HYPERTHERMIA': 'MH',
    'MH_GENE': 'MH',

    // Height genes
    'LCORL': 'LCORL',
    'HEIGHT_GENE_1': 'LCORL',
    'HMGA2': 'HMGA2',
    'HEIGHT_GENE_2': 'HMGA2',
    'ZFAT': 'ZFAT',
    'HEIGHT_GENE_3': 'ZFAT',
  },
};

/**
 * Normalize a locus code to the standard short code for a species
 */
export function normalizeLocusCode(code: string, species: string): string {
  const speciesUpper = (species || 'DOG').toUpperCase();
  const codeUpper = code.trim().toUpperCase().replace(/[-_\s]/g, '_');

  const mapping = SPECIES_CODE_MAPPINGS[speciesUpper] || {};

  // Return mapped code if exists, otherwise return original (in case it's already short)
  return mapping[codeUpper] || code.trim();
}

/**
 * Normalize all locus codes in a genetic data object
 */
export function normalizeGeneticData(data: any, species: string): any {
  if (!data || typeof data !== 'object') return data;

  const normalized = { ...data };

  // Normalize arrays of loci
  const locusArrayFields = [
    'coatColor',
    'coatType',
    'physicalTraits',
    'eyeColor',
    'performance',
    'temperament',
    'health',
    'otherTraits',
    'bloodType',
  ];

  for (const field of locusArrayFields) {
    if (Array.isArray(normalized[field])) {
      normalized[field] = normalized[field].map((locus: any) => ({
        ...locus,
        locus: normalizeLocusCode(locus.locus, species),
      }));

      // Remove duplicates - keep first occurrence (assumes first has most data)
      const seen = new Set<string>();
      normalized[field] = normalized[field].filter((locus: any) => {
        if (seen.has(locus.locus)) {
          return false;
        }
        seen.add(locus.locus);
        return true;
      });
    }
  }

  return normalized;
}

/**
 * Validate that a locus code is recognized for a species
 * Returns true if code is valid (either short code or known long code)
 */
export function isValidLocusCode(code: string, species: string): boolean {
  const normalized = normalizeLocusCode(code, species);
  // If normalization changed the code, it was a recognized long code
  // If it didn't change, we assume it's a valid short code (might want to enhance this)
  return true; // For now, accept all codes after normalization
}

/**
 * Get the canonical short code for a locus (for display/comparison)
 */
export function getCanonicalCode(code: string, species: string): string {
  return normalizeLocusCode(code, species);
}
