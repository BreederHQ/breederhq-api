/**
 * Sync Script: Populate animal_loci table from existing animal_genetics JSONB data
 *
 * This script:
 * 1. Reads all animal_genetics records
 * 2. Extracts individual loci from JSONB columns
 * 3. Normalizes locus codes using genetics-code-normalizer
 * 4. Inserts into animal_loci table for searchability
 *
 * Run after migration: 20260212_add_animal_loci_search_table.sql
 */

import { PrismaClient } from '@prisma/client';
import { normalizeLocusCode } from '../src/utils/genetics-code-normalizer.js';

const prisma = new PrismaClient();

interface GeneticLocus {
  locus: string;
  locusName?: string;
  allele1?: string;
  allele2?: string;
  genotype?: string;
  networkVisible?: boolean;
}

interface AnimalLociInsert {
  animalId: number;
  category: string;
  locus: string;
  locusName: string;
  allele1: string | null;
  allele2: string | null;
  genotype: string | null;
  networkVisible: boolean;
}

const CATEGORY_FIELD_MAP: Record<string, string> = {
  coatColor: 'coat_color_data',
  coatType: 'coat_type_data',
  physicalTraits: 'physical_traits_data',
  eyeColor: 'eye_color_data',
  performance: 'performance_data',
  temperament: 'temperament_data',
  health: 'health_genetics_data',
  otherTraits: 'other_traits_data',
  bloodType: 'blood_type_data',
};

async function main() {
  console.log('Starting animal_loci sync...\n');

  // Get all animals with genetics data
  const geneticsRecords = await prisma.animalGenetics.findMany({
    include: {
      animal: {
        select: {
          id: true,
          name: true,
          species: true,
        },
      },
    },
  });

  console.log(`Found ${geneticsRecords.length} animals with genetics data\n`);

  let totalLociInserted = 0;
  let animalsProcessed = 0;

  for (const genetics of geneticsRecords) {
    const animalId = genetics.animalId;
    const animalName = genetics.animal.name;
    const species = genetics.animal.species || 'DOG';

    console.log(`Processing: ${animalName} (ID: ${animalId}, Species: ${species})`);

    const lociToInsert: AnimalLociInsert[] = [];

    // Process each category
    for (const [category, dbField] of Object.entries(CATEGORY_FIELD_MAP)) {
      const lociArray = (genetics as any)[dbField.replace(/_data$/, 'Data')] as GeneticLocus[] | null;

      if (!lociArray || !Array.isArray(lociArray)) continue;

      for (const locus of lociArray) {
        if (!locus.locus) continue;

        // Normalize the locus code
        const normalizedCode = normalizeLocusCode(locus.locus, species);

        lociToInsert.push({
          animalId,
          category,
          locus: normalizedCode,
          locusName: locus.locusName || normalizedCode,
          allele1: locus.allele1 || null,
          allele2: locus.allele2 || null,
          genotype: locus.genotype || null,
          networkVisible: locus.networkVisible ?? false,
        });
      }
    }

    if (lociToInsert.length > 0) {
      // Delete existing loci for this animal first (in case re-running)
      await prisma.$executeRaw`DELETE FROM animal_loci WHERE animal_id = ${animalId}`;

      // Insert all loci for this animal
      for (const locus of lociToInsert) {
        await prisma.$executeRaw`
          INSERT INTO animal_loci (
            animal_id, category, locus, locus_name,
            allele1, allele2, genotype, network_visible,
            created_at, updated_at
          ) VALUES (
            ${locus.animalId}, ${locus.category}, ${locus.locus}, ${locus.locusName},
            ${locus.allele1}, ${locus.allele2}, ${locus.genotype}, ${locus.networkVisible},
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
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

      console.log(`  ✓ Inserted ${lociToInsert.length} loci`);
      totalLociInserted += lociToInsert.length;
      animalsProcessed++;
    } else {
      console.log(`  ⊘ No loci to insert`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Sync complete!`);
  console.log(`   Animals processed: ${animalsProcessed}`);
  console.log(`   Total loci inserted: ${totalLociInserted}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Show some example queries
  console.log('Example Queries:\n');

  // Find all animals with Tobiano
  const tobianoCarriers = await prisma.$queryRaw<Array<{ animal_id: number; genotype: string }>>`
    SELECT DISTINCT animal_id, genotype
    FROM animal_loci
    WHERE locus = 'TO'
    AND genotype IS NOT NULL
    AND genotype != 'N/N'
    LIMIT 5
  `;
  console.log(`Animals with Tobiano (TO):`, tobianoCarriers);

  // Find animals with specific allele
  const extensionRedFactors = await prisma.$queryRaw<Array<{ animal_id: number; allele1: string; allele2: string }>>`
    SELECT animal_id, allele1, allele2
    FROM animal_loci
    WHERE locus = 'E'
    AND (allele1 = 'e' OR allele2 = 'e')
    LIMIT 5
  `;
  console.log(`\nAnimals with red factor (E locus, e allele):`, extensionRedFactors);

  // Count by category
  const categoryStats = await prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
    SELECT category, COUNT(*) as count
    FROM animal_loci
    GROUP BY category
    ORDER BY count DESC
  `;
  console.log(`\nLoci by category:`, categoryStats);
}

main()
  .catch((e) => {
    console.error('\n❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
