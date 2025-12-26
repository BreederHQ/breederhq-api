/**
 * Finance Domain Party Resolution Utility
 *
 * Provides helper functions for resolving partyId in Finance models
 * (Invoice, OffspringContract, ContractParty) during dual-write operations.
 *
 * Usage:
 * - When creating/updating Invoice: call resolveInvoicePartyId()
 * - When creating/updating OffspringContract: call resolveOffspringContractPartyId()
 * - When creating/updating ContractParty: call resolveContractPartyId()
 *
 * This ensures dual-write: both legacy (contactId/organizationId/userId) and
 * new partyId fields are populated consistently.
 */

import type { PrismaClient } from "@prisma/client";
import { resolvePartyId } from "../party-resolver.js";

/**
 * Resolves clientPartyId for an Invoice based on contactId or organizationId.
 *
 * Dual-write rule:
 * - If contactId provided, set clientPartyId = Contact.partyId
 * - If organizationId provided, set clientPartyId = Organization.partyId
 * - Persist both legacy columns and clientPartyId
 *
 * @param prisma - Prisma client instance
 * @param input - Object with contactId or organizationId
 * @returns The clientPartyId if resolvable, otherwise null
 */
export async function resolveInvoicePartyId(
  prisma: PrismaClient | any,
  input: { contactId?: number | null; organizationId?: number | null }
): Promise<number | null> {
  if (input.contactId) {
    return resolvePartyId(prisma, { contactId: input.contactId });
  }
  if (input.organizationId) {
    return resolvePartyId(prisma, { organizationId: input.organizationId });
  }
  return null;
}

/**
 * Resolves buyerPartyId for an OffspringContract based on buyerContactId or buyerOrganizationId.
 *
 * Dual-write rule:
 * - If buyerContactId provided, set buyerPartyId = Contact.partyId
 * - If buyerOrganizationId provided, set buyerPartyId = Organization.partyId
 * - Persist both legacy columns and buyerPartyId
 *
 * @param prisma - Prisma client instance
 * @param input - Object with buyerContactId or buyerOrganizationId
 * @returns The buyerPartyId if resolvable, otherwise null
 */
export async function resolveOffspringContractPartyId(
  prisma: PrismaClient | any,
  input: { buyerContactId?: number | null; buyerOrganizationId?: number | null }
): Promise<number | null> {
  if (input.buyerContactId) {
    return resolvePartyId(prisma, { contactId: input.buyerContactId });
  }
  if (input.buyerOrganizationId) {
    return resolvePartyId(prisma, { organizationId: input.buyerOrganizationId });
  }
  return null;
}

/**
 * Resolves partyId for a ContractParty based on contactId, organizationId, or userId.
 *
 * Dual-write rule:
 * - If contactId provided, set partyId = Contact.partyId
 * - If organizationId provided, set partyId = Organization.partyId
 * - If userId provided, set partyId = User.partyId (if User has partyId)
 * - Persist both legacy columns and partyId
 *
 * Priority order: contactId > organizationId > userId
 *
 * @param prisma - Prisma client instance
 * @param input - Object with contactId, organizationId, or userId
 * @returns The partyId if resolvable, otherwise null
 */
export async function resolveContractPartyId(
  prisma: PrismaClient | any,
  input: { contactId?: number | null; organizationId?: number | null; userId?: string | null }
): Promise<number | null> {
  // Priority 1: Contact
  if (input.contactId) {
    return resolvePartyId(prisma, { contactId: input.contactId });
  }

  // Priority 2: Organization
  if (input.organizationId) {
    return resolvePartyId(prisma, { organizationId: input.organizationId });
  }

  // Priority 3: User (if User has a partyId link)
  if (input.userId) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { partyId: true },
    });
    return user?.partyId ?? null;
  }

  return null;
}

/**
 * Example usage for Invoice creation:
 *
 * ```typescript
 * import { resolveInvoicePartyId } from './services/finance/party-resolver-finance.js';
 *
 * // In your route handler
 * const clientPartyId = await resolveInvoicePartyId(prisma, {
 *   contactId: body.contactId,
 *   organizationId: body.organizationId,
 * });
 *
 * const invoice = await prisma.invoice.create({
 *   data: {
 *     tenantId,
 *     contactId: body.contactId,           // Legacy
 *     organizationId: body.organizationId, // Legacy
 *     clientPartyId,                       // New unified reference
 *     // ... other fields
 *   },
 * });
 * ```
 */

/**
 * Example usage for OffspringContract creation:
 *
 * ```typescript
 * import { resolveOffspringContractPartyId } from './services/finance/party-resolver-finance.js';
 *
 * const buyerPartyId = await resolveOffspringContractPartyId(prisma, {
 *   buyerContactId: body.buyerContactId,
 *   buyerOrganizationId: body.buyerOrganizationId,
 * });
 *
 * const contract = await prisma.offspringContract.create({
 *   data: {
 *     offspringId,
 *     buyerContactId: body.buyerContactId,           // Legacy
 *     buyerOrganizationId: body.buyerOrganizationId, // Legacy
 *     buyerPartyId,                                  // New unified reference
 *     // ... other fields
 *   },
 * });
 * ```
 */

/**
 * Example usage for ContractParty creation:
 *
 * ```typescript
 * import { resolveContractPartyId } from './services/finance/party-resolver-finance.js';
 *
 * const partyId = await resolveContractPartyId(prisma, {
 *   contactId: body.contactId,
 *   organizationId: body.organizationId,
 *   userId: body.userId,
 * });
 *
 * const contractParty = await prisma.contractParty.create({
 *   data: {
 *     contractId,
 *     contactId: body.contactId,           // Legacy
 *     organizationId: body.organizationId, // Legacy
 *     userId: body.userId,                 // Legacy
 *     partyId,                             // New unified reference
 *     // ... other fields
 *   },
 * });
 * ```
 */
