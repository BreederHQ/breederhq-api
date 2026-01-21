/**
 * Animal Import Service
 *
 * Handles animal CSV import with duplicate detection and parent matching
 */

import prisma from "../prisma.js";
import type {
  ParsedAnimalData,
  ParsedRow,
  DuplicateMatch,
  ParentSuggestion,
  ImportPreviewResponse,
  RowResolution,
  ImportExecuteResponse,
} from "../lib/csv-import/types.js";
import type { Species } from "@prisma/client";

/**
 * String similarity score (0-1) using Levenshtein distance
 * Simple implementation for fuzzy matching
 */
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2[i - 1] === s1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Checks for duplicate animals in the database
 * Returns matching animals if found
 */
export async function findDuplicates(
  tenantId: number,
  data: ParsedAnimalData
): Promise<DuplicateMatch | null> {
  const { name, species, sex, birthDate, microchip } = data;

  // Find exact matches on name + species + sex
  const candidates = await prisma.animal.findMany({
    where: {
      tenantId,
      archived: false,
      name: {
        equals: name,
        mode: "insensitive",
      },
      species,
      sex,
    },
    select: {
      id: true,
      name: true,
      species: true,
      sex: true,
      birthDate: true,
      breed: true,
      microchip: true,
      photoUrl: true,
      status: true,
    },
    take: 5,
  });

  if (candidates.length === 0) return null;

  // If birth date provided, find exact match
  if (birthDate) {
    const exactMatch = candidates.find((c) => {
      if (!c.birthDate) return false;
      return c.birthDate.toISOString().split("T")[0] === birthDate.toISOString().split("T")[0];
    });

    if (exactMatch) {
      return {
        id: exactMatch.id,
        name: exactMatch.name,
        species: exactMatch.species,
        sex: exactMatch.sex,
        birthDate: exactMatch.birthDate,
        breed: exactMatch.breed,
        microchip: exactMatch.microchip,
        photoUrl: exactMatch.photoUrl,
        status: exactMatch.status,
      };
    }
  }

  // If microchip provided, check for match
  if (microchip) {
    const microchipMatch = candidates.find((c) => c.microchip === microchip);
    if (microchipMatch) {
      return {
        id: microchipMatch.id,
        name: microchipMatch.name,
        species: microchipMatch.species,
        sex: microchipMatch.sex,
        birthDate: microchipMatch.birthDate,
        breed: microchipMatch.breed,
        microchip: microchipMatch.microchip,
        photoUrl: microchipMatch.photoUrl,
        status: microchipMatch.status,
      };
    }
  }

  // Return first match as likely duplicate
  const match = candidates[0];
  return {
    id: match.id,
    name: match.name,
    species: match.species,
    sex: match.sex,
    birthDate: match.birthDate,
    breed: match.breed,
    microchip: match.microchip,
    photoUrl: match.photoUrl,
    status: match.status,
  };
}

/**
 * Finds potential parent animals by name with fuzzy matching
 */
export async function findParentSuggestions(
  tenantId: number,
  parentName: string,
  species: Species,
  sex: "FEMALE" | "MALE"
): Promise<ParentSuggestion[]> {
  // Search for animals with similar names
  const animals = await prisma.animal.findMany({
    where: {
      tenantId,
      archived: false,
      species,
      sex,
    },
    select: {
      id: true,
      name: true,
      species: true,
      breed: true,
      birthDate: true,
    },
    take: 100, // Get a larger set for fuzzy matching
  });

  // Calculate similarity scores
  const suggestions = animals
    .map((animal) => ({
      ...animal,
      matchScore: similarity(parentName, animal.name),
    }))
    .filter((s) => s.matchScore > 0.6) // Only show good matches
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5); // Top 5 suggestions

  return suggestions;
}

/**
 * Enhances parsed rows with database checks (duplicates, parent matching)
 */
export async function enhanceWithDatabaseChecks(
  tenantId: number,
  parsedRows: ParsedRow[]
): Promise<ParsedRow[]> {
  const enhanced: ParsedRow[] = [];

  for (const row of parsedRows) {
    // Skip error rows (already invalid)
    if (row.status === "error") {
      enhanced.push(row);
      continue;
    }

    const data = row.data;
    let status = row.status;
    let warningType = row.warningType;
    let duplicateMatch = row.duplicateMatch;
    let parentField = row.parentField;
    let suggestions = row.suggestions;

    // Check for duplicates
    const duplicate = await findDuplicates(tenantId, data);
    if (duplicate) {
      status = "warning";
      warningType = "duplicate";
      duplicateMatch = duplicate;
    }

    // Check for parent (dam) not found
    if (data.damName && !warningType) {
      const damSuggestions = await findParentSuggestions(
        tenantId,
        data.damName,
        data.species,
        "FEMALE"
      );

      // If no exact match found
      const exactMatch = damSuggestions.find((s) => s.matchScore === 1.0);
      if (!exactMatch) {
        status = "warning";
        warningType = "parent_not_found";
        parentField = "dam";
        suggestions = damSuggestions;
      }
    }

    // Check for parent (sire) not found
    if (data.sireName && !warningType) {
      const sireSuggestions = await findParentSuggestions(
        tenantId,
        data.sireName,
        data.species,
        "MALE"
      );

      const exactMatch = sireSuggestions.find((s) => s.matchScore === 1.0);
      if (!exactMatch) {
        status = "warning";
        warningType = "parent_not_found";
        parentField = "sire";
        suggestions = sireSuggestions;
      }
    }

    enhanced.push({
      ...row,
      status,
      warningType,
      duplicateMatch,
      parentField,
      suggestions,
    });
  }

  return enhanced;
}

/**
 * Generates preview response with summary
 */
export function generatePreviewResponse(rows: ParsedRow[]): ImportPreviewResponse {
  const validRows = rows.filter((r) => r.status === "valid").length;
  const warningRows = rows.filter((r) => r.status === "warning").length;
  const errorRows = rows.filter((r) => r.status === "error").length;

  return {
    summary: {
      totalRows: rows.length,
      validRows,
      warningRows,
      errorRows,
    },
    rows,
  };
}

/**
 * Executes the import with user resolutions
 */
export async function executeImport(
  tenantId: number,
  organizationId: number | null,
  parsedRows: ParsedRow[],
  resolutions: RowResolution[]
): Promise<ImportExecuteResponse> {
  const result: ImportExecuteResponse = {
    success: true,
    summary: {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    },
    importedAnimals: [],
    updatedAnimals: [],
    skippedRows: [],
    placeholdersCreated: [],
  };

  // Build resolution map
  const resolutionMap = new Map<number, RowResolution>();
  for (const resolution of resolutions) {
    resolutionMap.set(resolution.rowNumber, resolution);
  }

  for (const row of parsedRows) {
    // Skip error rows
    if (row.status === "error") {
      result.skippedRows.push(row.rowNumber);
      result.summary.skipped++;
      continue;
    }

    const resolution = resolutionMap.get(row.rowNumber);
    const data = row.data;

    // Handle warnings with resolutions
    if (row.status === "warning") {
      if (!resolution) {
        // No resolution provided, skip
        result.skippedRows.push(row.rowNumber);
        result.summary.skipped++;
        continue;
      }

      // Handle duplicate resolution
      if (row.warningType === "duplicate") {
        if (resolution.action === "skip") {
          result.skippedRows.push(row.rowNumber);
          result.summary.skipped++;
          continue;
        } else if (resolution.action === "update") {
          // Update existing animal
          const animalId = resolution.existingAnimalId!;
          await prisma.animal.update({
            where: { id: animalId },
            data: {
              birthDate: data.birthDate,
              microchip: data.microchip,
              breed: data.breed,
              status: data.status,
              notes: data.notes,
            },
          });

          result.updatedAnimals.push({
            rowNumber: row.rowNumber,
            animalId,
            name: data.name,
          });
          result.summary.updated++;
          continue;
        }
        // If action === "create_new", fall through to create
      }

      // Handle parent not found resolution
      if (row.warningType === "parent_not_found") {
        if (resolution.parentAction === "skip") {
          // Clear the parent name and continue with import
          if (resolution.parentField === "dam") {
            data.damName = null;
          } else {
            data.sireName = null;
          }
        } else if (resolution.parentAction === "link") {
          // Link will be handled below when creating animal
          // Just continue
        } else if (resolution.parentAction === "create_placeholder") {
          // Create placeholder parent
          const parentName = resolution.parentField === "dam" ? data.damName : data.sireName;
          const parentSex = resolution.parentField === "dam" ? "FEMALE" : "MALE";

          const placeholder = await prisma.animal.create({
            data: {
              tenantId,
              organizationId,
              name: parentName!,
              species: data.species,
              sex: parentSex,
              status: "PROSPECT",
              notes: "Created as placeholder during import",
            },
          });

          result.placeholdersCreated.push({
            name: parentName!,
            animalId: placeholder.id,
          });

          // Link to placeholder
          if (resolution.parentField === "dam") {
            data.damName = null; // Clear name, we'll use ID
          } else {
            data.sireName = null;
          }
        }
      }
    }

    // Find parent IDs
    let damId: number | null = null;
    let sireId: number | null = null;

    if (data.damName) {
      const dam = await prisma.animal.findFirst({
        where: {
          tenantId,
          archived: false,
          name: { equals: data.damName, mode: "insensitive" },
          species: data.species,
          sex: "FEMALE",
        },
        select: { id: true },
      });
      damId = dam?.id ?? null;
    }

    if (resolution?.parentAction === "link" && resolution.parentField === "dam") {
      damId = resolution.selectedAnimalId!;
    }

    if (data.sireName) {
      const sire = await prisma.animal.findFirst({
        where: {
          tenantId,
          archived: false,
          name: { equals: data.sireName, mode: "insensitive" },
          species: data.species,
          sex: "MALE",
        },
        select: { id: true },
      });
      sireId = sire?.id ?? null;
    }

    if (resolution?.parentAction === "link" && resolution.parentField === "sire") {
      sireId = resolution.selectedAnimalId!;
    }

    // Create the animal
    const animal = await prisma.animal.create({
      data: {
        tenantId,
        organizationId,
        name: data.name,
        species: data.species,
        sex: data.sex,
        birthDate: data.birthDate,
        microchip: data.microchip,
        breed: data.breed,
        damId,
        sireId,
        status: data.status ?? "ACTIVE",
        notes: data.notes,
      },
    });

    // Create registry identifier if provided
    if (data.registryName && data.registryNumber) {
      // Find or create registry
      let registry = await prisma.registry.findFirst({
        where: {
          name: { equals: data.registryName, mode: "insensitive" },
        },
      });

      if (!registry) {
        registry = await prisma.registry.create({
          data: {
            name: data.registryName,
            species: data.species,
          },
        });
      }

      // Create the identifier
      await prisma.animalRegistryIdentifier.create({
        data: {
          animalId: animal.id,
          registryId: registry.id,
          identifier: data.registryNumber,
        },
      });
    }

    result.importedAnimals.push({
      rowNumber: row.rowNumber,
      animalId: animal.id,
      name: animal.name,
    });
    result.summary.imported++;
  }

  return result;
}
