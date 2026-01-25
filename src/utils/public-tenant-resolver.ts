// src/utils/public-tenant-resolver.ts
// Resolves tenant context from public program slugs for marketplace routes

import type { PrismaClient } from "@prisma/client";

export interface ResolvedTenant {
  tenantId: number;
  organizationId: number;
  partyId: number;
}

/**
 * Validates that a slug follows the required format:
 * - lowercase
 * - alphanumeric with hyphens
 * - no leading/trailing hyphens
 * - no consecutive hyphens
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== "string") return false;
  const normalized = slug.trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized);
}

/**
 * Normalizes a slug to lowercase and trimmed
 */
export function normalizeSlug(slug: string): string {
  return (slug || "").trim().toLowerCase();
}

/**
 * Resolves tenant context from a public program slug.
 * Returns null if:
 * - Organization not found with the given slug
 * - Organization is not marked as public (isPublicProgram = false)
 * - Organization is archived
 */
export async function resolveTenantFromProgramSlug(
  prisma: PrismaClient,
  slug: string
): Promise<ResolvedTenant | null> {
  if (!isValidSlug(slug)) {
    return null;
  }

  const normalized = normalizeSlug(slug);

  const org = await prisma.organization.findFirst({
    where: {
      programSlug: normalized,
      isPublicProgram: true,
      archived: false,
    },
    select: {
      id: true,
      tenantId: true,
      partyId: true,
    },
  });

  if (!org) {
    return null;
  }

  return {
    tenantId: org.tenantId,
    organizationId: org.id,
    partyId: org.partyId,
  };
}

/**
 * Resolves tenant context from an offspring group listing slug within a program.
 * Returns null if not found or not published.
 *
 * IMPORTANT: Enforces the hierarchy: BreedingProgram (LIVE) → BreedingPlan → OffspringGroup
 * An offspring group is only resolvable if its parent BreedingProgram has status=LIVE.
 */
export async function resolveOffspringGroupListing(
  prisma: PrismaClient,
  tenantId: number,
  listingSlug: string
): Promise<{ groupId: number } | null> {
  if (!isValidSlug(listingSlug)) {
    return null;
  }

  const normalized = normalizeSlug(listingSlug);

  const group = await prisma.offspringGroup.findFirst({
    where: {
      tenantId,
      listingSlug: normalized,
      status: "LIVE",
      // Require the parent breeding program to be LIVE
      plan: {
        program: {
          status: "LIVE",
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!group) {
    return null;
  }

  return { groupId: group.id };
}

/**
 * Resolves an animal public listing within a program.
 * Returns null if not found or not listed.
 */
export async function resolveAnimalListing(
  prisma: PrismaClient,
  tenantId: number,
  listingSlug: string
): Promise<{ animalId: number; listingId: number } | null> {
  if (!isValidSlug(listingSlug)) {
    return null;
  }

  const normalized = normalizeSlug(listingSlug);

  const listing = await prisma.mktListingIndividualAnimal.findFirst({
    where: {
      tenantId,
      slug: normalized,
      status: "LIVE",
    },
    select: {
      id: true,
      animalId: true,
    },
  });

  if (!listing) {
    return null;
  }

  return {
    animalId: listing.animalId,
    listingId: listing.id,
  };
}
