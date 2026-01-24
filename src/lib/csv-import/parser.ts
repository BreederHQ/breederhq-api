/**
 * CSV Parser for Animal Imports
 *
 * Parses CSV files and validates animal data
 */

import type { Species, Sex, AnimalStatus } from "@prisma/client";
import type {
  RawAnimalRow,
  ParsedAnimalData,
  ParsedRow,
  RowStatus,
} from "./types.js";

/**
 * Valid enum values
 */
const VALID_SPECIES: Species[] = ["DOG", "CAT", "HORSE", "GOAT", "RABBIT", "SHEEP"];
const VALID_SEX: Sex[] = ["FEMALE", "MALE"];
const VALID_STATUS: AnimalStatus[] = [
  "ACTIVE",
  "BREEDING",
  "UNAVAILABLE",
  "RETIRED",
  "DECEASED",
  "PROSPECT",
];

/**
 * Parses a single CSV line handling quotes and commas properly
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Handle escaped quotes ("")
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parses CSV content into raw rows
 */
function parseCSV(csvContent: string): RawAnimalRow[] {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("CSV file must contain a header row and at least one data row");
  }

  // Parse header row
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // Validate expected headers exist
  const requiredHeaders = ["Name", "Species", "Sex"];
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
  }

  // Parse data rows
  const rows: RawAnimalRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseCSVLine(line);
    const row: RawAnimalRow = {};

    // Map values to headers
    headers.forEach((header, index) => {
      const value = values[index]?.trim();
      if (value) {
        row[header as keyof RawAnimalRow] = value;
      }
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Validates and normalizes species value
 */
function parseSpecies(value: string | undefined): { species: Species | null; error?: string } {
  if (!value) {
    return { species: null, error: "Species is required" };
  }

  const normalized = value.toUpperCase() as Species;
  if (!VALID_SPECIES.includes(normalized)) {
    return {
      species: null,
      error: `Species '${value}' is invalid. Must be one of: ${VALID_SPECIES.join(", ")}`,
    };
  }

  return { species: normalized };
}

/**
 * Validates and normalizes sex value
 */
function parseSex(value: string | undefined): { sex: Sex | null; error?: string } {
  if (!value) {
    return { sex: null, error: "Sex is required" };
  }

  const normalized = value.toUpperCase() as Sex;
  if (!VALID_SEX.includes(normalized)) {
    return {
      sex: null,
      error: `Sex '${value}' is invalid. Must be one of: ${VALID_SEX.join(", ")}`,
    };
  }

  return { sex: normalized };
}

/**
 * Validates and normalizes status value
 */
function parseStatus(value: string | undefined): { status: AnimalStatus | null; error?: string } {
  if (!value) {
    return { status: "ACTIVE" }; // Default to ACTIVE
  }

  const normalized = value.toUpperCase() as AnimalStatus;
  if (!VALID_STATUS.includes(normalized)) {
    return {
      status: null,
      error: `Status '${value}' is invalid. Must be one of: ${VALID_STATUS.join(", ")}`,
    };
  }

  return { status: normalized };
}

/**
 * Parses date in YYYY-MM-DD format
 */
function parseDateIso(value: string | undefined): { date: Date | null; error?: string } {
  if (!value) {
    return { date: null };
  }

  // Validate format YYYY-MM-DD
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDatePattern.test(value)) {
    return {
      date: null,
      error: `Birth Date '${value}' is invalid. Use format: YYYY-MM-DD`,
    };
  }

  const date = new Date(value);
  if (Number.isNaN(+date)) {
    return {
      date: null,
      error: `Birth Date '${value}' is not a valid date`,
    };
  }

  // Check if date is not in the future
  if (date > new Date()) {
    return {
      date: null,
      error: `Birth Date '${value}' cannot be in the future`,
    };
  }

  return { date };
}

/**
 * Validates a single row and returns parsed data with errors
 */
function validateRow(raw: RawAnimalRow): {
  data: ParsedAnimalData | null;
  errors: string[];
} {
  const errors: string[] = [];

  // Required: Name
  const name = raw.Name?.trim();
  if (!name) {
    errors.push("Name is required");
  } else if (name.length > 255) {
    errors.push("Name must be 255 characters or less");
  }

  // Required: Species
  const speciesResult = parseSpecies(raw.Species);
  if (speciesResult.error) {
    errors.push(speciesResult.error);
  }

  // Required: Sex
  const sexResult = parseSex(raw.Sex);
  if (sexResult.error) {
    errors.push(sexResult.error);
  }

  // Optional: Birth Date
  const birthDateResult = parseDateIso(raw["Birth Date"]);
  if (birthDateResult.error) {
    errors.push(birthDateResult.error);
  }

  // Optional: Status
  const statusResult = parseStatus(raw.Status);
  if (statusResult.error) {
    errors.push(statusResult.error);
  }

  // Optional: Notes length check
  const notes = raw.Notes?.trim() || null;
  if (notes && notes.length > 5000) {
    errors.push("Notes must be 5000 characters or less");
  }

  // Optional: Microchip
  const microchip = raw.Microchip?.trim() || null;

  // Optional: Breed
  const breed = raw.Breed?.trim() || null;

  // Optional: Parents
  const damName = raw["Dam Name"]?.trim() || null;
  const sireName = raw["Sire Name"]?.trim() || null;

  // Optional: Registry
  const registryName = raw["Registry Name"]?.trim() || null;
  const registryNumber = raw["Registry Number"]?.trim() || null;

  // Validate registry pair
  if (registryNumber && !registryName) {
    errors.push("Registry Number provided without Registry Name");
  }

  // If there are errors, return null data
  if (errors.length > 0) {
    return { data: null, errors };
  }

  // Build parsed data
  const data: ParsedAnimalData = {
    name: name!,
    species: speciesResult.species!,
    sex: sexResult.sex!,
    birthDate: birthDateResult.date,
    microchip,
    breed,
    damName,
    sireName,
    registryName,
    registryNumber,
    status: statusResult.status!,
    notes,
  };

  return { data, errors: [] };
}

/**
 * Parses and validates CSV content
 * Returns parsed rows with validation status (valid/warning/error)
 *
 * Note: This function only handles basic validation.
 * Duplicate detection and parent matching must be done separately
 * with database access.
 */
export function parseAnimalCSV(csvContent: string): ParsedRow[] {
  let rawRows: RawAnimalRow[];

  try {
    rawRows = parseCSV(csvContent);
  } catch (error) {
    throw new Error(`Failed to parse CSV: ${(error as Error).message}`);
  }

  if (rawRows.length === 0) {
    throw new Error("CSV file contains no data rows");
  }

  const parsedRows: ParsedRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    const rowNumber = i + 1;

    const { data, errors } = validateRow(rawRow);

    if (errors.length > 0) {
      // Error status - cannot import
      parsedRows.push({
        rowNumber,
        status: "error",
        data: data as any, // Include partial data for display
        errors,
      });
    } else if (data) {
      // Valid status - can import (but may have warnings from DB checks)
      parsedRows.push({
        rowNumber,
        status: "valid",
        data,
      });
    }
  }

  return parsedRows;
}
