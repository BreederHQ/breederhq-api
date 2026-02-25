// src/services/lineage-service.ts
// Pedigree tree building and COI (Coefficient of Inbreeding) calculation
// using Wright's path coefficient method

import prisma from "../prisma.js";
import { Prisma } from "@prisma/client";

/* ─────────────────────────────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────────────────────────────── */

export interface PedigreeNode {
  id: number;
  name: string;
  sex: "FEMALE" | "MALE";
  species: string;
  breed: string | null;
  photoUrl: string | null;
  birthDate: string | null;
  coiPercent: number | null;
  titlePrefix: string | null;
  titleSuffix: string | null;
  sireId: number | null;
  damId: number | null;
  // Achievement stats
  titleCount: number;
  competitionCount: number;
  hasVerifiedTitles: boolean;
  dam: PedigreeNode | null;
  sire: PedigreeNode | null;
}

export interface COIResult {
  /** Coefficient as decimal (0.0 to 1.0) - multiply by 100 for percentage */
  coefficient: number;
  /** Number of generations analyzed */
  generationsAnalyzed: number;
  /** Common ancestors and their contribution to inbreeding */
  commonAncestors: Array<{
    id: number;
    name: string;
    pathCount: number;
    contribution: number;
  }>;
  /** Risk level based on coefficient */
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
}

export interface DescendantNode {
  id: number;
  name: string;
  sex: "FEMALE" | "MALE" | "UNKNOWN";
  species: string;
  breed: string | null;
  photoUrl: string | null;
  birthDate: string | null;
  /** The other parent (dam if this animal is sire, sire if this animal is dam) */
  otherParent: { id: number; name: string } | null;
  children: DescendantNode[];
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Internal helpers
 * ───────────────────────────────────────────────────────────────────────────── */

type AnimalRow = {
  id: number;
  name: string;
  sex: "FEMALE" | "MALE";
  species: string;
  breed: string | null;
  photoUrl: string | null;
  birthDate: Date | null;
  coiPercent: number | null;
  titlePrefix: string | null;
  titleSuffix: string | null;
  damId: number | null;
  sireId: number | null;
  // Achievement stats
  _count: {
    titles: number;
    competitionEntries: number;
  };
  hasVerifiedTitles: boolean;
};

const animalSelect = {
  id: true,
  name: true,
  sex: true,
  species: true,
  breed: true,
  photoUrl: true,
  birthDate: true,
  coiPercent: true,
  titlePrefix: true,
  titleSuffix: true,
  damId: true,
  sireId: true,
  _count: {
    select: {
      titles: true,
      competitionEntries: true,
    },
  },
} as const;

/**
 * Check if animal has any verified titles
 */
async function checkVerifiedTitles(animalId: number): Promise<boolean> {
  const verified = await prisma.animalTitle.findFirst({
    where: { animalId, verified: true },
    select: { id: true },
  });
  return !!verified;
}

/**
 * Recursively build ancestor tree to specified depth
 */
async function buildAncestorTree(
  animalId: number,
  tenantId: number,
  depth: number,
  cache: Map<number, AnimalRow>
): Promise<PedigreeNode | null> {
  if (depth <= 0) return null;

  let animal = cache.get(animalId);
  if (!animal) {
    const row = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
      select: animalSelect,
    });
    if (!row) return null;

    // Check for verified titles
    const hasVerified = await checkVerifiedTitles(row.id);

    animal = {
      ...row,
      hasVerifiedTitles: hasVerified,
    } as AnimalRow;
    cache.set(animalId, animal);
  }

  const [dam, sire] = await Promise.all([
    animal.damId ? buildAncestorTree(animal.damId, tenantId, depth - 1, cache) : null,
    animal.sireId ? buildAncestorTree(animal.sireId, tenantId, depth - 1, cache) : null,
  ]);

  return {
    id: animal.id,
    name: animal.name,
    sex: animal.sex,
    species: animal.species,
    breed: animal.breed,
    photoUrl: animal.photoUrl,
    birthDate: animal.birthDate?.toISOString().slice(0, 10) ?? null,
    coiPercent: animal.coiPercent,
    titlePrefix: animal.titlePrefix,
    titleSuffix: animal.titleSuffix,
    sireId: animal.sireId,
    damId: animal.damId,
    titleCount: animal._count?.titles ?? 0,
    competitionCount: animal._count?.competitionEntries ?? 0,
    hasVerifiedTitles: animal.hasVerifiedTitles ?? false,
    dam,
    sire,
  };
}

/**
 * Collect all ancestors for an animal into a map (id -> generation distances)
 * Uses a single recursive CTE instead of N+1 individual queries.
 */
async function collectAncestors(
  animalId: number | null,
  tenantId: number,
  maxGenerations: number,
  cache: Map<number, AnimalRow>
): Promise<Map<number, number[]>> {
  const ancestors = new Map<number, number[]>();
  if (!animalId) return ancestors;

  const rows = await prisma.$queryRaw<
    Array<{ id: number; name: string; generation: number }>
  >(Prisma.sql`
    WITH RECURSIVE ancestors AS (
      SELECT p.id, p.name, p."damId", p."sireId", 1 AS generation
      FROM "Animal" start
      JOIN "Animal" p ON p.id IN (start."damId", start."sireId")
      WHERE start.id = ${animalId}
        AND start."tenantId" = ${tenantId}
        AND p."tenantId" = ${tenantId}

      UNION ALL

      SELECT p.id, p.name, p."damId", p."sireId", a.generation + 1
      FROM ancestors a
      JOIN "Animal" p ON p.id IN (a."damId", a."sireId")
      WHERE a.generation < ${maxGenerations}
        AND p."tenantId" = ${tenantId}
    )
    SELECT id, name, generation FROM ancestors
  `);

  for (const row of rows) {
    const existing = ancestors.get(row.id) || [];
    existing.push(row.generation);
    ancestors.set(row.id, existing);

    // Populate cache for name lookups in calculateCOI
    if (!cache.has(row.id)) {
      cache.set(row.id, { id: row.id, name: row.name } as AnimalRow);
    }
  }

  return ancestors;
}

/**
 * Wright's Coefficient of Inbreeding calculation
 *
 * F = Σ (0.5)^(n1+n2+1) × (1 + Fa)
 *
 * Where:
 * - n1 = generations from sire to common ancestor
 * - n2 = generations from dam to common ancestor
 * - Fa = inbreeding coefficient of common ancestor (simplified to 0 here)
 *
 * This finds all paths through common ancestors and sums their contributions.
 */
async function calculateCOI(
  damId: number | null,
  sireId: number | null,
  tenantId: number,
  generations: number
): Promise<COIResult> {
  if (!damId || !sireId) {
    return {
      coefficient: 0,
      generationsAnalyzed: generations,
      commonAncestors: [],
      riskLevel: "LOW",
    };
  }

  const cache = new Map<number, AnimalRow>();

  // Get ancestors from both sides
  const [damAncestors, sireAncestors] = await Promise.all([
    collectAncestors(damId, tenantId, generations, cache),
    collectAncestors(sireId, tenantId, generations, cache),
  ]);

  // Find common ancestors (appear in both lineages)
  const commonAncestorContributions: Array<{
    id: number;
    name: string;
    pathCount: number;
    contribution: number;
  }> = [];

  let totalCOI = 0;

  for (const [ancestorId, damGenerations] of damAncestors) {
    const sireGenerations = sireAncestors.get(ancestorId);
    if (!sireGenerations) continue;

    // This ancestor appears in both lineages - calculate contribution
    // For each path combination through this ancestor
    let ancestorContribution = 0;
    let pathCount = 0;

    for (const n1 of damGenerations) {
      for (const n2 of sireGenerations) {
        // Wright's formula: (0.5)^(n1+n2+1)
        // Note: We're measuring from parent, so add 1 to account for
        // the path going through the common ancestor
        const pathLength = n1 + n2 + 1;
        const contribution = Math.pow(0.5, pathLength);
        ancestorContribution += contribution;
        pathCount++;
      }
    }

    if (ancestorContribution > 0) {
      totalCOI += ancestorContribution;
      const animal = cache.get(ancestorId);
      commonAncestorContributions.push({
        id: ancestorId,
        name: animal?.name || `Animal #${ancestorId}`,
        pathCount,
        contribution: ancestorContribution,
      });
    }
  }

  // Sort by contribution (highest first)
  commonAncestorContributions.sort((a, b) => b.contribution - a.contribution);

  // Determine risk level
  let riskLevel: COIResult["riskLevel"];
  if (totalCOI < 0.05) {
    riskLevel = "LOW";
  } else if (totalCOI < 0.10) {
    riskLevel = "MODERATE";
  } else if (totalCOI < 0.25) {
    riskLevel = "HIGH";
  } else {
    riskLevel = "CRITICAL";
  }

  return {
    coefficient: totalCOI,
    generationsAnalyzed: generations,
    commonAncestors: commonAncestorContributions,
    riskLevel,
  };
}

/**
 * Build descendant tree (children, grandchildren, etc.)
 */
async function buildDescendantTree(
  animalId: number,
  tenantId: number,
  depth: number,
  parentRole: "dam" | "sire"
): Promise<DescendantNode[]> {
  if (depth <= 0) return [];

  const whereClause =
    parentRole === "dam" ? { damId: animalId, tenantId } : { sireId: animalId, tenantId };

  const children = await prisma.animal.findMany({
    where: whereClause,
    select: {
      ...animalSelect,
      dam: { select: { id: true, name: true } },
      sire: { select: { id: true, name: true } },
    },
    orderBy: { birthDate: "desc" },
  });

  const results: DescendantNode[] = [];

  for (const child of children) {
    // Get the other parent (not the one we're descending from)
    const otherParent = parentRole === "dam" ? child.sire : child.dam;

    // Recursively get this child's descendants (they could be either dam or sire)
    const childRole = child.sex === "FEMALE" ? "dam" : "sire";
    const grandchildren = await buildDescendantTree(child.id, tenantId, depth - 1, childRole);

    results.push({
      id: child.id,
      name: child.name,
      sex: child.sex,
      species: child.species,
      breed: child.breed,
      photoUrl: child.photoUrl,
      birthDate: child.birthDate?.toISOString().slice(0, 10) ?? null,
      otherParent: otherParent ? { id: otherParent.id, name: otherParent.name } : null,
      children: grandchildren,
    });
  }

  return results;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Public API
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Get pedigree tree for an animal (ancestors)
 */
export async function getPedigree(
  animalId: number,
  tenantId: number,
  generations: number = 5
): Promise<{ pedigree: PedigreeNode | null; coi: COIResult }> {
  const cache = new Map<number, AnimalRow>();
  const pedigree = await buildAncestorTree(animalId, tenantId, generations + 1, cache);

  // Calculate COI for this animal
  const animal = cache.get(animalId);
  const coi = await calculateCOI(animal?.damId ?? null, animal?.sireId ?? null, tenantId, generations);

  return { pedigree, coi };
}

/**
 * Get descendants tree for an animal (offspring, grandoffspring, etc.)
 */
export async function getDescendants(
  animalId: number,
  tenantId: number,
  generations: number = 3
): Promise<{ animal: { id: number; name: string; sex: string }; descendants: DescendantNode[] }> {
  const animal = await prisma.animal.findFirst({
    where: { id: animalId, tenantId },
    select: { id: true, name: true, sex: true },
  });

  if (!animal) {
    throw Object.assign(new Error("animal_not_found"), { statusCode: 404 });
  }

  const parentRole = animal.sex === "FEMALE" ? "dam" : "sire";
  const descendants = await buildDescendantTree(animalId, tenantId, generations, parentRole);

  return {
    animal: { id: animal.id, name: animal.name, sex: animal.sex },
    descendants,
  };
}

/**
 * Calculate prospective COI for a hypothetical breeding
 * (before actually breeding the animals)
 */
export async function getProspectiveCOI(
  damId: number,
  sireId: number,
  tenantId: number,
  generations: number = 10
): Promise<COIResult> {
  // Verify both animals exist and belong to tenant
  const [dam, sire] = await Promise.all([
    prisma.animal.findFirst({ where: { id: damId, tenantId }, select: { id: true, sex: true } }),
    prisma.animal.findFirst({ where: { id: sireId, tenantId }, select: { id: true, sex: true } }),
  ]);

  if (!dam) throw Object.assign(new Error("dam_not_found"), { statusCode: 404 });
  if (!sire) throw Object.assign(new Error("sire_not_found"), { statusCode: 404 });

  // Validate sexes
  if (dam.sex !== "FEMALE") {
    throw Object.assign(new Error("dam_must_be_female"), { statusCode: 400 });
  }
  if (sire.sex !== "MALE") {
    throw Object.assign(new Error("sire_must_be_male"), { statusCode: 400 });
  }

  return calculateCOI(damId, sireId, tenantId, generations);
}

/**
 * Update cached COI for an animal
 * Call this when parents change
 */
export async function updateAnimalCOI(
  animalId: number,
  tenantId: number,
  generations: number = 10
): Promise<void> {
  const animal = await prisma.animal.findFirst({
    where: { id: animalId, tenantId },
    select: { damId: true, sireId: true },
  });

  if (!animal) return;

  const coi = await calculateCOI(animal.damId, animal.sireId, tenantId, generations);

  await prisma.animal.update({
    where: { id: animalId },
    data: {
      coiPercent: coi.coefficient,
      coiGenerations: coi.generationsAnalyzed,
      coiCalculatedAt: new Date(),
    },
  });
}

/**
 * Set parents for an animal and recalculate COI
 */
export async function setParents(
  animalId: number,
  tenantId: number,
  damId: number | null,
  sireId: number | null
): Promise<void> {
  // Validate parent animals if provided
  if (damId) {
    const dam = await prisma.animal.findFirst({
      where: { id: damId, tenantId },
      select: { id: true, sex: true },
    });
    if (!dam) throw Object.assign(new Error("dam_not_found"), { statusCode: 404 });
    if (dam.sex !== "FEMALE") {
      throw Object.assign(new Error("dam_must_be_female"), { statusCode: 400 });
    }
  }

  if (sireId) {
    const sire = await prisma.animal.findFirst({
      where: { id: sireId, tenantId },
      select: { id: true, sex: true },
    });
    if (!sire) throw Object.assign(new Error("sire_not_found"), { statusCode: 404 });
    if (sire.sex !== "MALE") {
      throw Object.assign(new Error("sire_must_be_male"), { statusCode: 400 });
    }
  }

  // Prevent circular reference
  if (damId === animalId || sireId === animalId) {
    throw Object.assign(new Error("cannot_be_own_parent"), { statusCode: 400 });
  }

  // Update parents
  await prisma.animal.update({
    where: { id: animalId },
    data: { damId, sireId },
  });

  // Recalculate COI
  await updateAnimalCOI(animalId, tenantId);
}
