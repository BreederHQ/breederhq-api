/**
 * Helper function to sync genetics JSONB data to animal_loci table
 * Maintains searchable normalized structure alongside JSONB storage
 */

import { PrismaClient } from '@prisma/client';
import { normalizeLocusCode } from './genetics-code-normalizer.js';

const prisma = new PrismaClient();

interface GeneticLocus {
  locus: string;
  locusName?: string;
  allele1?: string;
  allele2?: string;
  genotype?: string;
  networkVisible?: boolean;
}

interface GeneticsData {
  coatColor?: GeneticLocus[];
  coatType?: GeneticLocus[];
  physicalTraits?: GeneticLocus[];
  eyeColor?: GeneticLocus[];
  performance?: GeneticLocus[];
  temperament?: GeneticLocus[];
  health?: GeneticLocus[];
  otherTraits?: GeneticLocus[];
  bloodType?: GeneticLocus[];
}

const CATEGORY_MAP: Record<keyof GeneticsData, string> = {
  coatColor: 'coatColor',
  coatType: 'coatType',
  physicalTraits: 'physicalTraits',
  eyeColor: 'eyeColor',
  performance: 'performance',
  temperament: 'temperament',
  health: 'health',
  otherTraits: 'otherTraits',
  bloodType: 'bloodType',
};

/**
 * Sync genetics data to animal_loci table for searchability
 * @param animalId - The animal ID
 * @param species - Animal species (for code normalization)
 * @param geneticsData - Genetics data object with category arrays
 */
export async function syncAnimalLoci(
  animalId: number,
  species: string,
  geneticsData: GeneticsData
): Promise<void> {
  try {
    // Delete existing loci for this animal
    await prisma.$executeRaw`DELETE FROM animal_loci WHERE animal_id = ${animalId}`;

    // Process each category
    for (const [categoryKey, categoryName] of Object.entries(CATEGORY_MAP)) {
      const lociArray = geneticsData[categoryKey as keyof GeneticsData];

      if (!lociArray || !Array.isArray(lociArray)) continue;

      for (const locus of lociArray) {
        if (!locus.locus) continue;

        // Normalize the locus code
        const normalizedCode = normalizeLocusCode(locus.locus, species);

        // Insert into animal_loci table
        await prisma.$executeRaw`
          INSERT INTO animal_loci (
            animal_id, category, locus, locus_name,
            allele1, allele2, genotype, network_visible,
            created_at, updated_at
          ) VALUES (
            ${animalId},
            ${categoryName},
            ${normalizedCode},
            ${locus.locusName || normalizedCode},
            ${locus.allele1 || null},
            ${locus.allele2 || null},
            ${locus.genotype || null},
            ${locus.networkVisible ?? false},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (animal_id, category, locus)
          DO UPDATE SET
            locus_name = EXCLUDED.locus_name,
            allele1 = EXCLUDED.allele1,
            allele2 = EXCLUDED.allele2,
            genotype = EXCLUDED.genotype,
            network_visible = EXCLUDED.network_visible,
            updated_at = CURRENT_TIMESTAMP
        `;
      }
    }
  } catch (error) {
    console.error(`Error syncing animal_loci for animal ${animalId}:`, error);
    // Don't throw - this is a secondary index, shouldn't break the main operation
  }
}

/**
 * Update network visibility for a specific locus
 * @param animalId - The animal ID
 * @param category - Genetics category
 * @param locus - Locus code
 * @param networkVisible - New visibility state
 */
export async function updateLocusVisibility(
  animalId: number,
  category: string,
  locus: string,
  networkVisible: boolean
): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE animal_loci
      SET network_visible = ${networkVisible}, updated_at = CURRENT_TIMESTAMP
      WHERE animal_id = ${animalId}
        AND category = ${category}
        AND locus = ${locus}
    `;
  } catch (error) {
    console.error(`Error updating locus visibility:`, error);
  }
}
