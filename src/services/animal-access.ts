import prisma from "../prisma.js";
import type {
  AnimalAccessTier,
  AnimalAccessStatus,
  Species,
  Sex,
} from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Animal Access (Shadow Animal) Service
// Manages cross-tenant animal visibility with tiered access
// ─────────────────────────────────────────────────────────────────────────────

// Fields visible at each access tier (cumulative)
const TIER_FIELDS: Record<AnimalAccessTier, string[]> = {
  BASIC: [
    "id",
    "name",
    "photoUrl",
    "species",
    "sex",
    "breed",
    "status",
    "birthDate",
  ],
  GENETICS: [
    "id",
    "name",
    "photoUrl",
    "species",
    "sex",
    "breed",
    "status",
    "birthDate",
    "genetics",
    "loci",
  ],
  LINEAGE: [
    "id",
    "name",
    "photoUrl",
    "species",
    "sex",
    "breed",
    "status",
    "birthDate",
    "genetics",
    "loci",
    "damId",
    "sireId",
    "dam",
    "sire",
  ],
  HEALTH: [
    "id",
    "name",
    "photoUrl",
    "species",
    "sex",
    "breed",
    "status",
    "birthDate",
    "genetics",
    "loci",
    "damId",
    "sireId",
    "dam",
    "sire",
    "TestResult",
    "VaccinationRecord",
  ],
  FULL: ["*"],
};

function filterAnimalDataByTier(
  animal: Record<string, any> | null,
  accessTier: AnimalAccessTier
): Record<string, any> | null {
  if (!animal) return null;

  if (accessTier === "FULL") return animal;

  const allowedFields = TIER_FIELDS[accessTier];
  const filtered: Record<string, any> = {};
  for (const field of allowedFields) {
    if (field in animal) {
      filtered[field] = animal[field];
    }
  }
  return filtered;
}

// Animal includes based on tier
function getAnimalInclude(accessTier: AnimalAccessTier) {
  const base = { genetics: false, loci: false, dam: false, sire: false, TestResult: false, VaccinationRecord: false };

  if (accessTier === "GENETICS" || accessTier === "LINEAGE" || accessTier === "HEALTH" || accessTier === "FULL") {
    base.genetics = true;
    base.loci = true;
  }
  if (accessTier === "LINEAGE" || accessTier === "HEALTH" || accessTier === "FULL") {
    base.dam = true;
    base.sire = true;
  }
  if (accessTier === "HEALTH" || accessTier === "FULL") {
    base.TestResult = true;
    base.VaccinationRecord = true;
  }

  return base;
}

export async function getAccessForTenant(
  tenantId: number,
  options?: {
    status?: AnimalAccessStatus;
    species?: Species;
    sex?: Sex;
    page?: number;
    limit?: number;
  }
) {
  const page = options?.page ?? 1;
  const limit = Math.min(options?.limit ?? 25, 100);
  const skip = (page - 1) * limit;

  const where: any = {
    accessorTenantId: tenantId,
    status: options?.status ?? "ACTIVE",
  };

  // Filter by species/sex on the related animal
  if (options?.species || options?.sex) {
    where.animal = {};
    if (options?.species) where.animal.species = options.species;
    if (options?.sex) where.animal.sex = options.sex;
  }

  const [data, total] = await Promise.all([
    prisma.animalAccess.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        animal: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
            species: true,
            sex: true,
            breed: true,
            status: true,
            birthDate: true,
          },
        },
        ownerTenant: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
          },
        },
      },
    }),
    prisma.animalAccess.count({ where }),
  ]);

  // Filter animal data by access tier
  const filtered = data.map((access) => ({
    ...access,
    animal: filterAnimalDataByTier(
      access.animal as Record<string, any> | null,
      access.accessTier
    ),
  }));

  return {
    data: filtered,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
  };
}

export async function getAccessById(
  id: number,
  accessorTenantId: number
) {
  const access = await prisma.animalAccess.findFirst({
    where: { id, accessorTenantId },
    include: {
      animal: true,
      ownerTenant: {
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
        },
      },
    },
  });

  if (!access) {
    throw Object.assign(new Error("access_not_found"), { statusCode: 404 });
  }

  return {
    ...access,
    animal: filterAnimalDataByTier(
      access.animal as Record<string, any> | null,
      access.accessTier
    ),
  };
}

export async function getSharedByTenant(
  tenantId: number,
  options?: {
    animalId?: number;
    status?: AnimalAccessStatus;
    page?: number;
    limit?: number;
  }
) {
  const page = options?.page ?? 1;
  const limit = Math.min(options?.limit ?? 25, 100);
  const skip = (page - 1) * limit;

  const where: any = {
    ownerTenantId: tenantId,
  };
  if (options?.animalId) where.animalId = options.animalId;
  if (options?.status) where.status = options.status;

  const [data, total] = await Promise.all([
    prisma.animalAccess.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        animal: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
            species: true,
            sex: true,
          },
        },
        accessorTenant: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
          },
        },
      },
    }),
    prisma.animalAccess.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
  };
}

export async function removeAccess(
  id: number,
  accessorTenantId: number
): Promise<void> {
  const access = await prisma.animalAccess.findFirst({
    where: { id, accessorTenantId, status: "ACTIVE" },
  });

  if (!access) {
    throw Object.assign(new Error("access_not_found"), { statusCode: 404 });
  }

  await prisma.animalAccess.update({
    where: { id },
    data: { status: "REVOKED" },
  });
}

export async function revokeAccessByOwner(
  id: number,
  ownerTenantId: number
): Promise<void> {
  const access = await prisma.animalAccess.findFirst({
    where: { id, ownerTenantId, status: "ACTIVE" },
  });

  if (!access) {
    throw Object.assign(new Error("access_not_found"), { statusCode: 404 });
  }

  await prisma.animalAccess.update({
    where: { id },
    data: { status: "REVOKED" },
  });
}

export async function upgradeAccessTier(
  id: number,
  ownerTenantId: number,
  newTier: AnimalAccessTier
) {
  const access = await prisma.animalAccess.findFirst({
    where: { id, ownerTenantId, status: "ACTIVE" },
  });

  if (!access) {
    throw Object.assign(new Error("access_not_found"), { statusCode: 404 });
  }

  return prisma.animalAccess.update({
    where: { id },
    data: { accessTier: newTier },
  });
}

// Tiers that include genetics data (used for Genetics Lab pairing searches)
const GENETICS_ELIGIBLE_TIERS: AnimalAccessTier[] = [
  "GENETICS",
  "LINEAGE",
  "HEALTH",
  "FULL",
];

/**
 * Get shadow animals with GENETICS+ access tier for use in Genetics Lab
 * pairing searches. Returns animals with full genetics data included.
 */
export async function getGeneticsEligibleAccess(
  tenantId: number,
  options?: {
    species?: Species;
    sex?: Sex;
  }
) {
  const where: any = {
    accessorTenantId: tenantId,
    status: "ACTIVE",
    accessTier: { in: GENETICS_ELIGIBLE_TIERS },
    animal: { isNot: null },
  };

  if (options?.species || options?.sex) {
    where.animal = { ...where.animal };
    if (options?.species) where.animal.species = options.species;
    if (options?.sex) where.animal.sex = options.sex;
  }

  const data = await prisma.animalAccess.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      animal: {
        include: {
          genetics: true,
          loci: true,
        },
      },
      ownerTenant: {
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
        },
      },
    },
  });

  return data.map((access) => ({
    animalAccessId: access.id,
    accessTier: access.accessTier,
    ownerTenantId: access.ownerTenantId,
    ownerName: access.ownerTenant.name,
    animal: access.animal
      ? {
          id: access.animal.id,
          name: access.animal.name,
          photoUrl: (access.animal as any).photoUrl ?? null,
          species: access.animal.species,
          sex: access.animal.sex,
          breed: (access.animal as any).breed ?? null,
          genetics: (access.animal as any).genetics ?? null,
          loci: (access.animal as any).loci ?? [],
        }
      : null,
  }));
}

export async function handleAnimalDeleted(animalId: number): Promise<void> {
  // Snapshot animal data before nullifying
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    select: { name: true, species: true, sex: true },
  });

  if (!animal) return;

  await prisma.animalAccess.updateMany({
    where: { animalId, status: "ACTIVE" },
    data: {
      status: "OWNER_DELETED",
      deletedAt: new Date(),
      animalNameSnapshot: animal.name,
      animalSpeciesSnapshot: animal.species,
      animalSexSnapshot: animal.sex,
    },
  });
}
