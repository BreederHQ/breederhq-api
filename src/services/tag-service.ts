// src/services/tag-service.ts
// Tag service with party migration step 5 support

import prisma from "../prisma.js";

/**
 * Resolve partyId from contactId or organizationId
 * Returns null if the entity doesn't exist or doesn't have a partyId
 */
export async function resolvePartyIdFromContact(contactId: number): Promise<number | null> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { partyId: true },
  });
  return contact?.partyId ?? null;
}

export async function resolvePartyIdFromOrganization(organizationId: number): Promise<number | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { partyId: true },
  });
  return org?.partyId ?? null;
}

/**
 * Create a tag assignment with Party-only writes (Step 6B)
 * - Accepts legacy contactId or organizationId as inputs
 * - Resolves to taggedPartyId and persists ONLY taggedPartyId
 * - Maintains API backward compatibility (same inputs, same behavior)
 */
export async function createTagAssignment(params: {
  tagId: number;
  contactId?: number;
  organizationId?: number;
  animalId?: number;
  waitlistEntryId?: number;
  offspringGroupId?: number;
  offspringId?: number;
  documentId?: number;
}): Promise<void> {
  const data: any = { tagId: params.tagId };

  // Party-only write for Contact: resolve contactId -> taggedPartyId
  if (params.contactId != null) {
    const partyId = await resolvePartyIdFromContact(params.contactId);
    if (!partyId) {
      throw new Error(`Contact ${params.contactId} has no partyId - cannot assign tag`);
    }
    data.taggedPartyId = partyId;
  }

  // Party-only write for Organization: resolve organizationId -> taggedPartyId
  if (params.organizationId != null) {
    const partyId = await resolvePartyIdFromOrganization(params.organizationId);
    if (!partyId) {
      throw new Error(`Organization ${params.organizationId} has no partyId - cannot assign tag`);
    }
    data.taggedPartyId = partyId;
  }

  // Other entity types (not party-like, no mapping needed)
  if (params.animalId != null) data.animalId = params.animalId;
  if (params.waitlistEntryId != null) data.waitlistEntryId = params.waitlistEntryId;
  if (params.offspringGroupId != null) data.offspringGroupId = params.offspringGroupId;
  if (params.offspringId != null) data.offspringId = params.offspringId;
  if (params.documentId != null) data.documentId = params.documentId;

  await prisma.tagAssignment.create({ data });
}

/**
 * Get all tag assignments for a contact (Step 6B: Party-only reads)
 * - Queries by taggedPartyId only
 * - Returns empty array if contact has no partyId
 */
export async function getTagsForContact(contactId: number, tenantId: number): Promise<any[]> {
  // Get contact's partyId
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
    select: { id: true, partyId: true },
  });

  if (!contact) {
    return [];
  }

  // If contact has no partyId, return empty (should not happen post-migration)
  if (!contact.partyId) {
    return [];
  }

  // Party-only read: query by taggedPartyId
  const rows = await prisma.tagAssignment.findMany({
    where: {
      taggedPartyId: contact.partyId,
    },
    include: { tag: true },
    orderBy: [{ tag: { name: "asc" } }],
  });

  // Map to DTO, filtering by tenantId
  const tags = rows
    .filter((r) => r.tag && r.tag.tenantId === tenantId)
    .map((r) => ({
      id: r.tag.id,
      name: r.tag.name,
      module: r.tag.module,
      color: r.tag.color ?? null,
      createdAt: r.tag.createdAt,
      updatedAt: r.tag.updatedAt,
    }));

  return tags;
}

/**
 * Get all tag assignments for an organization (Step 6B: Party-only reads)
 * - Queries by taggedPartyId only
 * - Returns empty array if organization has no partyId
 */
export async function getTagsForOrganization(organizationId: number, tenantId: number): Promise<any[]> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, tenantId },
    select: { id: true, partyId: true },
  });

  if (!org) {
    return [];
  }

  // If organization has no partyId, return empty (should not happen post-migration)
  if (!org.partyId) {
    return [];
  }

  // Party-only read: query by taggedPartyId
  const rows = await prisma.tagAssignment.findMany({
    where: {
      taggedPartyId: org.partyId,
    },
    include: { tag: true },
    orderBy: [{ tag: { name: "asc" } }],
  });

  // Map to DTO, filtering by tenantId
  const tags = rows
    .filter((r) => r.tag && r.tag.tenantId === tenantId)
    .map((r) => ({
      id: r.tag.id,
      name: r.tag.name,
      module: r.tag.module,
      color: r.tag.color ?? null,
      createdAt: r.tag.createdAt,
      updatedAt: r.tag.updatedAt,
    }));

  return tags;
}
