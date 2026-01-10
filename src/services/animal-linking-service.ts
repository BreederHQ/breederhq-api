// src/services/animal-linking-service.ts
// Cross-tenant animal linking for lineage/pedigree connections

import prisma from "../prisma.js";
import {
  generateExchangeCode,
  calculateExchangeCodeExpiry,
  isExchangeCodeExpired,
  generateGaid,
} from "./gaid-service.js";
import type {
  Species,
  Sex,
  ParentType,
  LinkRequestStatus,
  LinkMethod,
  RevokedBy,
  Prisma,
} from "@prisma/client";

/* ─────────────────────────────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────────────────────────────── */

export interface NetworkAnimalResult {
  animalId: number;
  tenantId: number;
  globalIdentityId: number | null;
  gaid: string | null;
  name: string | null;
  species: Species;
  sex: Sex;
  breed: string | null;
  birthDate: Date | null;
  photoUrl: string | null;
  tenantName: string | null;
  // Privacy-filtered
  registryNumbers: Array<{ registry: string; number: string }>;
  titlePrefix: string | null;
  titleSuffix: string | null;
}

export interface BreederSearchResult {
  tenantId: number;
  tenantName: string;
  // Location if shared
  city: string | null;
  state: string | null;
  country: string | null;
  // Stats
  shareableAnimalCount: number;
}

export interface ShareableAnimal {
  id: number;
  name: string | null;
  species: Species;
  sex: Sex;
  breed: string | null;
  birthDate: Date | null;
  photoUrl: string | null;
  gaid: string | null;
  titlePrefix: string | null;
  titleSuffix: string | null;
  registryNumbers: Array<{ registry: string; number: string }>;
}

export interface CreateLinkRequestParams {
  requestingTenantId: number;
  requestingUserId: string;
  sourceAnimalId: number;
  relationshipType: ParentType;
  // Target identification (at least one required)
  targetAnimalId?: number;
  targetGaid?: string;
  targetExchangeCode?: string;
  targetRegistryId?: number;
  targetRegistryNum?: string;
  targetTenantId?: number;
  // Optional message
  message?: string;
}

export interface LinkRequestWithDetails {
  id: number;
  createdAt: Date;
  status: LinkRequestStatus;
  relationshipType: ParentType;
  message: string | null;
  responseMessage: string | null;
  denialReason: string | null;
  // Source animal (requesting breeder's animal)
  sourceAnimal: {
    id: number;
    name: string;
    species: Species;
    sex: Sex;
    photoUrl: string | null;
  };
  // Requesting breeder
  requestingTenant: {
    id: number;
    name: string;
  };
  // Target animal (if resolved)
  targetAnimal: {
    id: number;
    name: string;
    species: Species;
    sex: Sex;
    photoUrl: string | null;
  } | null;
  // Target breeder (if known)
  targetTenant: {
    id: number;
    name: string;
  } | null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Discovery Functions
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Search for an animal by GAID
 */
export async function searchByGaid(gaid: string): Promise<NetworkAnimalResult | null> {
  const identity = await prisma.globalAnimalIdentity.findFirst({
    where: { gaid },
    include: {
      linkedAnimals: {
        include: {
          animal: {
            include: {
              tenant: { select: { id: true, name: true } },
              privacySettings: true,
              registryIds: {
                include: { registry: { select: { name: true, code: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!identity || identity.linkedAnimals.length === 0) {
    return null;
  }

  // Get the first linked animal (they're all the same identity)
  const link = identity.linkedAnimals[0];
  const animal = link.animal;
  const privacy = animal.privacySettings;

  // Check if cross-tenant matching is allowed
  if (privacy && !privacy.allowCrossTenantMatching) {
    return null;
  }

  return buildNetworkAnimalResult(animal, identity.id, identity.gaid, privacy);
}

/**
 * Search for an animal by exchange code
 */
export async function searchByExchangeCode(code: string): Promise<NetworkAnimalResult | null> {
  const animal = await prisma.animal.findFirst({
    where: {
      exchangeCode: code.toUpperCase(),
      exchangeCodeExpiresAt: { gt: new Date() },
    },
    include: {
      tenant: { select: { id: true, name: true } },
      privacySettings: true,
      registryIds: {
        include: { registry: { select: { name: true, code: true } } },
      },
      identityLink: {
        include: { identity: { select: { id: true, gaid: true } } },
      },
    },
  });

  if (!animal) {
    return null;
  }

  const privacy = animal.privacySettings;
  if (privacy && !privacy.allowCrossTenantMatching) {
    return null;
  }

  return buildNetworkAnimalResult(
    animal,
    animal.identityLink?.identityId ?? null,
    animal.identityLink?.identity?.gaid ?? null,
    privacy
  );
}

/**
 * Search for an animal by registry number
 */
export async function searchByRegistry(
  registryId: number,
  registryNum: string
): Promise<NetworkAnimalResult | null> {
  const registryIdentifier = await prisma.animalRegistryIdentifier.findFirst({
    where: {
      registryId,
      identifier: registryNum.toUpperCase().replace(/[\s-]/g, ""),
    },
    include: {
      animal: {
        include: {
          tenant: { select: { id: true, name: true } },
          privacySettings: true,
          registryIds: {
            include: { registry: { select: { name: true, code: true } } },
          },
          identityLink: {
            include: { identity: { select: { id: true, gaid: true } } },
          },
        },
      },
    },
  });

  if (!registryIdentifier) {
    return null;
  }

  const animal = registryIdentifier.animal;
  const privacy = animal.privacySettings;

  if (privacy && !privacy.allowCrossTenantMatching) {
    return null;
  }

  return buildNetworkAnimalResult(
    animal,
    animal.identityLink?.identityId ?? null,
    animal.identityLink?.identity?.gaid ?? null,
    privacy
  );
}

/**
 * Search for breeders by email or phone
 */
export async function searchBreederByEmailOrPhone(
  query: string
): Promise<BreederSearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();

  // Search tenants by owner email or business email/phone
  // Note: We search Users associated with tenants
  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [
        // Search by user email (tenant members)
        {
          User: {
            some: {
              email: { contains: normalizedQuery, mode: "insensitive" },
            },
          },
        },
        // Search by tenant name (in case they share it)
        {
          name: { contains: normalizedQuery, mode: "insensitive" },
        },
      ],
    },
    select: {
      id: true,
      name: true,
    },
    take: 20,
  });

  // Count shareable animals for each tenant separately
  // This handles the privacy settings check more reliably
  const results: BreederSearchResult[] = [];

  for (const t of tenants) {
    // Count animals that are shareable:
    // - Not archived
    // - Either no privacy settings (defaults to shareable) OR explicitly allowed
    const shareableCount = await prisma.animal.count({
      where: {
        tenantId: t.id,
        archived: false,
        OR: [
          { privacySettings: { is: null } },
          { privacySettings: { allowCrossTenantMatching: true } },
        ],
      },
    });

    results.push({
      tenantId: t.id,
      tenantName: t.name,
      city: null, // TODO: Add tenant location fields
      state: null,
      country: null,
      shareableAnimalCount: shareableCount,
    });
  }

  return results;
}

/**
 * Get shareable animals for a tenant (for breeder discovery flow)
 */
export async function getBreederShareableAnimals(
  tenantId: number,
  filters?: { sex?: Sex; species?: Species }
): Promise<ShareableAnimal[]> {
  const where: Prisma.AnimalWhereInput = {
    tenantId,
    archived: false,
    OR: [
      { privacySettings: { is: null } },
      { privacySettings: { allowCrossTenantMatching: true } },
    ],
  };

  if (filters?.sex) {
    where.sex = filters.sex;
  }
  if (filters?.species) {
    where.species = filters.species;
  }

  const animals = await prisma.animal.findMany({
    where,
    select: {
      id: true,
      name: true,
      species: true,
      sex: true,
      breed: true,
      birthDate: true,
      photoUrl: true,
      titlePrefix: true,
      titleSuffix: true,
      privacySettings: true,
      registryIds: {
        include: { registry: { select: { name: true, code: true } } },
      },
      identityLink: {
        include: { identity: { select: { gaid: true } } },
      },
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  return animals.map((a) => {
    const privacy = a.privacySettings;
    return {
      id: a.id,
      name: privacy?.showName !== false ? a.name : null,
      species: a.species,
      sex: a.sex,
      breed: a.breed,
      birthDate: privacy?.showFullDob !== false ? a.birthDate : null,
      photoUrl: privacy?.showPhoto !== false ? a.photoUrl : null,
      gaid: a.identityLink?.identity?.gaid ?? null,
      titlePrefix: privacy?.showTitles !== false ? a.titlePrefix : null,
      titleSuffix: privacy?.showTitles !== false ? a.titleSuffix : null,
      registryNumbers: privacy?.showRegistryFull !== false
        ? a.registryIds.map((r) => ({
            registry: r.registry.code ?? r.registry.name,
            number: r.identifier,
          }))
        : a.registryIds.map((r) => ({
            registry: r.registry.code ?? r.registry.name,
            number: "****" + r.identifier.slice(-4),
          })),
    };
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Link Request Workflow
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Create a new link request
 */
export async function createLinkRequest(
  params: CreateLinkRequestParams
): Promise<{ id: number; status: LinkRequestStatus }> {
  // Validate source animal belongs to requesting tenant
  const sourceAnimal = await prisma.animal.findFirst({
    where: { id: params.sourceAnimalId, tenantId: params.requestingTenantId },
  });

  if (!sourceAnimal) {
    throw new Error("Source animal not found or doesn't belong to your account");
  }

  // If targetAnimalId provided, resolve target tenant
  let resolvedTargetTenantId = params.targetTenantId;
  if (params.targetAnimalId && !resolvedTargetTenantId) {
    const targetAnimal = await prisma.animal.findUnique({
      where: { id: params.targetAnimalId },
      select: { tenantId: true },
    });
    if (targetAnimal) {
      resolvedTargetTenantId = targetAnimal.tenantId;
    }
  }

  // Check for existing pending request
  const existing = await prisma.animalLinkRequest.findFirst({
    where: {
      sourceAnimalId: params.sourceAnimalId,
      relationshipType: params.relationshipType,
      status: "PENDING",
    },
  });

  if (existing) {
    throw new Error("A pending link request already exists for this relationship");
  }

  // Create the request
  const request = await prisma.animalLinkRequest.create({
    data: {
      requestingTenantId: params.requestingTenantId,
      requestingUserId: params.requestingUserId,
      sourceAnimalId: params.sourceAnimalId,
      relationshipType: params.relationshipType,
      targetAnimalId: params.targetAnimalId,
      targetGaid: params.targetGaid,
      targetExchangeCode: params.targetExchangeCode?.toUpperCase(),
      targetRegistryId: params.targetRegistryId,
      targetRegistryNum: params.targetRegistryNum?.toUpperCase(),
      targetTenantId: resolvedTargetTenantId,
      message: params.message,
      status: "PENDING",
    },
  });

  return { id: request.id, status: request.status };
}

/**
 * Approve a link request
 */
export async function approveLinkRequest(
  requestId: number,
  approvingTenantId: number,
  targetAnimalId: number,
  responseMessage?: string
): Promise<{ linkId: number }> {
  // Get the request
  const request = await prisma.animalLinkRequest.findUnique({
    where: { id: requestId },
    include: {
      sourceAnimal: true,
    },
  });

  if (!request) {
    throw new Error("Link request not found");
  }

  if (request.status !== "PENDING") {
    throw new Error("Link request is not pending");
  }

  // Verify the approving tenant owns the target animal
  const targetAnimal = await prisma.animal.findFirst({
    where: { id: targetAnimalId, tenantId: approvingTenantId },
  });

  if (!targetAnimal) {
    throw new Error("Target animal not found or doesn't belong to your account");
  }

  // Verify species match
  if (targetAnimal.species !== request.sourceAnimal.species) {
    throw new Error("Species mismatch between animals");
  }

  // Verify sex is correct for relationship type
  const expectedSex = request.relationshipType === "SIRE" ? "MALE" : "FEMALE";
  if (targetAnimal.sex !== expectedSex) {
    throw new Error(
      `Target animal must be ${expectedSex.toLowerCase()} to be linked as ${request.relationshipType.toLowerCase()}`
    );
  }

  // Determine link method
  let linkMethod: LinkMethod = "BREEDER_REQUEST";
  if (request.targetGaid) linkMethod = "GAID";
  else if (request.targetExchangeCode) linkMethod = "EXCHANGE_CODE";
  else if (request.targetRegistryId) linkMethod = "REGISTRY_MATCH";

  // Create the cross-tenant link and update request in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update request status
    await tx.animalLinkRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        respondedAt: new Date(),
        responseMessage,
        confirmedTargetAnimalId: targetAnimalId,
      },
    });

    // Create cross-tenant link
    const link = await tx.crossTenantAnimalLink.create({
      data: {
        childAnimalId: request.sourceAnimalId,
        childTenantId: request.requestingTenantId,
        parentAnimalId: targetAnimalId,
        parentTenantId: approvingTenantId,
        parentType: request.relationshipType,
        linkRequestId: requestId,
        linkMethod,
        active: true,
      },
    });

    return { linkId: link.id };
  });

  return result;
}

/**
 * Deny a link request
 */
export async function denyLinkRequest(
  requestId: number,
  denyingTenantId: number,
  reason?: string,
  responseMessage?: string
): Promise<void> {
  const request = await prisma.animalLinkRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error("Link request not found");
  }

  if (request.status !== "PENDING") {
    throw new Error("Link request is not pending");
  }

  // Verify the denying tenant is the target
  if (request.targetTenantId && request.targetTenantId !== denyingTenantId) {
    throw new Error("Not authorized to deny this request");
  }

  await prisma.animalLinkRequest.update({
    where: { id: requestId },
    data: {
      status: "DENIED",
      respondedAt: new Date(),
      denialReason: reason,
      responseMessage,
    },
  });
}

/**
 * Get pending incoming link requests for a tenant
 */
export async function getPendingRequestsForTenant(
  tenantId: number
): Promise<LinkRequestWithDetails[]> {
  const requests = await prisma.animalLinkRequest.findMany({
    where: {
      targetTenantId: tenantId,
      status: "PENDING",
    },
    include: {
      sourceAnimal: {
        select: { id: true, name: true, species: true, sex: true, photoUrl: true },
      },
      requestingTenant: { select: { id: true, name: true } },
      targetAnimal: {
        select: { id: true, name: true, species: true, sex: true, photoUrl: true },
      },
      targetTenant: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map(mapRequestToDetails);
}

/**
 * Get outgoing link requests for a tenant
 */
export async function getOutgoingRequests(
  tenantId: number
): Promise<LinkRequestWithDetails[]> {
  const requests = await prisma.animalLinkRequest.findMany({
    where: {
      requestingTenantId: tenantId,
    },
    include: {
      sourceAnimal: {
        select: { id: true, name: true, species: true, sex: true, photoUrl: true },
      },
      requestingTenant: { select: { id: true, name: true } },
      targetAnimal: {
        select: { id: true, name: true, species: true, sex: true, photoUrl: true },
      },
      targetTenant: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map(mapRequestToDetails);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Link Management
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Get active cross-tenant links for an animal
 */
export async function getActiveLinksForAnimal(
  animalId: number,
  tenantId: number
): Promise<
  Array<{
    id: number;
    parentType: ParentType;
    linkMethod: LinkMethod;
    createdAt: Date;
    linkedAnimal: {
      id: number;
      name: string;
      species: Species;
      sex: Sex;
      photoUrl: string | null;
      tenantName: string;
    };
    canRevoke: boolean;
  }>
> {
  // Get links where this animal is the child (has linked parents)
  const asChild = await prisma.crossTenantAnimalLink.findMany({
    where: {
      childAnimalId: animalId,
      active: true,
    },
    include: {
      parentAnimal: {
        select: { id: true, name: true, species: true, sex: true, photoUrl: true },
      },
      parentTenant: { select: { name: true } },
    },
  });

  // Get links where this animal is the parent (is linked by others)
  const asParent = await prisma.crossTenantAnimalLink.findMany({
    where: {
      parentAnimalId: animalId,
      active: true,
    },
    include: {
      childAnimal: {
        select: { id: true, name: true, species: true, sex: true, photoUrl: true },
      },
      childTenant: { select: { name: true } },
    },
  });

  const results = [];

  for (const link of asChild) {
    results.push({
      id: link.id,
      parentType: link.parentType,
      linkMethod: link.linkMethod,
      createdAt: link.createdAt,
      linkedAnimal: {
        id: link.parentAnimal.id,
        name: link.parentAnimal.name,
        species: link.parentAnimal.species,
        sex: link.parentAnimal.sex,
        photoUrl: link.parentAnimal.photoUrl,
        tenantName: link.parentTenant.name,
      },
      canRevoke: link.childTenantId === tenantId,
    });
  }

  for (const link of asParent) {
    results.push({
      id: link.id,
      parentType: link.parentType,
      linkMethod: link.linkMethod,
      createdAt: link.createdAt,
      linkedAnimal: {
        id: link.childAnimal.id,
        name: link.childAnimal.name,
        species: link.childAnimal.species,
        sex: link.childAnimal.sex,
        photoUrl: link.childAnimal.photoUrl,
        tenantName: link.childTenant.name,
      },
      canRevoke: link.parentTenantId === tenantId,
    });
  }

  return results;
}

/**
 * Revoke a cross-tenant link
 */
export async function revokeLink(
  linkId: number,
  revokingTenantId: number,
  reason?: string
): Promise<void> {
  const link = await prisma.crossTenantAnimalLink.findUnique({
    where: { id: linkId },
  });

  if (!link) {
    throw new Error("Link not found");
  }

  if (!link.active) {
    throw new Error("Link is already revoked");
  }

  // Determine who is revoking
  let revokedBy: RevokedBy;
  if (link.childTenantId === revokingTenantId) {
    revokedBy = "CHILD_OWNER";
  } else if (link.parentTenantId === revokingTenantId) {
    revokedBy = "PARENT_OWNER";
  } else {
    throw new Error("Not authorized to revoke this link");
  }

  await prisma.crossTenantAnimalLink.update({
    where: { id: linkId },
    data: {
      active: false,
      revokedAt: new Date(),
      revokedBy,
      revocationReason: reason,
    },
  });

  // Also update the original request status if it exists
  if (link.linkRequestId) {
    await prisma.animalLinkRequest.update({
      where: { id: link.linkRequestId },
      data: { status: "REVOKED" },
    });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Exchange Code Management
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Generate a new exchange code for an animal
 */
export async function generateAnimalExchangeCode(
  animalId: number,
  tenantId: number
): Promise<{ code: string; expiresAt: Date }> {
  // Verify ownership
  const animal = await prisma.animal.findFirst({
    where: { id: animalId, tenantId },
  });

  if (!animal) {
    throw new Error("Animal not found or doesn't belong to your account");
  }

  const code = generateExchangeCode(animal.name);
  const expiresAt = calculateExchangeCodeExpiry();

  await prisma.animal.update({
    where: { id: animalId },
    data: {
      exchangeCode: code,
      exchangeCodeExpiresAt: expiresAt,
    },
  });

  return { code, expiresAt };
}

/**
 * Clear an animal's exchange code
 */
export async function clearAnimalExchangeCode(
  animalId: number,
  tenantId: number
): Promise<void> {
  const animal = await prisma.animal.findFirst({
    where: { id: animalId, tenantId },
  });

  if (!animal) {
    throw new Error("Animal not found or doesn't belong to your account");
  }

  await prisma.animal.update({
    where: { id: animalId },
    data: {
      exchangeCode: null,
      exchangeCodeExpiresAt: null,
    },
  });
}

/**
 * Get exchange code for an animal
 */
export async function getAnimalExchangeCode(
  animalId: number,
  tenantId: number
): Promise<{ code: string | null; expiresAt: Date | null; isExpired: boolean }> {
  const animal = await prisma.animal.findFirst({
    where: { id: animalId, tenantId },
    select: { exchangeCode: true, exchangeCodeExpiresAt: true },
  });

  if (!animal) {
    throw new Error("Animal not found or doesn't belong to your account");
  }

  return {
    code: animal.exchangeCode,
    expiresAt: animal.exchangeCodeExpiresAt,
    isExpired: isExchangeCodeExpired(animal.exchangeCodeExpiresAt),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * GAID Management
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Ensure an animal has a GAID (via GlobalAnimalIdentity)
 */
export async function ensureAnimalHasGaid(
  animalId: number,
  tenantId: number
): Promise<string> {
  const animal = await prisma.animal.findFirst({
    where: { id: animalId, tenantId },
    include: {
      identityLink: {
        include: { identity: true },
      },
    },
  });

  if (!animal) {
    throw new Error("Animal not found or doesn't belong to your account");
  }

  // If already linked to a global identity with GAID, return it
  if (animal.identityLink?.identity?.gaid) {
    return animal.identityLink.identity.gaid;
  }

  // Create or update global identity with GAID
  const gaid = generateGaid(animal.species);

  if (animal.identityLink) {
    // Update existing identity
    await prisma.globalAnimalIdentity.update({
      where: { id: animal.identityLink.identityId },
      data: { gaid },
    });
  } else {
    // Create new global identity and link
    const identity = await prisma.globalAnimalIdentity.create({
      data: {
        species: animal.species,
        sex: animal.sex,
        birthDate: animal.birthDate,
        name: animal.name,
        gaid,
      },
    });

    await prisma.animalIdentityLink.create({
      data: {
        animalId,
        identityId: identity.id,
        confidence: 1.0,
        matchedOn: ["manual"],
        autoMatched: false,
      },
    });
  }

  return gaid;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Helper Functions
 * ───────────────────────────────────────────────────────────────────────────── */

function buildNetworkAnimalResult(
  animal: any,
  globalIdentityId: number | null,
  gaid: string | null,
  privacy: any
): NetworkAnimalResult {
  return {
    animalId: animal.id,
    tenantId: animal.tenantId,
    globalIdentityId,
    gaid,
    name: privacy?.showName !== false ? animal.name : null,
    species: animal.species,
    sex: animal.sex,
    breed: animal.breed,
    birthDate: privacy?.showFullDob !== false ? animal.birthDate : null,
    photoUrl: privacy?.showPhoto !== false ? animal.photoUrl : null,
    tenantName: privacy?.showBreeder !== false ? animal.tenant?.name : null,
    titlePrefix: privacy?.showTitles !== false ? animal.titlePrefix : null,
    titleSuffix: privacy?.showTitles !== false ? animal.titleSuffix : null,
    registryNumbers: privacy?.showRegistryFull !== false
      ? animal.registryIds?.map((r: any) => ({
          registry: r.registry?.code ?? r.registry?.name ?? "Unknown",
          number: r.identifier,
        })) ?? []
      : animal.registryIds?.map((r: any) => ({
          registry: r.registry?.code ?? r.registry?.name ?? "Unknown",
          number: "****" + r.identifier.slice(-4),
        })) ?? [],
  };
}

function mapRequestToDetails(request: any): LinkRequestWithDetails {
  return {
    id: request.id,
    createdAt: request.createdAt,
    status: request.status,
    relationshipType: request.relationshipType,
    message: request.message,
    responseMessage: request.responseMessage,
    denialReason: request.denialReason,
    sourceAnimal: request.sourceAnimal,
    requestingTenant: request.requestingTenant,
    targetAnimal: request.targetAnimal,
    targetTenant: request.targetTenant,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Export
 * ───────────────────────────────────────────────────────────────────────────── */

export default {
  // Discovery
  searchByGaid,
  searchByExchangeCode,
  searchByRegistry,
  searchBreederByEmailOrPhone,
  getBreederShareableAnimals,
  // Link requests
  createLinkRequest,
  approveLinkRequest,
  denyLinkRequest,
  getPendingRequestsForTenant,
  getOutgoingRequests,
  // Link management
  getActiveLinksForAnimal,
  revokeLink,
  // Exchange codes
  generateAnimalExchangeCode,
  clearAnimalExchangeCode,
  getAnimalExchangeCode,
  // GAID
  ensureAnimalHasGaid,
};
