/**
 * Example query functions for genetic searches using animal_loci table
 *
 * These queries demonstrate high-performance genetic searching capabilities
 * enabled by the normalized animal_loci table structure
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AnimalWithLocus {
  animalId: number;
  locus: string;
  genotype: string | null;
  allele1: string | null;
  allele2: string | null;
  networkVisible: boolean;
}

/**
 * Find animals that are carriers or affected for a specific locus
 *
 * Example: Find all horses carrying Tobiano (TO/to or TO/TO)
 * Usage: findCarriers('TO', 'HORSE')
 */
export async function findCarriers(
  locus: string,
  species?: string,
  tenantId?: number
): Promise<AnimalWithLocus[]> {
  const query = `
    SELECT DISTINCT
      al.animal_id as "animalId",
      al.locus,
      al.genotype,
      al.allele1,
      al.allele2,
      al.network_visible as "networkVisible"
    FROM animal_loci al
    INNER JOIN animals a ON a.id = al.animal_id
    WHERE al.locus = $1
      AND al.genotype IS NOT NULL
      AND al.genotype != 'N/N'
      AND al.genotype != 'n/n'
      ${species ? "AND a.species = $2" : ""}
      ${tenantId ? (species ? "AND a.tenant_id = $3" : "AND a.tenant_id = $2") : ""}
    ORDER BY a.id
  `;

  const params: (string | number)[] = [locus];
  if (species) params.push(species);
  if (tenantId) params.push(tenantId);

  return await prisma.$queryRawUnsafe<AnimalWithLocus[]>(query, ...params);
}

/**
 * Find animals with a specific allele at a locus
 *
 * Example: Find all animals with the recessive 'e' allele (red factor)
 * Usage: findAnimalsWithAllele('E', 'e')
 */
export async function findAnimalsWithAllele(
  locus: string,
  allele: string,
  tenantId?: number
): Promise<AnimalWithLocus[]> {
  const query = `
    SELECT DISTINCT
      al.animal_id as "animalId",
      al.locus,
      al.genotype,
      al.allele1,
      al.allele2,
      al.network_visible as "networkVisible"
    FROM animal_loci al
    INNER JOIN animals a ON a.id = al.animal_id
    WHERE al.locus = $1
      AND (al.allele1 = $2 OR al.allele2 = $2)
      ${tenantId ? "AND a.tenant_id = $3" : ""}
    ORDER BY a.id
  `;

  const params: (string | number)[] = [locus, allele];
  if (tenantId) params.push(tenantId);

  return await prisma.$queryRawUnsafe<AnimalWithLocus[]>(query, ...params);
}

/**
 * Find animals with specific genotype
 *
 * Example: Find all homozygous Tobiano horses (TO/TO)
 * Usage: findByGenotype('TO', 'TO/TO')
 */
export async function findByGenotype(
  locus: string,
  genotype: string,
  tenantId?: number
): Promise<AnimalWithLocus[]> {
  const query = `
    SELECT DISTINCT
      al.animal_id as "animalId",
      al.locus,
      al.genotype,
      al.allele1,
      al.allele2,
      al.network_visible as "networkVisible"
    FROM animal_loci al
    INNER JOIN animals a ON a.id = al.animal_id
    WHERE al.locus = $1
      AND al.genotype = $2
      ${tenantId ? "AND a.tenant_id = $3" : ""}
    ORDER BY a.id
  `;

  const params: (string | number)[] = [locus, genotype];
  if (tenantId) params.push(tenantId);

  return await prisma.$queryRawUnsafe<AnimalWithLocus[]>(query, ...params);
}

/**
 * Find breeding-compatible pairs for a specific locus
 *
 * Example: Find horses that WON'T produce OLWS (lethal O/O) when bred to a Frame Overo carrier
 * Usage: findCompatiblePairs(animalId, 'O', 'n/n') - find N/N (non-carriers)
 */
export async function findCompatiblePairs(
  animalId: number,
  locus: string,
  requiredGenotype: string,
  tenantId?: number
): Promise<AnimalWithLocus[]> {
  const query = `
    SELECT DISTINCT
      al.animal_id as "animalId",
      al.locus,
      al.genotype,
      al.allele1,
      al.allele2,
      al.network_visible as "networkVisible"
    FROM animal_loci al
    INNER JOIN animals a ON a.id = al.animal_id
    WHERE al.locus = $1
      AND al.genotype = $2
      AND al.animal_id != $3
      ${tenantId ? "AND a.tenant_id = $4" : ""}
    ORDER BY a.id
  `;

  const params = [locus, requiredGenotype, animalId];
  if (tenantId) params.push(tenantId);

  return await prisma.$queryRawUnsafe<AnimalWithLocus[]>(query, ...params);
}

/**
 * Find animals clear of multiple health conditions
 *
 * Example: Find horses clear of HYPP, GBED, PSSM1 (all N/N or Clear)
 * Usage: findClearOfConditions(['HYPP', 'GBED', 'PSSM1'])
 */
export async function findClearOfConditions(
  loci: string[],
  tenantId?: number
): Promise<{ animalId: number; testedLoci: number }[]> {
  // Find animals that have N/N or Clear for ALL specified loci
  const query = `
    SELECT
      al.animal_id as "animalId",
      COUNT(DISTINCT al.locus) as "testedLoci"
    FROM animal_loci al
    INNER JOIN animals a ON a.id = al.animal_id
    WHERE al.locus = ANY($1::text[])
      AND (
        al.genotype IN ('N/N', 'n/n', 'Clear', 'clear', 'CLEAR')
        OR al.genotype LIKE 'N/%'
        OR al.genotype LIKE '%/N'
      )
      ${tenantId ? "AND a.tenant_id = $2" : ""}
    GROUP BY al.animal_id
    HAVING COUNT(DISTINCT al.locus) = $${tenantId ? "3" : "2"}
    ORDER BY al.animal_id
  `;

  const params = [loci, loci.length];
  if (tenantId) params.push(tenantId);

  return await prisma.$queryRawUnsafe<{ animalId: number; testedLoci: number }[]>(query, ...params);
}

/**
 * Get all genetics for an animal (fast lookup)
 *
 * Example: Get complete genetic profile for animal 396
 * Usage: getAnimalGenetics(396)
 */
export async function getAnimalGenetics(
  animalId: number
): Promise<{ category: string; locus: string; genotype: string | null; networkVisible: boolean }[]> {
  const query = `
    SELECT
      category,
      locus,
      locus_name as "locusName",
      genotype,
      allele1,
      allele2,
      network_visible as "networkVisible"
    FROM animal_loci
    WHERE animal_id = $1
    ORDER BY category, locus
  `;

  return await prisma.$queryRawUnsafe<any[]>(query, animalId);
}

/**
 * Find animals with public genetics (network-visible)
 *
 * Example: Find all horses with public Tobiano results
 * Usage: findPublicGenetics('TO', 'HORSE')
 */
export async function findPublicGenetics(
  locus: string,
  species?: string
): Promise<AnimalWithLocus[]> {
  const query = `
    SELECT DISTINCT
      al.animal_id as "animalId",
      al.locus,
      al.genotype,
      al.allele1,
      al.allele2,
      al.network_visible as "networkVisible"
    FROM animal_loci al
    INNER JOIN animals a ON a.id = al.animal_id
    WHERE al.locus = $1
      AND al.network_visible = true
      ${species ? "AND a.species = $2" : ""}
    ORDER BY a.id
  `;

  const params = [locus];
  if (species) params.push(species);

  return await prisma.$queryRawUnsafe<AnimalWithLocus[]>(query, ...params);
}

/**
 * Get genetic statistics for a locus across population
 *
 * Example: Get genotype distribution for Tobiano in horses
 * Usage: getLocusStats('TO', 'HORSE')
 */
export async function getLocusStats(
  locus: string,
  species?: string,
  tenantId?: number
): Promise<{ genotype: string; count: number }[]> {
  const query = `
    SELECT
      al.genotype,
      COUNT(*) as count
    FROM animal_loci al
    INNER JOIN animals a ON a.id = al.animal_id
    WHERE al.locus = $1
      AND al.genotype IS NOT NULL
      ${species ? "AND a.species = $2" : ""}
      ${tenantId ? (species ? "AND a.tenant_id = $3" : "AND a.tenant_id = $2") : ""}
    GROUP BY al.genotype
    ORDER BY count DESC
  `;

  const params: (string | number)[] = [locus];
  if (species) params.push(species);
  if (tenantId) params.push(tenantId);

  return await prisma.$queryRawUnsafe<{ genotype: string; count: number }[]>(query, ...params);
}

/**
 * Find animals with genetic data in a specific category
 *
 * Example: Find all animals with health genetics data
 * Usage: findByCategory('health')
 */
export async function findByCategory(
  category: string,
  tenantId?: number
): Promise<{ animalId: number; lociCount: number }[]> {
  const query = `
    SELECT
      al.animal_id as "animalId",
      COUNT(*) as "lociCount"
    FROM animal_loci al
    INNER JOIN animals a ON a.id = al.animal_id
    WHERE al.category = $1
      ${tenantId ? "AND a.tenant_id = $2" : ""}
    GROUP BY al.animal_id
    ORDER BY "lociCount" DESC
  `;

  const params: (string | number)[] = [category];
  if (tenantId) params.push(tenantId);

  return await prisma.$queryRawUnsafe<{ animalId: number; lociCount: number }[]>(query, ...params);
}

// Export all query functions
export const geneticsQueries = {
  findCarriers,
  findAnimalsWithAllele,
  findByGenotype,
  findCompatiblePairs,
  findClearOfConditions,
  getAnimalGenetics,
  findPublicGenetics,
  getLocusStats,
  findByCategory,
};
