/**
 * Invoice Numbering Service
 *
 * Generates unique, sequential invoice numbers in the format INV-YYYY-NNNN.
 * - Server-side only (never client-generated)
 * - Tenant-scoped
 * - Per-year counter
 * - Concurrency-safe using atomic database operations
 *
 * Format: INV-{year}-{number padded to 4 digits}
 * Example: INV-2025-0001, INV-2025-0002, etc.
 */

import type { PrismaClient } from "@prisma/client";

/**
 * Generate the next invoice number for a tenant.
 * Uses a transactional update to ensure concurrency safety.
 *
 * @param prisma - Prisma client instance (can be a transaction client)
 * @param tenantId - The tenant ID
 * @returns The generated invoice number (e.g., "INV-2025-0001")
 */
export async function generateInvoiceNumber(
  prisma: PrismaClient | any,
  tenantId: number
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const key = "invoice";

  // Perform atomic upsert and increment in a single operation
  // This is concurrency-safe because Prisma/PostgreSQL handles it transactionally
  const sequence = await prisma.sequence.upsert({
    where: {
      tenantId_key_year: {
        tenantId,
        key,
        year,
      },
    },
    create: {
      tenantId,
      key,
      year,
      nextNumber: 2, // First invoice is 1, so next is 2
    },
    update: {
      nextNumber: {
        increment: 1,
      },
    },
  });

  // The number we just assigned is nextNumber - 1 (because we already incremented)
  // On create, nextNumber is 2, so assigned number is 1
  // On update, we incremented nextNumber, so assigned number is the new value - 1
  const assignedNumber = sequence.nextNumber - 1;

  // Format as INV-YYYY-NNNN (zero-padded to 4 digits)
  const formattedNumber = String(assignedNumber).padStart(4, "0");
  return `INV-${year}-${formattedNumber}`;
}
