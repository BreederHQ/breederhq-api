/**
 * Breeding Inquiry Service
 *
 * Manages network breeding inquiries sent between breeders via Network Search.
 * Distinct from marketplace BreedingInquiry (listing-based inquiries).
 *
 * Privacy rules:
 * - Sender NEVER sees which specific animals matched
 * - Recipient sees matching animals (for their own animals)
 * - Rate limited to 20 inquiries/day per sender
 *
 * See: docs/codebase/api/NETWORK-BREEDING-DISCOVERY-API.md
 */

import prisma from "../prisma.js";
import type { NetworkInquiryStatus } from "@prisma/client";
import { searchNetwork, type NetworkSearchCriteria } from "./network-search-index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DAILY_INQUIRY_LIMIT = 20;

// ─────────────────────────────────────────────────────────────────────────────
// sendInquiry
// ─────────────────────────────────────────────────────────────────────────────

export interface SendInquiryOptions {
  senderTenantId: number;
  recipientTenantId: number;
  searchCriteria: NetworkSearchCriteria;
  message?: string;
}

export async function sendInquiry(options: SendInquiryOptions) {
  const { senderTenantId, recipientTenantId, searchCriteria, message } = options;

  // Cannot send inquiry to yourself
  if (senderTenantId === recipientTenantId) {
    throw Object.assign(new Error("cannot_inquire_self"), { statusCode: 400 });
  }

  // Check recipient exists and accepts inquiries
  const recipient = await prisma.tenant.findUnique({
    where: { id: recipientTenantId },
    select: {
      id: true,
      name: true,
      networkVisibility: true,
      inquiryPermission: true,
    },
  });

  if (!recipient) {
    throw Object.assign(new Error("recipient_not_found"), { statusCode: 404 });
  }

  if (recipient.networkVisibility === "HIDDEN") {
    throw Object.assign(new Error("recipient_not_found"), { statusCode: 404 });
  }

  // Check inquiry permission
  if (recipient.inquiryPermission === "CONNECTIONS") {
    // For now, CONNECTIONS means nobody can cold-inquiry (future: check connection table)
    throw Object.assign(
      new Error("recipient_does_not_accept_inquiries"),
      { statusCode: 403 }
    );
  }

  // Rate limit: max 20 inquiries per day per sender
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await prisma.networkBreedingInquiry.count({
    where: {
      senderTenantId,
      createdAt: { gte: oneDayAgo },
    },
  });

  if (recentCount >= DAILY_INQUIRY_LIMIT) {
    const retryAfterMs = 24 * 60 * 60 * 1000; // Simplified: 24 hours
    throw Object.assign(new Error("rate_limit_exceeded"), {
      statusCode: 429,
      retryAfter: Math.ceil(retryAfterMs / 1000),
    });
  }

  // Find which of the recipient's animals actually match the search criteria
  const { matchingAnimalIds, matchedTraits } = await findMatchingAnimals(
    recipientTenantId,
    searchCriteria
  );

  // Resolve Party IDs for both tenants (Organization → Party)
  const [senderOrg, recipientOrg] = await Promise.all([
    prisma.organization.findFirst({
      where: { tenantId: senderTenantId },
      select: { partyId: true, name: true },
    }),
    prisma.organization.findFirst({
      where: { tenantId: recipientTenantId },
      select: { partyId: true },
    }),
  ]);

  if (!senderOrg || !recipientOrg) {
    throw Object.assign(new Error("organization_not_found"), { statusCode: 500 });
  }

  // Create inquiry + message thread in a transaction
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    // Create the message thread for this inquiry conversation
    const thread = await tx.messageThread.create({
      data: {
        tenantId: recipientTenantId,
        subject: `Breeding Inquiry from ${senderOrg.name ?? "a breeder"}`,
        contextType: "NETWORK_BREEDING_INQUIRY",
        lastMessageAt: now,
        participants: {
          create: [
            { partyId: senderOrg.partyId },
            { partyId: recipientOrg.partyId, lastReadAt: now },
          ],
        },
      },
    });

    // Create the initial message if provided
    if (message) {
      await tx.message.create({
        data: {
          threadId: thread.id,
          senderPartyId: senderOrg.partyId,
          body: message,
        },
      });
    }

    // Create the inquiry record
    const inquiry = await tx.networkBreedingInquiry.create({
      data: {
        senderTenantId,
        recipientTenantId,
        searchCriteria: searchCriteria as any,
        matchingAnimalIds,
        matchedTraits,
        message,
        messageThreadId: thread.id,
      },
    });

    // Send notification to recipient
    const idempotencyKey = `network_inquiry:${inquiry.id}`;
    await tx.notification.create({
      data: {
        tenantId: recipientTenantId,
        userId: null, // Notify all tenant users
        type: "network_breeding_inquiry",
        priority: "HIGH",
        title: "New Breeding Inquiry",
        message: `${senderOrg.name ?? "A breeder"} is interested in breeding with your animals.`,
        linkUrl: `/communications?tab=network&inquiry=${inquiry.id}`,
        status: "UNREAD",
        idempotencyKey,
      },
    });

    return {
      inquiry,
      messageThread: thread,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getInquiriesReceived
// ─────────────────────────────────────────────────────────────────────────────

export async function getInquiriesReceived(
  tenantId: number,
  options?: {
    status?: NetworkInquiryStatus;
    page?: number;
    limit?: number;
  }
) {
  const page = options?.page ?? 1;
  const limit = Math.min(options?.limit ?? 20, 50);
  const skip = (page - 1) * limit;

  const where: any = { recipientTenantId: tenantId };
  if (options?.status) {
    where.status = options.status;
  }

  const [data, total] = await Promise.all([
    prisma.networkBreedingInquiry.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        senderTenant: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
          },
        },
        messageThread: {
          select: { id: true },
        },
      },
    }),
    prisma.networkBreedingInquiry.count({ where }),
  ]);

  // Resolve matching animals for the recipient (they own these animals)
  const enriched = await Promise.all(
    data.map(async (inquiry) => {
      const matchingAnimals = await resolveMatchingAnimals(
        inquiry.matchingAnimalIds,
        tenantId
      );

      return {
        id: inquiry.id,
        sender: {
          id: inquiry.senderTenant.id,
          name: inquiry.senderTenant.name,
          location: formatLocation(
            inquiry.senderTenant.city,
            inquiry.senderTenant.region
          ),
        },
        searchCriteria: inquiry.searchCriteria,
        message: inquiry.message,
        matchingAnimals,
        matchedTraits: inquiry.matchedTraits,
        status: inquiry.status,
        conversationId: inquiry.messageThread?.id ?? null,
        respondedAt: inquiry.respondedAt,
        createdAt: inquiry.createdAt,
      };
    })
  );

  return {
    data: enriched,
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
// getInquiriesSent
// ─────────────────────────────────────────────────────────────────────────────

export async function getInquiriesSent(
  tenantId: number,
  options?: {
    status?: NetworkInquiryStatus;
    page?: number;
    limit?: number;
  }
) {
  const page = options?.page ?? 1;
  const limit = Math.min(options?.limit ?? 20, 50);
  const skip = (page - 1) * limit;

  const where: any = { senderTenantId: tenantId };
  if (options?.status) {
    where.status = options.status;
  }

  const [data, total] = await Promise.all([
    prisma.networkBreedingInquiry.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        recipientTenant: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
            networkVisibility: true,
          },
        },
        messageThread: {
          select: { id: true },
        },
      },
    }),
    prisma.networkBreedingInquiry.count({ where }),
  ]);

  // Sender view: NO matching animal IDs (privacy)
  const sanitized = data.map((inquiry) => {
    const isAnonymous =
      inquiry.recipientTenant.networkVisibility === "ANONYMOUS";

    return {
      id: inquiry.id,
      recipient: {
        id: inquiry.recipientTenant.id,
        name: isAnonymous ? "A breeder" : inquiry.recipientTenant.name,
        location: isAnonymous
          ? null
          : formatLocation(
              inquiry.recipientTenant.city,
              inquiry.recipientTenant.region
            ),
      },
      searchCriteria: inquiry.searchCriteria,
      message: inquiry.message,
      // NO matchingAnimals — sender never sees which animals matched
      matchedTraits: inquiry.matchedTraits,
      status: inquiry.status,
      conversationId: inquiry.messageThread?.id ?? null,
      respondedAt: inquiry.respondedAt,
      createdAt: inquiry.createdAt,
    };
  });

  return {
    data: sanitized,
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
// getInquiryById
// ─────────────────────────────────────────────────────────────────────────────

export async function getInquiryById(
  inquiryId: number,
  tenantId: number
) {
  const inquiry = await prisma.networkBreedingInquiry.findUnique({
    where: { id: inquiryId },
    include: {
      senderTenant: {
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
          networkVisibility: true,
        },
      },
      recipientTenant: {
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
          networkVisibility: true,
        },
      },
      messageThread: {
        select: { id: true },
      },
    },
  });

  if (!inquiry) {
    throw Object.assign(new Error("inquiry_not_found"), { statusCode: 404 });
  }

  // Verify the requesting tenant is either the sender or recipient
  const isSender = inquiry.senderTenantId === tenantId;
  const isRecipient = inquiry.recipientTenantId === tenantId;

  if (!isSender && !isRecipient) {
    throw Object.assign(new Error("inquiry_not_found"), { statusCode: 404 });
  }

  if (isRecipient) {
    // Recipient sees full detail including matching animals
    const matchingAnimals = await resolveMatchingAnimals(
      inquiry.matchingAnimalIds,
      tenantId
    );

    return {
      id: inquiry.id,
      sender: {
        id: inquiry.senderTenant.id,
        name: inquiry.senderTenant.name,
        location: formatLocation(
          inquiry.senderTenant.city,
          inquiry.senderTenant.region
        ),
      },
      searchCriteria: inquiry.searchCriteria,
      message: inquiry.message,
      matchingAnimals,
      matchedTraits: inquiry.matchedTraits,
      status: inquiry.status,
      conversationId: inquiry.messageThread?.id ?? null,
      respondedAt: inquiry.respondedAt,
      createdAt: inquiry.createdAt,
    };
  }

  // Sender sees limited detail (no matching animals)
  const isAnonymous =
    inquiry.recipientTenant.networkVisibility === "ANONYMOUS";

  return {
    id: inquiry.id,
    recipient: {
      id: inquiry.recipientTenant.id,
      name: isAnonymous ? "A breeder" : inquiry.recipientTenant.name,
      location: isAnonymous
        ? null
        : formatLocation(
            inquiry.recipientTenant.city,
            inquiry.recipientTenant.region
          ),
    },
    searchCriteria: inquiry.searchCriteria,
    message: inquiry.message,
    // NO matchingAnimals for sender
    matchedTraits: inquiry.matchedTraits,
    status: inquiry.status,
    conversationId: inquiry.messageThread?.id ?? null,
    respondedAt: inquiry.respondedAt,
    createdAt: inquiry.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// respondToInquiry
// ─────────────────────────────────────────────────────────────────────────────

export async function respondToInquiry(
  inquiryId: number,
  recipientTenantId: number,
  action: "respond" | "decline"
) {
  const inquiry = await prisma.networkBreedingInquiry.findFirst({
    where: {
      id: inquiryId,
      recipientTenantId,
      status: "PENDING",
    },
  });

  if (!inquiry) {
    throw Object.assign(new Error("inquiry_not_found"), { statusCode: 404 });
  }

  const newStatus: NetworkInquiryStatus =
    action === "respond" ? "RESPONDED" : "DECLINED";

  const updated = await prisma.networkBreedingInquiry.update({
    where: { id: inquiryId },
    data: {
      status: newStatus,
      respondedAt: new Date(),
    },
  });

  // Notify sender of the response
  const recipientTenant = await prisma.tenant.findUnique({
    where: { id: recipientTenantId },
    select: { name: true },
  });

  const idempotencyKey = `network_inquiry_response:${inquiryId}:${action}`;
  await prisma.notification.create({
    data: {
      tenantId: inquiry.senderTenantId,
      userId: null,
      type: "network_inquiry_response",
      priority: "MEDIUM",
      title:
        action === "respond"
          ? "Breeding Inquiry Response"
          : "Breeding Inquiry Declined",
      message:
        action === "respond"
          ? `${recipientTenant?.name ?? "A breeder"} responded to your breeding inquiry.`
          : `${recipientTenant?.name ?? "A breeder"} declined your breeding inquiry.`,
      linkUrl: `/communications?tab=network&inquiry=${inquiryId}`,
      status: "UNREAD",
      idempotencyKey,
    },
  });

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveMatchingAnimals (private helper)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve matching animal IDs into animal details.
 * Only called for the RECIPIENT — they own these animals.
 */
async function resolveMatchingAnimals(
  animalIds: number[],
  recipientTenantId: number
) {
  if (animalIds.length === 0) return [];

  const animals = await prisma.animal.findMany({
    where: {
      id: { in: animalIds },
      tenantId: recipientTenantId,
    },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      species: true,
      sex: true,
      breed: true,
    },
  });

  return animals;
}

// ─────────────────────────────────────────────────────────────────────────────
// findMatchingAnimals (private helper)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find which of the recipient's animals match the search criteria.
 * This is stored privately — only the recipient can see the results.
 */
async function findMatchingAnimals(
  recipientTenantId: number,
  criteria: NetworkSearchCriteria
): Promise<{ matchingAnimalIds: number[]; matchedTraits: string[] }> {
  // Get animals matching species + sex
  const candidateAnimals = await prisma.animal.findMany({
    where: {
      tenantId: recipientTenantId,
      species: criteria.species,
      sex: criteria.sex,
      networkSearchVisible: true,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      loci: {
        select: {
          locus: true,
          genotype: true,
          category: true,
        },
      },
    },
  });

  const matchingIds: number[] = [];
  const allMatchedTraits = new Set<string>();

  for (const animal of candidateAnimals) {
    let matches = true;
    const animalTraits: string[] = [];

    // Check genetic criteria
    if (criteria.genetics && criteria.genetics.length > 0) {
      for (const criterion of criteria.genetics) {
        const animalLocus = animal.loci.find(
          (l) => l.locus === criterion.locus && l.genotype != null
        );

        if (!animalLocus || !animalLocus.genotype) {
          matches = false;
          break;
        }

        const hasMatch = criterion.acceptableGenotypes.includes(
          animalLocus.genotype
        );
        if (!hasMatch) {
          matches = false;
          break;
        }

        animalTraits.push(`${criterion.locus} status`);
      }
    }

    if (!matches) continue;

    // Check health criteria
    if (criteria.health && criteria.health.length > 0) {
      for (const criterion of criteria.health) {
        const healthLocus = animal.loci.find(
          (l) =>
            l.locus === criterion.test &&
            l.category === "health" &&
            l.genotype != null
        );

        if (!healthLocus || !healthLocus.genotype) {
          matches = false;
          break;
        }

        const hasMatch = criterion.acceptableStatuses.includes(
          healthLocus.genotype
        );
        if (!hasMatch) {
          matches = false;
          break;
        }

        animalTraits.push(`${criterion.test} clearance`);
      }
    }

    if (matches) {
      matchingIds.push(animal.id);
      for (const trait of animalTraits) {
        allMatchedTraits.add(trait);
      }
    }
  }

  return {
    matchingAnimalIds: matchingIds,
    matchedTraits: Array.from(allMatchedTraits),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatLocation(
  city: string | null,
  region: string | null
): string | null {
  if (city && region) return `${city}, ${region}`;
  return city ?? region ?? null;
}
