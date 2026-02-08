// src/services/gaid-service.ts
// GAID (Global Animal ID) and Exchange Code generation utilities

import crypto from "node:crypto";
import type { Species } from "@prisma/client";

/* ─────────────────────────────────────────────────────────────────────────────
 * Constants
 * ───────────────────────────────────────────────────────────────────────────── */

// Base32 alphabet (Crockford's - no I, L, O, U to avoid confusion)
const BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// Species prefixes for GAID
const SPECIES_PREFIX: Record<Species, string> = {
  DOG: "DOG",
  CAT: "CAT",
  HORSE: "HOR",
  GOAT: "GOA",
  SHEEP: "SHE",
  RABBIT: "RAB",
  CATTLE: "COW",
  PIG: "PIG",
  ALPACA: "ALP",
  LLAMA: "LLA",
};

// Exchange code expiry (7 days in milliseconds)
export const EXCHANGE_CODE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/* ─────────────────────────────────────────────────────────────────────────────
 * GAID Generation
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Generate a cryptographically secure random string using Base32 alphabet
 */
function generateSecureBase32(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += BASE32_ALPHABET[bytes[i] % 32];
  }
  return result;
}

/**
 * Generate a Global Animal ID (GAID)
 * Format: {SPECIES}-{XXXX}-{XXXX}-{XXXX}
 * Example: DOG-7X4K-9M2P-QR8T
 *
 * @param species - The animal's species
 * @returns A unique, human-readable GAID
 */
export function generateGaid(species: Species): string {
  const prefix = SPECIES_PREFIX[species] || species.substring(0, 3).toUpperCase();
  const random = generateSecureBase32(12);
  return `${prefix}-${random.slice(0, 4)}-${random.slice(4, 8)}-${random.slice(8, 12)}`;
}

/**
 * Validate a GAID format
 * @param gaid - The GAID to validate
 * @returns true if valid format, false otherwise
 */
export function isValidGaid(gaid: string): boolean {
  // Format: XXX-XXXX-XXXX-XXXX (16 chars + 3 dashes = 19 total)
  const pattern = /^[A-Z]{3}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/;
  return pattern.test(gaid);
}

/**
 * Parse species from GAID
 * @param gaid - The GAID to parse
 * @returns The species or null if not recognized
 */
export function parseSpeciesFromGaid(gaid: string): Species | null {
  if (!isValidGaid(gaid)) return null;

  const prefix = gaid.substring(0, 3);
  const entry = Object.entries(SPECIES_PREFIX).find(([, v]) => v === prefix);
  return entry ? (entry[0] as Species) : null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Exchange Code Generation
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Generate an exchange code for an animal
 * Format: {NAME_PREFIX}-{NNNN}
 * Example: DUKE-8472
 *
 * @param animalName - The animal's name (used as prefix)
 * @returns A short, shareable exchange code
 */
export function generateExchangeCode(animalName: string): string {
  // Extract first 4 alphabetic characters from name, uppercase
  const prefix = animalName
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 4)
    .toUpperCase()
    .padEnd(4, "X"); // Pad with X if name is too short

  // Generate 4-digit numeric suffix (1000-9999)
  const suffix = 1000 + crypto.randomInt(9000);

  return `${prefix}-${suffix}`;
}

/**
 * Validate an exchange code format
 * @param code - The code to validate
 * @returns true if valid format, false otherwise
 */
export function isValidExchangeCode(code: string): boolean {
  // Format: XXXX-NNNN (4 letters, dash, 4 digits)
  const pattern = /^[A-Z]{4}-[0-9]{4}$/;
  return pattern.test(code);
}

/**
 * Calculate exchange code expiry date
 * @param fromDate - Start date (defaults to now)
 * @returns The expiry date (7 days from start)
 */
export function calculateExchangeCodeExpiry(fromDate: Date = new Date()): Date {
  return new Date(fromDate.getTime() + EXCHANGE_CODE_EXPIRY_MS);
}

/**
 * Check if an exchange code is expired
 * @param expiresAt - The expiry date
 * @returns true if expired, false if still valid
 */
export function isExchangeCodeExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return new Date() > expiresAt;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Export
 * ───────────────────────────────────────────────────────────────────────────── */

export default {
  generateGaid,
  isValidGaid,
  parseSpeciesFromGaid,
  generateExchangeCode,
  isValidExchangeCode,
  calculateExchangeCodeExpiry,
  isExchangeCodeExpired,
  EXCHANGE_CODE_EXPIRY_MS,
};
