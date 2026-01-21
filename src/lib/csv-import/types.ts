/**
 * CSV Import Module - Type Definitions
 *
 * Defines types for animal CSV import functionality
 */

import type { Species, Sex, AnimalStatus } from "@prisma/client";

/**
 * Raw data from a single CSV row (before parsing/validation)
 */
export interface RawAnimalRow {
  Name?: string;
  Species?: string;
  Sex?: string;
  "Birth Date"?: string;
  Microchip?: string;
  Breed?: string;
  "Dam Name"?: string;
  "Sire Name"?: string;
  "Registry Name"?: string;
  "Registry Number"?: string;
  Status?: string;
  Notes?: string;
}

/**
 * Parsed animal data (after validation and normalization)
 */
export interface ParsedAnimalData {
  name: string;
  species: Species;
  sex: Sex;
  birthDate?: Date | null;
  microchip?: string | null;
  breed?: string | null;
  damName?: string | null;
  sireName?: string | null;
  registryName?: string | null;
  registryNumber?: string | null;
  status?: AnimalStatus | null;
  notes?: string | null;
}

/**
 * Validation status for a single row
 */
export type RowStatus = "valid" | "warning" | "error";

/**
 * Warning types that require user resolution
 */
export type WarningType =
  | "duplicate"           // Animal already exists
  | "parent_not_found"    // Dam or Sire name not found
  | "breed_not_found";    // Breed name not recognized

/**
 * Duplicate animal match information
 */
export interface DuplicateMatch {
  id: number;
  name: string;
  species: string;
  sex: string;
  birthDate: Date | null;
  breed: string | null;
  microchip: string | null;
  photoUrl: string | null;
  status: string;
}

/**
 * Suggested animal for parent matching
 */
export interface ParentSuggestion {
  id: number;
  name: string;
  species: string;
  breed: string | null;
  birthDate: Date | null;
  matchScore: number;  // 0-1, fuzzy match score
}

/**
 * Single parsed row with validation results
 */
export interface ParsedRow {
  rowNumber: number;
  status: RowStatus;
  data: ParsedAnimalData;

  // For warnings
  warningType?: WarningType;
  parentField?: "dam" | "sire";
  duplicateMatch?: DuplicateMatch;
  suggestions?: ParentSuggestion[];

  // For errors
  errors?: string[];
}

/**
 * Complete preview response
 */
export interface ImportPreviewResponse {
  summary: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
  };
  rows: ParsedRow[];
}

/**
 * User resolution for a warning row
 */
export interface RowResolution {
  rowNumber: number;

  // For duplicates
  action?: "update" | "skip" | "create_new";
  existingAnimalId?: number;

  // For parent not found
  parentField?: "dam" | "sire";
  parentAction?: "link" | "skip" | "create_placeholder";
  selectedAnimalId?: number;

  // For breed not found
  breedAction?: "select" | "create_custom" | "skip";
  selectedBreedId?: number;
  customBreedName?: string;
}

/**
 * Import execution request
 */
export interface ImportExecuteRequest {
  fileContent: string;  // Base64 encoded CSV
  resolutions: RowResolution[];
}

/**
 * Import execution response
 */
export interface ImportExecuteResponse {
  success: boolean;
  summary: {
    imported: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  importedAnimals: Array<{
    rowNumber: number;
    animalId: number;
    name: string;
  }>;
  updatedAnimals: Array<{
    rowNumber: number;
    animalId: number;
    name: string;
  }>;
  skippedRows: number[];
  placeholdersCreated: Array<{
    name: string;
    animalId: number;
  }>;
}
