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
 * Create a tag assignment with dual-write support
 * - Accepts legacy contactId or organizationId
 * - Automatically resolves and persists taggedPartyId
 * - Maintains backward compatibility
 */
export async function createTagAssignment(params: {
  tagId: number;
  contactId?: number;
  organizationId?: number;
  animalId?: number;
  waitlistEntryId?: number;
  offspringGroupId?: number;
  offspringId?: number;
}): Promise<void> {
  const data: any = { tagId: params.tagId };

  // Dual-write for Contact
  if (params.contactId != null) {
    data.contactId = params.contactId;
    const partyId = await resolvePartyIdFromContact(params.contactId);
    if (partyId) {
      data.taggedPartyId = partyId;
    }
  }

  // Dual-write for Organization
  if (params.organizationId != null) {
    data.organizationId = params.organizationId;
    const partyId = await resolvePartyIdFromOrganization(params.organizationId);
    if (partyId) {
      data.taggedPartyId = partyId;
    }
  }

  // Other entity types (not party-like, no dual-write needed)
  if (params.animalId != null) data.animalId = params.animalId;
  if (params.waitlistEntryId != null) data.waitlistEntryId = params.waitlistEntryId;
  if (params.offspringGroupId != null) data.offspringGroupId = params.offspringGroupId;
  if (params.offspringId != null) data.offspringId = params.offspringId;

  await prisma.tagAssignment.create({ data });
}

/**
 * Get all tag assignments for a contact with dual-read support
 * - Prefers taggedPartyId when available
 * - Falls back to contactId for legacy rows
 * - Returns unified tag list
 */
export async function getTagsForContact(contactId: number, tenantId: number): Promise<any[]> {
  // Get contact's partyId for dual-read
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
    select: { id: true, partyId: true },
  });

  if (!contact) {
    return [];
  }

  // Dual-read: fetch by contactId OR (if contact has partyId) by taggedPartyId
  const whereConditions: any[] = [{ contactId: contactId }];

  if (contact.partyId) {
    whereConditions.push({ taggedPartyId: contact.partyId });
  }

  const rows = await prisma.tagAssignment.findMany({
    where: {
      OR: whereConditions,
    },
    include: { tag: true },
    orderBy: [{ tag: { name: "asc" } }],
  });

  // Deduplicate by tag.id (in case we have both legacy and new rows for same tag)
  const uniqueTags = new Map();
  for (const r of rows) {
    if (r.tag && r.tag.tenantId === tenantId) {
      if (!uniqueTags.has(r.tag.id)) {
        uniqueTags.set(r.tag.id, {
          id: r.tag.id,
          name: r.tag.name,
          module: r.tag.module,
          color: r.tag.color ?? null,
          createdAt: r.tag.createdAt,
          updatedAt: r.tag.updatedAt,
        });
      }
    }
  }

  return Array.from(uniqueTags.values());
}

/**
 * Get all tag assignments for an organization with dual-read support
 */
export async function getTagsForOrganization(organizationId: number, tenantId: number): Promise<any[]> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, tenantId },
    select: { id: true, partyId: true },
  });

  if (!org) {
    return [];
  }

  const whereConditions: any[] = [{ organizationId: organizationId }];

  if (org.partyId) {
    whereConditions.push({ taggedPartyId: org.partyId });
  }

  const rows = await prisma.tagAssignment.findMany({
    where: {
      OR: whereConditions,
    },
    include: { tag: true },
    orderBy: [{ tag: { name: "asc" } }],
  });

  const uniqueTags = new Map();
  for (const r of rows) {
    if (r.tag && r.tag.tenantId === tenantId) {
      if (!uniqueTags.has(r.tag.id)) {
        uniqueTags.set(r.tag.id, {
          id: r.tag.id,
          name: r.tag.name,
          module: r.tag.module,
          color: r.tag.color ?? null,
          createdAt: r.tag.createdAt,
          updatedAt: r.tag.updatedAt,
        });
      }
    }
  }

  return Array.from(uniqueTags.values());
}
