import prisma from "../prisma.js";
import type {
  AnimalAccessTier,
  ShareCode,
  AnimalAccess,
} from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Share Code Service
// Generates and manages shareable codes for cross-tenant animal access
// ─────────────────────────────────────────────────────────────────────────────

const WORD_POOL = [
  "BLUE",
  "GOLD",
  "STAR",
  "MOON",
  "RUBY",
  "JADE",
  "SAGE",
  "DAWN",
];

function generateCodeString(animalName: string): string {
  const prefix = animalName
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const word = WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
  return `${prefix}-${random}-${word}`;
}

export async function generateShareCode(options: {
  tenantId: number;
  animalIds: number[];
  defaultAccessTier?: AnimalAccessTier;
  perAnimalTiers?: Record<string, AnimalAccessTier>;
  expiresAt?: Date | null;
  maxUses?: number | null;
}): Promise<ShareCode> {
  const {
    tenantId,
    animalIds,
    defaultAccessTier = "BASIC",
    perAnimalTiers,
    expiresAt = null,
    maxUses = null,
  } = options;

  if (!animalIds.length) {
    throw Object.assign(new Error("animalIds must not be empty"), {
      statusCode: 400,
    });
  }

  // Verify all animals belong to the tenant
  const animals = await prisma.animal.findMany({
    where: { id: { in: animalIds }, tenantId },
    select: { id: true, name: true },
  });

  if (animals.length !== animalIds.length) {
    throw Object.assign(
      new Error("One or more animals not found or not owned by tenant"),
      { statusCode: 403 }
    );
  }

  // Generate a unique code using first animal's name
  const firstName = animals[0].name || "ANI";
  let code = generateCodeString(firstName);

  // Ensure uniqueness (retry up to 5 times)
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.shareCode.findUnique({ where: { code } });
    if (!existing) break;
    code = generateCodeString(firstName);
  }

  return prisma.shareCode.create({
    data: {
      tenantId,
      code,
      animalIds,
      defaultAccessTier,
      perAnimalTiers: perAnimalTiers ?? undefined,
      expiresAt,
      maxUses,
    },
  });
}

export async function validateShareCode(
  code: string
): Promise<{
  valid: boolean;
  shareCode?: ShareCode;
  error?: string;
}> {
  const shareCode = await prisma.shareCode.findUnique({ where: { code } });

  if (!shareCode) {
    return { valid: false, error: "code_not_found" };
  }

  if (shareCode.status !== "ACTIVE") {
    return { valid: false, shareCode, error: `code_${shareCode.status.toLowerCase()}` };
  }

  if (shareCode.expiresAt && shareCode.expiresAt < new Date()) {
    // Mark as expired
    await prisma.shareCode.update({
      where: { id: shareCode.id },
      data: { status: "EXPIRED" },
    });
    return { valid: false, shareCode, error: "code_expired" };
  }

  if (
    shareCode.maxUses !== null &&
    shareCode.useCount >= shareCode.maxUses
  ) {
    await prisma.shareCode.update({
      where: { id: shareCode.id },
      data: { status: "MAX_USES_REACHED" },
    });
    return { valid: false, shareCode, error: "code_max_uses_reached" };
  }

  return { valid: true, shareCode };
}

export async function redeemShareCode(
  code: string,
  accessorTenantId: number
): Promise<AnimalAccess[]> {
  const validation = await validateShareCode(code);

  if (!validation.valid || !validation.shareCode) {
    throw Object.assign(new Error(validation.error ?? "invalid_code"), {
      statusCode: 410,
    });
  }

  const shareCode = validation.shareCode;

  // Cannot redeem own code
  if (shareCode.tenantId === accessorTenantId) {
    throw Object.assign(new Error("cannot_redeem_own_code"), {
      statusCode: 400,
    });
  }

  // Check for existing access
  const existingAccess = await prisma.animalAccess.findMany({
    where: {
      animalId: { in: shareCode.animalIds },
      accessorTenantId,
      status: "ACTIVE",
    },
    select: { animalId: true },
  });

  const existingAnimalIds = new Set(
    existingAccess.map((a) => a.animalId)
  );
  const newAnimalIds = shareCode.animalIds.filter(
    (id) => !existingAnimalIds.has(id)
  );

  if (newAnimalIds.length === 0) {
    throw Object.assign(new Error("already_have_access"), {
      statusCode: 409,
    });
  }

  // Create access records in a transaction
  return prisma.$transaction(async (tx) => {
    const created: AnimalAccess[] = [];

    for (const animalId of newAnimalIds) {
      const perTier =
        shareCode.perAnimalTiers as Record<string, AnimalAccessTier> | null;
      const tier =
        perTier?.[String(animalId)] ?? shareCode.defaultAccessTier;

      const access = await tx.animalAccess.create({
        data: {
          ownerTenantId: shareCode.tenantId,
          accessorTenantId,
          animalId,
          accessTier: tier,
          source: "SHARE_CODE",
          shareCodeId: shareCode.id,
        },
      });
      created.push(access);
    }

    // Increment use count
    await tx.shareCode.update({
      where: { id: shareCode.id },
      data: { useCount: { increment: 1 } },
    });

    return created;
  });
}

export async function revokeShareCode(
  codeId: number,
  tenantId: number
): Promise<void> {
  const shareCode = await prisma.shareCode.findFirst({
    where: { id: codeId, tenantId },
  });

  if (!shareCode) {
    throw Object.assign(new Error("share_code_not_found"), {
      statusCode: 404,
    });
  }

  await prisma.$transaction([
    prisma.shareCode.update({
      where: { id: codeId },
      data: { status: "REVOKED", revokedAt: new Date() },
    }),
    prisma.animalAccess.updateMany({
      where: { shareCodeId: codeId, status: "ACTIVE" },
      data: { status: "REVOKED" },
    }),
  ]);
}

export async function getShareCodesForTenant(
  tenantId: number,
  statusFilter?: string
): Promise<ShareCode[]> {
  const where: any = { tenantId };
  if (statusFilter) {
    where.status = statusFilter;
  }

  return prisma.shareCode.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { accesses: true } },
    },
  });
}

export async function getShareCodeById(
  id: number,
  tenantId: number
): Promise<ShareCode | null> {
  return prisma.shareCode.findFirst({
    where: { id, tenantId },
    include: {
      accesses: {
        select: {
          id: true,
          accessorTenantId: true,
          accessTier: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });
}
