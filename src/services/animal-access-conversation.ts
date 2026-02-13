import prisma from "../prisma.js";

// ─────────────────────────────────────────────────────────────────────────────
// Animal Access Conversation Service
// Manages per-animal messaging between owner and accessor tenants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get or create the organization party for a tenant.
 * Every tenant has an Organization with a partyId - this is used for messaging.
 */
async function getOrgPartyId(tenantId: number): Promise<number> {
  const org = await prisma.organization.findFirst({
    where: { tenantId },
    select: { partyId: true },
  });
  if (!org) {
    throw Object.assign(new Error("tenant_has_no_organization"), { statusCode: 500 });
  }
  return org.partyId;
}

/**
 * Find or create a CONTACT party representing an external tenant in the host tenant.
 * This is needed because MessageThread is tenant-scoped - the "guest" tenant
 * needs a Party record in the host tenant to participate in the conversation.
 */
async function getOrCreateCrossTenantParty(
  hostTenantId: number,
  guestTenantId: number
): Promise<number> {
  // Check if we already have a contact for this guest tenant
  // We use a convention: contacts created for cross-tenant messaging have
  // a special note in their name or a lookup by the guest tenant's org info
  const guestOrg = await prisma.organization.findFirst({
    where: { tenantId: guestTenantId },
    select: { name: true, party: { select: { email: true } } },
  });

  if (!guestOrg) {
    throw Object.assign(new Error("guest_tenant_has_no_organization"), { statusCode: 500 });
  }

  // Look for an existing contact in the host tenant that matches the guest org email
  if (guestOrg.party.email) {
    const existing = await prisma.party.findFirst({
      where: {
        tenantId: hostTenantId,
        email: guestOrg.party.email,
        type: "CONTACT",
      },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  // Create a new contact party in the host tenant for the guest
  const party = await prisma.party.create({
    data: {
      tenantId: hostTenantId,
      type: "CONTACT",
      name: guestOrg.name,
      email: guestOrg.party.email,
    },
  });

  return party.id;
}

/**
 * Get or create a conversation for an AnimalAccess record.
 * The thread lives in the owner's tenant. The accessor gets a contact party
 * in the owner's tenant for participation.
 */
export async function getOrCreateConversation(
  animalAccessId: number,
  callerTenantId: number
): Promise<{
  conversationId: number;
  messageThreadId: number;
  isNew: boolean;
}> {
  // Verify the caller is either the owner or accessor
  const access = await prisma.animalAccess.findUnique({
    where: { id: animalAccessId },
    select: {
      id: true,
      ownerTenantId: true,
      accessorTenantId: true,
      animalId: true,
      animalNameSnapshot: true,
      status: true,
      animal: { select: { name: true } },
    },
  });

  if (!access) {
    throw Object.assign(new Error("access_not_found"), { statusCode: 404 });
  }

  const isOwner = callerTenantId === access.ownerTenantId;
  const isAccessor = callerTenantId === access.accessorTenantId;

  if (!isOwner && !isAccessor) {
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }

  // Check if conversation already exists
  const existing = await prisma.animalAccessConversation.findUnique({
    where: { animalAccessId },
    select: { id: true, messageThreadId: true },
  });

  if (existing) {
    return {
      conversationId: existing.id,
      messageThreadId: existing.messageThreadId,
      isNew: false,
    };
  }

  // Create new conversation with thread
  // Thread lives in the owner's tenant
  const hostTenantId = access.ownerTenantId;
  const guestTenantId = access.accessorTenantId;

  // Get the org party for the host tenant (owner)
  const ownerPartyId = await getOrgPartyId(hostTenantId);

  // Get or create a contact party for the accessor in the owner's tenant
  const accessorPartyId = await getOrCreateCrossTenantParty(hostTenantId, guestTenantId);

  const animalName = access.animal?.name ?? access.animalNameSnapshot ?? "Shared Animal";
  const now = new Date();

  // Create thread + conversation in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const thread = await tx.messageThread.create({
      data: {
        tenantId: hostTenantId,
        subject: `Re: ${animalName}`,
        contextType: "ANIMAL_ACCESS",
        lastMessageAt: now,
        participants: {
          create: [
            { partyId: ownerPartyId, lastReadAt: now },
            { partyId: accessorPartyId, lastReadAt: now },
          ],
        },
      },
    });

    const conversation = await tx.animalAccessConversation.create({
      data: {
        animalAccessId,
        messageThreadId: thread.id,
      },
    });

    return { conversation, thread };
  });

  return {
    conversationId: result.conversation.id,
    messageThreadId: result.thread.id,
    isNew: true,
  };
}

/**
 * Get conversation details with messages for an AnimalAccess.
 */
export async function getConversation(
  animalAccessId: number,
  callerTenantId: number,
  options?: { page?: number; limit?: number }
): Promise<{
  conversationId: number;
  messageThreadId: number;
  animalName: string;
  otherParty: { id: number; name: string; avatar?: string | null };
  messages: Array<{
    id: number;
    body: string;
    senderPartyId: number | null;
    senderName: string | null;
    isMe: boolean;
    createdAt: Date;
    attachmentFilename?: string | null;
    attachmentKey?: string | null;
  }>;
  hasMore: boolean;
} | null> {
  // Verify access
  const access = await prisma.animalAccess.findUnique({
    where: { id: animalAccessId },
    select: {
      id: true,
      ownerTenantId: true,
      accessorTenantId: true,
      animalNameSnapshot: true,
      animal: { select: { name: true } },
      conversation: {
        select: {
          id: true,
          messageThreadId: true,
        },
      },
    },
  });

  if (!access) {
    throw Object.assign(new Error("access_not_found"), { statusCode: 404 });
  }

  const isOwner = callerTenantId === access.ownerTenantId;
  const isAccessor = callerTenantId === access.accessorTenantId;

  if (!isOwner && !isAccessor) {
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }

  if (!access.conversation) {
    return null; // No conversation yet
  }

  const limit = Math.min(options?.limit ?? 50, 100);
  const page = options?.page ?? 1;
  const skip = (page - 1) * limit;

  const hostTenantId = access.ownerTenantId;

  // Determine which party is "me" vs "other"
  let myPartyId: number;
  let otherPartyId: number;

  const ownerOrgPartyId = await getOrgPartyId(hostTenantId);

  if (isOwner) {
    myPartyId = ownerOrgPartyId;
    // The accessor is the other party - find their contact in my tenant
    otherPartyId = await getOrCreateCrossTenantParty(hostTenantId, access.accessorTenantId);
  } else {
    // I'm the accessor - my party is the contact in the owner's tenant
    myPartyId = await getOrCreateCrossTenantParty(hostTenantId, access.accessorTenantId);
    otherPartyId = ownerOrgPartyId;
  }

  // Fetch the other party's info
  const otherPartyInfo = await prisma.party.findUnique({
    where: { id: otherPartyId },
    select: { id: true, name: true },
  });

  // Fetch messages
  const [messages, totalMessages] = await Promise.all([
    prisma.message.findMany({
      where: { threadId: access.conversation.messageThreadId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
      select: {
        id: true,
        body: true,
        senderPartyId: true,
        senderParty: { select: { name: true } },
        createdAt: true,
        attachmentFilename: true,
        attachmentKey: true,
      },
    }),
    prisma.message.count({
      where: { threadId: access.conversation.messageThreadId },
    }),
  ]);

  // Mark as read for the caller
  await prisma.messageParticipant.updateMany({
    where: {
      threadId: access.conversation.messageThreadId,
      partyId: myPartyId,
    },
    data: { lastReadAt: new Date() },
  });

  const animalName = access.animal?.name ?? access.animalNameSnapshot ?? "Shared Animal";

  return {
    conversationId: access.conversation.id,
    messageThreadId: access.conversation.messageThreadId,
    animalName,
    otherParty: {
      id: otherPartyInfo?.id ?? otherPartyId,
      name: otherPartyInfo?.name ?? "Unknown",
    },
    messages: messages.reverse().map((m) => ({
      id: m.id,
      body: m.body,
      senderPartyId: m.senderPartyId,
      senderName: m.senderParty?.name ?? null,
      isMe: m.senderPartyId === myPartyId,
      createdAt: m.createdAt,
      attachmentFilename: m.attachmentFilename,
      attachmentKey: m.attachmentKey,
    })),
    hasMore: totalMessages > skip + limit,
  };
}

/**
 * Send a message in an AnimalAccess conversation.
 * Creates the conversation if it doesn't exist yet.
 */
export async function sendMessage(
  animalAccessId: number,
  callerTenantId: number,
  body: string
): Promise<{
  messageId: number;
  conversationId: number;
  messageThreadId: number;
}> {
  if (!body || !body.trim()) {
    throw Object.assign(new Error("message_body_required"), { statusCode: 400 });
  }

  // Ensure conversation exists
  const { conversationId, messageThreadId } = await getOrCreateConversation(
    animalAccessId,
    callerTenantId
  );

  // Verify access and determine caller's party
  const access = await prisma.animalAccess.findUnique({
    where: { id: animalAccessId },
    select: { ownerTenantId: true, accessorTenantId: true },
  });

  if (!access) {
    throw Object.assign(new Error("access_not_found"), { statusCode: 404 });
  }

  const isOwner = callerTenantId === access.ownerTenantId;
  const hostTenantId = access.ownerTenantId;

  let senderPartyId: number;
  if (isOwner) {
    senderPartyId = await getOrgPartyId(hostTenantId);
  } else {
    senderPartyId = await getOrCreateCrossTenantParty(hostTenantId, access.accessorTenantId);
  }

  const now = new Date();

  // Create message and update thread
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        threadId: messageThreadId,
        senderPartyId,
        body: body.trim(),
      },
    }),
    prisma.messageThread.update({
      where: { id: messageThreadId },
      data: { lastMessageAt: now, updatedAt: now },
    }),
    // Mark sender's messages as read
    prisma.messageParticipant.updateMany({
      where: { threadId: messageThreadId, partyId: senderPartyId },
      data: { lastReadAt: now },
    }),
  ]);

  return {
    messageId: message.id,
    conversationId,
    messageThreadId,
  };
}
