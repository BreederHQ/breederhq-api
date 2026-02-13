/**
 * Breeding Data Agreement Service
 *
 * Manages formal breeding collaboration agreements.
 * Created when a shadow animal (via AnimalAccess) is added to a breeding plan,
 * requiring the animal owner's approval.
 *
 * On approval:
 * - AnimalAccess.expiresAt is set to null (permanent)
 * - AnimalAccess.source is updated to BREEDING_AGREEMENT
 *
 * See: docs/codebase/api/NETWORK-BREEDING-DISCOVERY-API.md
 */

import prisma from "../prisma.js";
import type { BreedingAgreementStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateAgreementOptions {
  breedingPlanId: number;
  animalAccessId: number;
  requestingTenantId: number;
  animalRole: "sire" | "dam";
  message?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// createAgreement
// ─────────────────────────────────────────────────────────────────────────────

export async function createAgreement(options: CreateAgreementOptions) {
  const {
    breedingPlanId,
    animalAccessId,
    requestingTenantId,
    animalRole,
    message,
  } = options;

  // Verify the breeding plan exists and belongs to the requester
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: breedingPlanId, tenantId: requestingTenantId },
    select: { id: true, name: true },
  });

  if (!plan) {
    throw Object.assign(new Error("breeding_plan_not_found"), {
      statusCode: 404,
    });
  }

  // Verify the animal access exists and the requester is the accessor
  const access = await prisma.animalAccess.findFirst({
    where: { id: animalAccessId, accessorTenantId: requestingTenantId, status: "ACTIVE" },
    select: {
      id: true,
      ownerTenantId: true,
      animalId: true,
      animal: { select: { name: true } },
    },
  });

  if (!access) {
    throw Object.assign(new Error("animal_access_not_found"), {
      statusCode: 404,
    });
  }

  // Cannot request agreement with yourself
  if (access.ownerTenantId === requestingTenantId) {
    throw Object.assign(new Error("cannot_agree_with_self"), {
      statusCode: 400,
    });
  }

  // Check for existing agreement on the same plan + access
  const existing = await prisma.breedingDataAgreement.findUnique({
    where: {
      breedingPlanId_animalAccessId: {
        breedingPlanId,
        animalAccessId,
      },
    },
  });

  if (existing) {
    if (existing.status === "PENDING") {
      throw Object.assign(new Error("agreement_already_pending"), {
        statusCode: 409,
      });
    }
    if (existing.status === "APPROVED") {
      throw Object.assign(new Error("agreement_already_approved"), {
        statusCode: 409,
      });
    }
    // If REJECTED or EXPIRED, allow a new request by deleting the old one
    await prisma.breedingDataAgreement.delete({ where: { id: existing.id } });
  }

  // Resolve requester org for notification
  const requesterOrg = await prisma.organization.findFirst({
    where: { tenantId: requestingTenantId },
    select: { name: true },
  });

  const animalName = access.animal?.name ?? "an animal";
  const approvingTenantId = access.ownerTenantId;

  // Create the agreement and notify the owner
  return prisma.$transaction(async (tx) => {
    const agreement = await tx.breedingDataAgreement.create({
      data: {
        breedingPlanId,
        animalAccessId,
        requestingTenantId,
        approvingTenantId,
        animalRole,
        requestMessage: message,
      },
    });

    // Notify the animal owner
    const idempotencyKey = `breeding_agreement_request:${agreement.id}`;
    await tx.notification.create({
      data: {
        tenantId: approvingTenantId,
        userId: null,
        type: "breeding_data_agreement_request",
        priority: "HIGH",
        title: "Breeding Data Agreement Request",
        message: `${requesterOrg?.name ?? "A breeder"} wants to use ${animalName} in a breeding plan and is requesting data access.`,
        linkUrl: `/breeding/agreements?id=${agreement.id}`,
        status: "UNREAD",
        idempotencyKey,
      },
    });

    return agreement;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// approveAgreement
// ─────────────────────────────────────────────────────────────────────────────

export async function approveAgreement(
  agreementId: string,
  approvingTenantId: number,
  responseMessage?: string
) {
  const agreement = await prisma.breedingDataAgreement.findFirst({
    where: { id: agreementId, approvingTenantId, status: "PENDING" },
    include: {
      animalAccess: { select: { id: true, animal: { select: { name: true } } } },
    },
  });

  if (!agreement) {
    throw Object.assign(new Error("agreement_not_found"), { statusCode: 404 });
  }

  const approverOrg = await prisma.organization.findFirst({
    where: { tenantId: approvingTenantId },
    select: { name: true },
  });

  const animalName = agreement.animalAccess.animal?.name ?? "an animal";
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Update agreement status
    const updated = await tx.breedingDataAgreement.update({
      where: { id: agreementId },
      data: {
        status: "APPROVED",
        approvedAt: now,
        responseMessage,
      },
    });

    // Make the AnimalAccess permanent and update source
    await tx.animalAccess.update({
      where: { id: agreement.animalAccessId },
      data: {
        expiresAt: null,
        source: "BREEDING_AGREEMENT",
      },
    });

    // Notify the requester
    const idempotencyKey = `breeding_agreement_approved:${agreementId}`;
    await tx.notification.create({
      data: {
        tenantId: agreement.requestingTenantId,
        userId: null,
        type: "breeding_data_agreement_approved",
        priority: "HIGH",
        title: "Breeding Agreement Approved",
        message: `${approverOrg?.name ?? "A breeder"} approved your breeding data agreement for ${animalName}.`,
        linkUrl: `/breeding/agreements?id=${agreementId}`,
        status: "UNREAD",
        idempotencyKey,
      },
    });

    return updated;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// rejectAgreement
// ─────────────────────────────────────────────────────────────────────────────

export async function rejectAgreement(
  agreementId: string,
  approvingTenantId: number,
  responseMessage?: string
) {
  const agreement = await prisma.breedingDataAgreement.findFirst({
    where: { id: agreementId, approvingTenantId, status: "PENDING" },
    include: {
      animalAccess: { select: { animal: { select: { name: true } } } },
    },
  });

  if (!agreement) {
    throw Object.assign(new Error("agreement_not_found"), { statusCode: 404 });
  }

  const approverOrg = await prisma.organization.findFirst({
    where: { tenantId: approvingTenantId },
    select: { name: true },
  });

  const animalName = agreement.animalAccess.animal?.name ?? "an animal";

  const updated = await prisma.breedingDataAgreement.update({
    where: { id: agreementId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      responseMessage,
    },
  });

  // Notify the requester
  const idempotencyKey = `breeding_agreement_rejected:${agreementId}`;
  await prisma.notification.create({
    data: {
      tenantId: agreement.requestingTenantId,
      userId: null,
      type: "breeding_data_agreement_rejected",
      priority: "MEDIUM",
      title: "Breeding Agreement Declined",
      message: `${approverOrg?.name ?? "A breeder"} declined your breeding data agreement for ${animalName}.`,
      linkUrl: `/breeding/agreements?id=${agreementId}`,
      status: "UNREAD",
      idempotencyKey,
    },
  });

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// getAgreements
// ─────────────────────────────────────────────────────────────────────────────

export async function getAgreements(
  tenantId: number,
  options?: {
    direction?: "sent" | "received" | "both";
    status?: BreedingAgreementStatus;
    breedingPlanId?: number;
    page?: number;
    limit?: number;
  }
) {
  const page = options?.page ?? 1;
  const limit = Math.min(options?.limit ?? 20, 50);
  const skip = (page - 1) * limit;
  const direction = options?.direction ?? "both";

  const where: any = {};

  if (direction === "sent") {
    where.requestingTenantId = tenantId;
  } else if (direction === "received") {
    where.approvingTenantId = tenantId;
  } else {
    where.OR = [
      { requestingTenantId: tenantId },
      { approvingTenantId: tenantId },
    ];
  }

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.breedingPlanId) {
    where.breedingPlanId = options.breedingPlanId;
  }

  const [data, total] = await Promise.all([
    prisma.breedingDataAgreement.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        breedingPlan: {
          select: { id: true, name: true },
        },
        animalAccess: {
          select: {
            id: true,
            accessTier: true,
            animal: {
              select: {
                id: true,
                name: true,
                photoUrl: true,
                species: true,
                sex: true,
              },
            },
          },
        },
        requestingTenant: {
          select: { id: true, name: true, city: true, region: true },
        },
        approvingTenant: {
          select: { id: true, name: true, city: true, region: true },
        },
      },
    }),
    prisma.breedingDataAgreement.count({ where }),
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

// ─────────────────────────────────────────────────────────────────────────────
// getAgreementById
// ─────────────────────────────────────────────────────────────────────────────

export async function getAgreementById(agreementId: string, tenantId: number) {
  const agreement = await prisma.breedingDataAgreement.findUnique({
    where: { id: agreementId },
    include: {
      breedingPlan: {
        select: { id: true, name: true },
      },
      animalAccess: {
        select: {
          id: true,
          accessTier: true,
          animal: {
            select: {
              id: true,
              name: true,
              photoUrl: true,
              species: true,
              sex: true,
              breed: true,
            },
          },
        },
      },
      requestingTenant: {
        select: { id: true, name: true, city: true, region: true },
      },
      approvingTenant: {
        select: { id: true, name: true, city: true, region: true },
      },
    },
  });

  if (!agreement) {
    throw Object.assign(new Error("agreement_not_found"), { statusCode: 404 });
  }

  // Verify the tenant is either the requester or approver
  if (
    agreement.requestingTenantId !== tenantId &&
    agreement.approvingTenantId !== tenantId
  ) {
    throw Object.assign(new Error("agreement_not_found"), { statusCode: 404 });
  }

  return agreement;
}
