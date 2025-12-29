/**
 * Idempotency Service
 *
 * Prevents duplicate operations by storing idempotency keys and responses.
 * Used for invoice and payment creation endpoints.
 *
 * Flow:
 * 1. Client sends Idempotency-Key header
 * 2. Server checks if key exists for tenant
 * 3. If exists and request hash matches, return stored response
 * 4. If exists and hash differs, return 409 Conflict
 * 5. If not exists, proceed with operation and store response
 */

import type { PrismaClient } from "@prisma/client";
import crypto from "crypto";

/**
 * Hash a request body for idempotency checking.
 * Uses SHA-256 to create a deterministic hash of the request payload.
 *
 * @param body - The request body object
 * @returns SHA-256 hash of the JSON-stringified body
 */
export function hashRequestBody(body: any): string {
  // Stringify with sorted keys for deterministic hashing
  const normalized = JSON.stringify(body, Object.keys(body).sort());
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * Check if an idempotency key exists and handle accordingly.
 * Returns the stored response if key exists and matches.
 * Throws error if key exists but hash differs.
 *
 * @param prisma - Prisma client instance
 * @param tenantId - The tenant ID
 * @param idempotencyKey - The idempotency key from header
 * @param requestHash - Hash of the current request body
 * @returns Stored response if replay, null if new request
 * @throws Error if key exists with different hash (409 conflict)
 */
export async function checkIdempotencyKey(
  prisma: PrismaClient | any,
  tenantId: number,
  idempotencyKey: string,
  requestHash: string
): Promise<any | null> {
  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      tenantId_key: {
        tenantId,
        key: idempotencyKey,
      },
    },
  });

  if (!existing) {
    // New request, proceed
    return null;
  }

  if (existing.requestHash !== requestHash) {
    // Same key, different request body - conflict
    throw new IdempotencyConflictError(
      "Idempotency key already used with different request body"
    );
  }

  // Same key, same request - return stored response
  return existing.responseBody ? JSON.parse(existing.responseBody) : null;
}

/**
 * Store an idempotency key with its response for future replays.
 *
 * @param prisma - Prisma client instance
 * @param tenantId - The tenant ID
 * @param idempotencyKey - The idempotency key from header
 * @param requestHash - Hash of the request body
 * @param response - The response to store
 */
export async function storeIdempotencyKey(
  prisma: PrismaClient | any,
  tenantId: number,
  idempotencyKey: string,
  requestHash: string,
  response: any
): Promise<void> {
  await prisma.idempotencyKey.create({
    data: {
      tenantId,
      key: idempotencyKey,
      requestHash,
      responseBody: JSON.stringify(response),
    },
  });
}

/**
 * Custom error for idempotency conflicts
 */
export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}
