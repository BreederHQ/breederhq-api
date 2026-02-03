// src/utils/breeding-discovery-numbers.ts
// Number generators for Breeding Discovery entities

import prisma from "../prisma.js";

/**
 * Generate a unique listing number for a breeding listing.
 * Format: BL-YYYY-NNN (e.g., BL-2026-001)
 */
export async function generateListingNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BL-${year}-`;

  const count = await prisma.breedingListing.count({
    where: { listingNumber: { startsWith: prefix } },
  });

  const sequence = String(count + 1).padStart(3, "0");
  return `${prefix}${sequence}`;
}

/**
 * Generate a unique program number for a breeding discovery program.
 * Format: BP-YYYY-NNN (e.g., BP-2026-001)
 */
export async function generateProgramNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BP-${year}-`;

  const count = await prisma.breedingDiscoveryProgram.count({
    where: { programNumber: { startsWith: prefix } },
  });

  const sequence = String(count + 1).padStart(3, "0");
  return `${prefix}${sequence}`;
}

/**
 * Generate a unique booking number for a breeding booking.
 * Format: BB-YYYY-NNN (e.g., BB-2026-001)
 */
export async function generateBookingNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BB-${year}-`;

  const count = await prisma.breedingBooking.count({
    where: { bookingNumber: { startsWith: prefix } },
  });

  const sequence = String(count + 1).padStart(3, "0");
  return `${prefix}${sequence}`;
}
