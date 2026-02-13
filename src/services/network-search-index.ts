/**
 * Network Search Index Service
 *
 * Builds and queries a privacy-preserving search index for Network Breeding Discovery.
 * The index stores aggregated traits per tenant/species/sex — NEVER individual animal IDs.
 *
 * Searchers discover BREEDERS, not ANIMALS.
 *
 * See: docs/codebase/architecture/NETWORK-BREEDING-DISCOVERY-SEARCH-INDEX.md
 */

import prisma from "../prisma.js";
import { Prisma } from "@prisma/client";
import type { Species, Sex } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NetworkSearchCriteria {
  species: Species;
  sex: Sex;
  genetics?: {
    locus: string;
    acceptableGenotypes: string[];
  }[];
  health?: {
    test: string;
    acceptableStatuses: string[];
  }[];
  physical?: {
    minHeight?: number;
    maxHeight?: number;
    registries?: string[];
  };
}

export interface NetworkSearchResult {
  tenantId: number;
  breederName: string;
  breederLocation: string | null;
  matchCount: number;
  matchedCategories: string[];
}

export interface NetworkSearchResponse {
  results: NetworkSearchResult[];
  totalBreeders: number;
}

interface AggregatedTraits {
  genetics: Record<string, string[]>;
  physical: Record<string, unknown> | null;
  health: Record<string, string[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Species-specific loci to index
// ─────────────────────────────────────────────────────────────────────────────

const INDEXED_LOCI: Record<string, string[]> = {
  DOG: ["E", "K", "A", "B", "D", "S", "M", "MDR1", "DM", "PRA"],
  HORSE: ["E", "A", "CR", "TO", "HYPP", "GBED", "HERDA", "MSTN"],
  CAT: ["B", "D", "Dm", "W", "S", "PKD", "HCM"],
  SHEEP: ["SCRAPIE", "SPIDER", "B", "Sp", "BOOROOLA"],
  GOAT: ["SCRAPIE", "A", "B", "CSN3"],
  CATTLE: ["MC1R", "POLLED", "A2", "TH", "PHA"],
  RABBIT: ["E", "A", "B", "C", "D", "En", "V", "W"],
  PIG: ["MC1R", "RYR1", "RN", "IGF2"],
  ALPACA: ["MC1R", "A", "B", "FAWN"],
  LLAMA: ["MC1R", "A", "B"],
};

// Categories that map to "coat genetics", "health status", etc. for display
const CATEGORY_LABELS: Record<string, string> = {
  coatColor: "coat genetics",
  coatType: "coat type",
  health: "health clearances",
  physicalTraits: "physical traits",
  performance: "performance genetics",
  eyeColor: "eye color genetics",
  temperament: "temperament genetics",
};

// ─────────────────────────────────────────────────────────────────────────────
// Full Index Rebuild
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rebuild the entire network search index for all visible tenants.
 * Intended to run as a daily background job.
 */
export async function rebuildFullIndex(): Promise<void> {
  const startTime = Date.now();
  console.log("[network-search-index] Starting full rebuild");

  // Get all tenants that have at least one visible animal
  const tenants = await prisma.tenant.findMany({
    where: {
      networkVisibility: { not: "HIDDEN" },
      animals: {
        some: {
          networkSearchVisible: true,
          status: "ACTIVE",
          deletedAt: null,
        },
      },
    },
    select: { id: true },
  });

  console.log(
    `[network-search-index] Found ${tenants.length} tenants to index`
  );

  let indexed = 0;
  let errors = 0;

  for (const tenant of tenants) {
    try {
      await rebuildTenantIndex(tenant.id);
      indexed++;
    } catch (err) {
      errors++;
      console.error(
        `[network-search-index] Error indexing tenant ${tenant.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Clean up stale entries for tenants that are now hidden or have no visible animals
  await cleanupStaleIndexEntries(tenants.map((t) => t.id));

  const duration = Date.now() - startTime;
  console.log(
    `[network-search-index] Rebuild complete: ${indexed} tenants indexed, ${errors} errors, ${duration}ms`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-Tenant Index Rebuild
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rebuild index entries for a single tenant.
 * Groups animals by species+sex and aggregates traits.
 */
export async function rebuildTenantIndex(tenantId: number): Promise<void> {
  // Get distinct species/sex combos for visible animals
  const groups = await prisma.animal.groupBy({
    by: ["species", "sex"],
    where: {
      tenantId,
      networkSearchVisible: true,
      status: "ACTIVE",
      deletedAt: null,
    },
    _count: { id: true },
  });

  // Get the set of species/sex combos we're about to upsert (for cleanup)
  const activeKeys = new Set(groups.map((g) => `${g.species}:${g.sex}`));

  for (const group of groups) {
    const traits = await aggregateTraitsForGroup(
      tenantId,
      group.species,
      group.sex
    );

    await prisma.networkSearchIndex.upsert({
      where: {
        tenantId_species_sex: {
          tenantId,
          species: group.species,
          sex: group.sex,
        },
      },
      update: {
        geneticTraits: traits.genetics as Prisma.InputJsonValue,
        physicalTraits: traits.physical as Prisma.InputJsonValue ?? Prisma.JsonNull,
        healthClearances: traits.health as Prisma.InputJsonValue,
        animalCount: group._count.id,
        lastRebuiltAt: new Date(),
      },
      create: {
        tenantId,
        species: group.species,
        sex: group.sex,
        geneticTraits: traits.genetics as Prisma.InputJsonValue,
        physicalTraits: traits.physical as Prisma.InputJsonValue ?? Prisma.JsonNull,
        healthClearances: traits.health as Prisma.InputJsonValue,
        animalCount: group._count.id,
      },
    });
  }

  // Remove stale index entries for species/sex combos that no longer have visible animals
  const existing = await prisma.networkSearchIndex.findMany({
    where: { tenantId },
    select: { id: true, species: true, sex: true },
  });

  const staleIds = existing
    .filter((e) => !activeKeys.has(`${e.species}:${e.sex}`))
    .map((e) => e.id);

  if (staleIds.length > 0) {
    await prisma.networkSearchIndex.deleteMany({
      where: { id: { in: staleIds } },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trait Aggregation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate genetic traits, health clearances, and physical traits
 * for a tenant/species/sex group using the normalized AnimalLoci table.
 */
async function aggregateTraitsForGroup(
  tenantId: number,
  species: Species,
  sex: Sex
): Promise<AggregatedTraits> {
  // Get animal IDs in this group
  const animals = await prisma.animal.findMany({
    where: {
      tenantId,
      species,
      sex,
      networkSearchVisible: true,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  });

  const animalIds = animals.map((a) => a.id);

  if (animalIds.length === 0) {
    return { genetics: {}, physical: null, health: {} };
  }

  // Aggregate from AnimalLoci (normalized genetics table)
  const loci = await prisma.animalLoci.findMany({
    where: {
      animalId: { in: animalIds },
      genotype: { not: null },
    },
    select: {
      category: true,
      locus: true,
      genotype: true,
    },
  });

  const genetics: Record<string, Set<string>> = {};
  const health: Record<string, Set<string>> = {};

  // Species-specific loci to index (or index all if species not in list)
  const speciesLoci = INDEXED_LOCI[species] ?? [];

  for (const row of loci) {
    if (!row.genotype) continue;

    // Only index loci that are in the species-specific list (if defined)
    if (speciesLoci.length > 0 && !speciesLoci.includes(row.locus)) continue;

    if (row.category === "health") {
      // Health clearances go into a separate bucket
      if (!health[row.locus]) health[row.locus] = new Set();
      health[row.locus].add(row.genotype);
    } else {
      // Everything else (coatColor, physicalTraits, etc.) goes into genetics
      if (!genetics[row.locus]) genetics[row.locus] = new Set();
      genetics[row.locus].add(row.genotype);
    }
  }

  // Aggregate physical traits from AnimalGenetics JSON
  const physicalTraits = await aggregatePhysicalTraits(animalIds);

  return {
    genetics: setMapToArrayMap(genetics),
    physical: physicalTraits,
    health: setMapToArrayMap(health),
  };
}

/**
 * Aggregate physical traits (height, registries) from AnimalGenetics data.
 */
async function aggregatePhysicalTraits(
  animalIds: number[]
): Promise<Record<string, unknown> | null> {
  const geneticsRecords = await prisma.animalGenetics.findMany({
    where: { animalId: { in: animalIds } },
    select: { physicalTraitsData: true },
  });

  const heights: number[] = [];
  const registries = new Set<string>();

  for (const record of geneticsRecords) {
    if (!record.physicalTraitsData) continue;

    const data = record.physicalTraitsData as Record<string, unknown>;

    // Extract height if stored in physical traits
    for (const value of Object.values(data)) {
      const trait = value as Record<string, unknown> | null;
      if (!trait) continue;

      // Height data might be stored as a number or in a sub-object
      if (typeof trait === "object" && "height" in trait) {
        const h = trait.height;
        if (typeof h === "number" && h > 0) heights.push(h);
      }
    }
  }

  // Also get registries from animal registry identifiers (join through Registry)
  const regRecords = await prisma.animalRegistryIdentifier.findMany({
    where: { animalId: { in: animalIds } },
    select: { registry: { select: { name: true } } },
    distinct: ["registryId"],
  });

  for (const reg of regRecords) {
    if (reg.registry.name) registries.add(reg.registry.name);
  }

  if (heights.length === 0 && registries.size === 0) return null;

  return {
    ...(heights.length > 0
      ? { heightRange: [Math.min(...heights), Math.max(...heights)] }
      : {}),
    ...(registries.size > 0
      ? { registries: Array.from(registries) }
      : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search the network index for breeders matching the given criteria.
 * Returns breeder-level matches only — NEVER animal IDs or specific genotypes.
 */
export async function searchNetwork(
  criteria: NetworkSearchCriteria
): Promise<NetworkSearchResponse> {
  // Build WHERE conditions for the index query
  const where: Prisma.NetworkSearchIndexWhereInput = {
    species: criteria.species,
    sex: criteria.sex,
    tenant: {
      networkVisibility: { not: "HIDDEN" },
    },
  };

  // Fetch all matching index entries (species+sex+visible tenant)
  const entries = await prisma.networkSearchIndex.findMany({
    where,
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
          networkVisibility: true,
        },
      },
    },
  });

  // Apply JSONB-level filtering in application code
  // (Prisma doesn't support JSONB ?| operator natively)
  const results: NetworkSearchResult[] = [];

  for (const entry of entries) {
    const matchedCategories: string[] = [];
    let matchesAll = true;

    // Check genetic criteria
    if (criteria.genetics && criteria.genetics.length > 0) {
      const geneticTraits = entry.geneticTraits as Record<string, string[]>;

      for (const criterion of criteria.genetics) {
        const availableGenotypes = geneticTraits[criterion.locus];
        if (!availableGenotypes) {
          matchesAll = false;
          break;
        }

        const hasMatch = criterion.acceptableGenotypes.some((g) =>
          availableGenotypes.includes(g)
        );

        if (!hasMatch) {
          matchesAll = false;
          break;
        }

        // Determine category label for display
        const categoryLabel = getCategoryLabelForLocus(
          criterion.locus,
          criteria.species
        );
        if (!matchedCategories.includes(categoryLabel)) {
          matchedCategories.push(categoryLabel);
        }
      }
    }

    if (!matchesAll) continue;

    // Check health criteria
    if (criteria.health && criteria.health.length > 0) {
      const healthClearances =
        (entry.healthClearances as Record<string, string[]>) ?? {};

      for (const criterion of criteria.health) {
        const availableStatuses = healthClearances[criterion.test];
        if (!availableStatuses) {
          matchesAll = false;
          break;
        }

        const hasMatch = criterion.acceptableStatuses.some((s) =>
          availableStatuses.includes(s)
        );

        if (!hasMatch) {
          matchesAll = false;
          break;
        }

        if (!matchedCategories.includes(`${criterion.test} status`)) {
          matchedCategories.push(`${criterion.test} status`);
        }
      }
    }

    if (!matchesAll) continue;

    // Check physical criteria
    if (criteria.physical) {
      const physicalTraits =
        (entry.physicalTraits as Record<string, unknown>) ?? {};

      if (
        criteria.physical.minHeight != null ||
        criteria.physical.maxHeight != null
      ) {
        const heightRange = physicalTraits.heightRange as
          | [number, number]
          | undefined;

        if (heightRange) {
          const [minH, maxH] = heightRange;
          if (
            criteria.physical.minHeight != null &&
            maxH < criteria.physical.minHeight
          ) {
            continue;
          }
          if (
            criteria.physical.maxHeight != null &&
            minH > criteria.physical.maxHeight
          ) {
            continue;
          }
          if (!matchedCategories.includes("size/height")) {
            matchedCategories.push("size/height");
          }
        } else {
          // No height data — skip if height was required
          continue;
        }
      }

      if (
        criteria.physical.registries &&
        criteria.physical.registries.length > 0
      ) {
        const registries =
          (physicalTraits.registries as string[]) ?? [];
        const hasRegistry = criteria.physical.registries.some((r) =>
          registries.includes(r)
        );
        if (!hasRegistry) continue;

        if (!matchedCategories.includes("registry")) {
          matchedCategories.push("registry");
        }
      }
    }

    // Respect visibility: ANONYMOUS → mask name and location
    const isAnonymous = entry.tenant.networkVisibility === "ANONYMOUS";

    results.push({
      tenantId: entry.tenant.id,
      breederName: isAnonymous ? "A breeder" : (entry.tenant.name ?? "Unknown"),
      breederLocation: isAnonymous
        ? null
        : formatLocation(entry.tenant.city, entry.tenant.region),
      matchCount: entry.animalCount,
      matchedCategories,
    });
  }

  // Sort by match count descending
  results.sort((a, b) => b.matchCount - a.matchCount);

  return {
    results,
    totalBreeders: results.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Incremental Update (triggered when animal genetics change)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-index a single tenant/species/sex combo.
 * Call this when an animal's genetics, visibility, or status changes.
 */
export async function reindexAnimal(animalId: number): Promise<void> {
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    select: { tenantId: true, species: true, sex: true },
  });

  if (!animal) return;

  // Check if tenant is visible
  const tenant = await prisma.tenant.findUnique({
    where: { id: animal.tenantId },
    select: { networkVisibility: true },
  });

  if (!tenant || tenant.networkVisibility === "HIDDEN") return;

  // Re-aggregate just this species/sex group
  await rebuildTenantIndex(animal.tenantId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove stale index entries for tenants that no longer have visible animals.
 */
async function cleanupStaleIndexEntries(
  activeTenantIds: number[]
): Promise<void> {
  if (activeTenantIds.length === 0) {
    // No active tenants — delete all index entries
    const deleted = await prisma.networkSearchIndex.deleteMany({});
    if (deleted.count > 0) {
      console.log(
        `[network-search-index] Cleaned up ${deleted.count} stale entries (no active tenants)`
      );
    }
    return;
  }

  const deleted = await prisma.networkSearchIndex.deleteMany({
    where: {
      tenantId: { notIn: activeTenantIds },
    },
  });

  if (deleted.count > 0) {
    console.log(
      `[network-search-index] Cleaned up ${deleted.count} stale entries`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert Record<string, Set<string>> to Record<string, string[]> */
function setMapToArrayMap(
  map: Record<string, Set<string>>
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k, Array.from(v)])
  );
}

/** Format city + region into a location string */
function formatLocation(
  city: string | null,
  region: string | null
): string | null {
  if (city && region) return `${city}, ${region}`;
  return city ?? region ?? null;
}

/**
 * Map a locus to a human-readable category label for search results.
 * These labels are what the searcher sees ("coat genetics", "HYPP status").
 */
function getCategoryLabelForLocus(locus: string, species: Species): string {
  // Health-specific loci
  const healthLoci: Record<string, string[]> = {
    DOG: ["MDR1", "DM", "PRA"],
    HORSE: ["HYPP", "GBED", "HERDA"],
    CAT: ["PKD", "HCM"],
    SHEEP: ["SCRAPIE", "SPIDER"],
    GOAT: ["SCRAPIE"],
    CATTLE: ["TH", "PHA"],
    PIG: ["RYR1"],
  };

  const speciesHealthLoci = healthLoci[species] ?? [];
  if (speciesHealthLoci.includes(locus)) {
    return `${locus} status`;
  }

  // Performance loci
  const performanceLoci: Record<string, string[]> = {
    HORSE: ["MSTN", "DMRT3"],
    PIG: ["IGF2"],
  };

  const speciesPerfLoci = performanceLoci[species] ?? [];
  if (speciesPerfLoci.includes(locus)) {
    return "performance genetics";
  }

  // Default: coat/color genetics
  return "coat genetics";
}
