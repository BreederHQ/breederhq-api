// src/routes/communications.ts
// Communications Hub API - Unified inbox aggregating DM threads and emails

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

type CommunicationChannel = "all" | "email" | "dm";
type CommunicationStatus = "all" | "unread" | "sent" | "flagged" | "archived" | "draft";
type CommunicationType = "email" | "dm" | "draft";
type SortOption = "newest" | "oldest" | "unread_first";
type BulkAction = "archive" | "unarchive" | "flag" | "unflag" | "markRead" | "markUnread" | "delete";

interface CommunicationItem {
  id: string; // "email:123" or "thread:456" or "draft:789"
  type: CommunicationType;
  partyId: number | null;
  partyName: string | null;
  toEmail?: string | null; // Email address for email items
  subject: string | null;
  preview: string;
  isRead: boolean;
  flagged: boolean;
  archived: boolean;
  channel: "email" | "dm";
  direction?: "inbound" | "outbound";
  createdAt: string;
  updatedAt: string;
}

/**
 * Parse composite ID back to type and numeric ID
 */
function parseCompositeId(compositeId: string): { type: string; id: number } | null {
  const match = compositeId.match(/^(email|thread|draft|partyEmail|unlinkedEmail):(\d+)$/);
  if (!match) return null;
  return { type: match[1], id: Number(match[2]) };
}

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /communications/inbox - Aggregated inbox endpoint
  app.get("/communications/inbox", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const {
      channel = "all",
      status = "all",
      partyId,
      search,
      sort = "newest",
      limit = 50,
      offset = 0,
    } = req.query as {
      channel?: CommunicationChannel;
      status?: CommunicationStatus;
      partyId?: string;
      search?: string;
      sort?: SortOption;
      limit?: number;
      offset?: number;
    };

    const take = Math.min(Number(limit), 100);
    const skip = Number(offset);
    const partyIdFilter = partyId ? Number(partyId) : undefined;

    const items: CommunicationItem[] = [];

    // Get the org party for determining read status on threads
    const tenantOrg = await prisma.organization.findFirst({
      where: { tenantId },
      select: { partyId: true },
    });
    const orgPartyId = tenantOrg?.partyId;

    // === Fetch DM Threads ===
    if ((channel === "all" || channel === "dm") && status !== "draft") {
      const threadWhere: any = { tenantId };

      // Archive filter
      if (status === "archived") {
        threadWhere.archived = true;
      } else if (status !== "all") {
        threadWhere.archived = false;
      }

      // Flagged filter
      if (status === "flagged") {
        threadWhere.flagged = true;
      }

      // Party filter
      if (partyIdFilter) {
        threadWhere.participants = { some: { partyId: partyIdFilter } };
      }

      // Search filter
      if (search) {
        threadWhere.OR = [
          { subject: { contains: search, mode: "insensitive" } },
          { messages: { some: { body: { contains: search, mode: "insensitive" } } } },
          { participants: { some: { party: { name: { contains: search, mode: "insensitive" } } } } },
        ];
      }

      const threads = await prisma.messageThread.findMany({
        where: threadWhere,
        select: {
          id: true,
          subject: true,
          flagged: true,
          archived: true,
          guestEmail: true,
          guestName: true,
          createdAt: true,
          lastMessageAt: true,
          updatedAt: true,
          participants: {
            include: { party: { select: { id: true, name: true, type: true } } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true, senderPartyId: true },
          },
        },
        orderBy: sort === "oldest" ? { lastMessageAt: "asc" } : { lastMessageAt: "desc" },
      });

      // Calculate unread counts and transform to CommunicationItem
      for (const thread of threads) {
        // Find the non-org participant (the contact)
        const contactParticipant = thread.participants.find(
          (p) => p.party.type === "CONTACT"
        );
        // Get org participant for read status
        const orgParticipant = thread.participants.find(
          (p) => p.partyId === orgPartyId
        );

        const lastMessage = thread.messages[0];
        const lastReadAt = orgParticipant?.lastReadAt;
        const isRead =
          !lastMessage ||
          !lastReadAt
            ? false
            : new Date(lastMessage.createdAt) <= new Date(lastReadAt);

        // For unread filter, skip if already read
        if (status === "unread" && isRead) continue;

        // Determine channel: if guestEmail is present, it's an inbound email thread, otherwise it's a DM
        const isEmailThread = !!thread.guestEmail;

        items.push({
          id: `thread:${thread.id}`,
          type: isEmailThread ? "email" : "dm",
          partyId: contactParticipant?.partyId || null,
          partyName: contactParticipant?.party.name || thread.guestName || "Unknown",
          toEmail: isEmailThread ? thread.guestEmail : undefined,
          subject: thread.subject,
          preview: lastMessage?.body?.substring(0, 100) || "",
          isRead,
          flagged: thread.flagged,
          archived: thread.archived,
          channel: isEmailThread ? "email" : "dm",
          direction: isEmailThread ? "inbound" : undefined,
          createdAt: thread.createdAt.toISOString(),
          updatedAt: (thread.lastMessageAt || thread.updatedAt).toISOString(),
        });
      }
    }

    // === Fetch Emails (from EmailSendLog - legacy) ===
    if ((channel === "all" || channel === "email") && status !== "draft" && status !== "sent") {
      const emailWhere: any = { tenantId };

      // Archive filter
      if (status === "archived") {
        emailWhere.archived = true;
      } else if (status !== "all") {
        emailWhere.archived = false;
      }

      // Flagged filter
      if (status === "flagged") {
        emailWhere.flagged = true;
      }

      // Party filter
      if (partyIdFilter) {
        emailWhere.partyId = partyIdFilter;
      }

      // Search filter
      if (search) {
        emailWhere.OR = [
          { subject: { contains: search, mode: "insensitive" } },
          { to: { contains: search, mode: "insensitive" } },
        ];
      }

      const emails = await prisma.emailSendLog.findMany({
        where: emailWhere,
        include: {
          party: { select: { id: true, name: true } },
        },
        orderBy: sort === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" },
      });

      for (const email of emails) {
        // Outbound emails are always considered "read"
        const isRead = true;

        // For unread filter, skip all emails (outbound = always read)
        if (status === "unread") continue;

        items.push({
          id: `email:${email.id}`,
          type: "email",
          partyId: email.partyId,
          partyName: email.party?.name || email.to,
          subject: email.subject,
          preview: `To: ${email.to}`,
          isRead,
          flagged: email.flagged,
          archived: email.archived,
          channel: "email",
          direction: "outbound",
          createdAt: email.createdAt.toISOString(),
          updatedAt: email.createdAt.toISOString(),
        });
      }
    }

    // === Fetch Sent Emails (from PartyEmail - linked) ===
    if ((channel === "all" || channel === "email") && (status === "all" || status === "sent")) {
      const partyEmailWhere: any = { tenantId, status: "sent" };

      // Party filter
      if (partyIdFilter) {
        partyEmailWhere.partyId = partyIdFilter;
      }

      // Search filter
      if (search) {
        partyEmailWhere.OR = [
          { subject: { contains: search, mode: "insensitive" } },
          { toEmail: { contains: search, mode: "insensitive" } },
          { body: { contains: search, mode: "insensitive" } },
        ];
      }

      const partyEmails = await prisma.partyEmail.findMany({
        where: partyEmailWhere,
        include: {
          party: { select: { id: true, name: true } },
        },
        orderBy: sort === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" },
      });

      for (const email of partyEmails) {
        items.push({
          id: `partyEmail:${email.id}`,
          type: "email",
          partyId: email.partyId,
          partyName: email.party?.name || null,
          toEmail: email.toEmail,
          subject: email.subject,
          preview: email.body?.substring(0, 100) || "",
          isRead: email.isRead ?? false,
          flagged: false,
          archived: false,
          channel: "email",
          direction: "outbound",
          createdAt: email.createdAt.toISOString(),
          updatedAt: email.createdAt.toISOString(),
        });
      }
    }

    // === Fetch Sent Emails (from UnlinkedEmail - not linked to party) ===
    if ((channel === "all" || channel === "email") && (status === "all" || status === "sent")) {
      const unlinkedWhere: any = { tenantId, direction: "outbound" };

      // Search filter
      if (search) {
        unlinkedWhere.OR = [
          { subject: { contains: search, mode: "insensitive" } },
          { toAddresses: { hasSome: [search.toLowerCase()] } },
          { bodyPreview: { contains: search, mode: "insensitive" } },
        ];
      }

      const unlinkedEmails = await prisma.unlinkedEmail.findMany({
        where: unlinkedWhere,
        orderBy: sort === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" },
      });

      for (const email of unlinkedEmails) {
        const toDisplay = email.toAddresses.join(", ");
        items.push({
          id: `unlinkedEmail:${email.id}`,
          type: "email",
          partyId: email.linkedPartyId,
          partyName: null, // Unlinked emails don't have a party name
          toEmail: toDisplay,
          subject: email.subject,
          preview: email.bodyPreview || "",
          isRead: email.isRead ?? false,
          flagged: false,
          archived: false,
          channel: "email",
          direction: "outbound",
          createdAt: email.createdAt.toISOString(),
          updatedAt: email.createdAt.toISOString(),
        });
      }
    }

    // === Fetch Drafts ===
    if (status === "draft") {
      const draftWhere: any = { tenantId };

      if (channel === "dm") {
        draftWhere.channel = "dm";
      } else if (channel === "email") {
        draftWhere.channel = "email";
      }

      if (partyIdFilter) {
        draftWhere.partyId = partyIdFilter;
      }

      if (search) {
        draftWhere.OR = [
          { subject: { contains: search, mode: "insensitive" } },
          { bodyText: { contains: search, mode: "insensitive" } },
        ];
      }

      const drafts = await prisma.draft.findMany({
        where: draftWhere,
        include: {
          party: { select: { id: true, name: true } },
        },
        orderBy: sort === "oldest" ? { updatedAt: "asc" } : { updatedAt: "desc" },
      });

      for (const draft of drafts) {
        items.push({
          id: `draft:${draft.id}`,
          type: "draft",
          partyId: draft.partyId,
          partyName: draft.party?.name || (draft.toAddresses[0] ?? null),
          subject: draft.subject,
          preview: draft.bodyText.substring(0, 100),
          isRead: true, // Drafts are always "read"
          flagged: false,
          archived: false,
          channel: draft.channel,
          createdAt: draft.createdAt.toISOString(),
          updatedAt: draft.updatedAt.toISOString(),
        });
      }
    }

    // === Fetch Breeding Inquiries ===
    if (status !== "draft" && status !== "sent") {
      const inquiryWhere: any = { tenantId };

      // Status filter for breeding inquiries
      if (status === "unread") {
        inquiryWhere.status = "NEW";
      } else if (status === "archived") {
        inquiryWhere.status = "CLOSED";
      } else if (status !== "all") {
        inquiryWhere.status = { not: "CLOSED" };
      }

      // Search filter
      if (search) {
        inquiryWhere.OR = [
          { inquirerName: { contains: search, mode: "insensitive" } },
          { inquirerEmail: { contains: search, mode: "insensitive" } },
          { message: { contains: search, mode: "insensitive" } },
        ];
      }

      const breedingInquiries = await prisma.breedingInquiry.findMany({
        where: inquiryWhere,
        include: {
          listing: {
            select: {
              id: true,
              listingNumber: true,
              headline: true,
            },
          },
        },
        orderBy: sort === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" },
      });

      for (const inquiry of breedingInquiries) {
        const isRead = inquiry.status !== "NEW";

        // For unread filter, skip if already read
        if (status === "unread" && isRead) continue;

        items.push({
          id: `breeding_inquiry:${inquiry.id}`,
          type: "dm", // Using 'dm' as the base type, could add 'breeding_inquiry' as new type
          partyId: null, // Breeding inquiries may not be linked to a party yet
          partyName: inquiry.inquirerName,
          toEmail: inquiry.inquirerEmail,
          subject: `Breeding Inquiry: ${inquiry.listing?.headline || "Unknown Listing"}`,
          preview: inquiry.message.substring(0, 100),
          isRead,
          flagged: false,
          archived: inquiry.status === "ARCHIVED",
          channel: "dm",
          direction: "inbound" as any,
          createdAt: inquiry.createdAt.toISOString(),
          updatedAt: inquiry.createdAt.toISOString(),
        });
      }
    }

    // Sort combined results
    if (sort === "newest") {
      items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (sort === "oldest") {
      items.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    } else if (sort === "unread_first") {
      items.sort((a, b) => {
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    }

    // Apply pagination
    const paginatedItems = items.slice(skip, skip + take);

    // Calculate counts
    const unreadCount = items.filter((i) => !i.isRead).length;
    const flaggedCount = items.filter((i) => i.flagged).length;

    return reply.send({
      items: paginatedItems,
      total: items.length,
      unreadCount,
      flaggedCount,
    });
  });

  // POST /communications/bulk - Bulk actions on communications
  app.post("/communications/bulk", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { ids, action } = req.body as { ids: string[]; action: BulkAction };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: "missing_ids" });
    }

    if (!action || !["archive", "unarchive", "flag", "unflag", "markRead", "markUnread", "delete"].includes(action)) {
      return reply.code(400).send({
        error: "invalid_action",
        allowed: ["archive", "unarchive", "flag", "unflag", "markRead", "markUnread", "delete"],
      });
    }

    const now = new Date();
    const results = { success: 0, failed: 0 };

    // Get org party for read/unread operations
    const tenantOrg = await prisma.organization.findFirst({
      where: { tenantId },
      select: { partyId: true },
    });
    const orgPartyId = tenantOrg?.partyId;

    for (const compositeId of ids) {
      const parsed = parseCompositeId(compositeId);
      if (!parsed) {
        results.failed++;
        continue;
      }

      try {
        if (parsed.type === "thread") {
          // Handle MessageThread actions
          const updateData: any = {};

          switch (action) {
            case "archive":
              updateData.archived = true;
              break;
            case "unarchive":
              updateData.archived = false;
              break;
            case "flag":
              updateData.flagged = true;
              updateData.flaggedAt = now;
              break;
            case "unflag":
              updateData.flagged = false;
              updateData.flaggedAt = null;
              break;
            case "markRead":
              // Update the org participant's lastReadAt
              if (orgPartyId) {
                await prisma.messageParticipant.updateMany({
                  where: { threadId: parsed.id, partyId: orgPartyId },
                  data: { lastReadAt: now },
                });
              }
              results.success++;
              continue;
            case "markUnread":
              // Set lastReadAt to a very old date to mark as unread
              if (orgPartyId) {
                await prisma.messageParticipant.updateMany({
                  where: { threadId: parsed.id, partyId: orgPartyId },
                  data: { lastReadAt: new Date(0) },
                });
              }
              results.success++;
              continue;
            case "delete":
              // Soft delete = archive for threads
              updateData.archived = true;
              break;
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.messageThread.updateMany({
              where: { id: parsed.id, tenantId },
              data: updateData,
            });
          }
          results.success++;
        } else if (parsed.type === "email") {
          // Handle EmailSendLog actions
          const updateData: any = {};

          switch (action) {
            case "archive":
              updateData.archived = true;
              updateData.archivedAt = now;
              break;
            case "unarchive":
              updateData.archived = false;
              updateData.archivedAt = null;
              break;
            case "flag":
              updateData.flagged = true;
              updateData.flaggedAt = now;
              break;
            case "unflag":
              updateData.flagged = false;
              updateData.flaggedAt = null;
              break;
            case "markRead":
            case "markUnread":
              // Emails don't have read status in current model
              results.success++;
              continue;
            case "delete":
              updateData.archived = true;
              updateData.archivedAt = now;
              break;
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.emailSendLog.updateMany({
              where: { id: parsed.id, tenantId },
              data: updateData,
            });
          }
          results.success++;
        } else if (parsed.type === "draft") {
          // Handle Draft actions
          if (action === "delete") {
            // Hard delete drafts
            await prisma.draft.deleteMany({
              where: { id: parsed.id, tenantId },
            });
            results.success++;
          } else {
            // Other actions don't apply to drafts
            results.failed++;
          }
        } else if (parsed.type === "breeding_inquiry") {
          // Handle BreedingInquiry actions
          const updateData: any = {};

          switch (action) {
            case "markRead":
              updateData.status = "READ";
              updateData.readAt = now;
              break;
            case "markUnread":
              updateData.status = "NEW";
              updateData.readAt = null;
              break;
            case "archive":
            case "delete":
              updateData.status = "CLOSED";
              break;
            default:
              // Other actions don't apply to breeding inquiries
              results.failed++;
              continue;
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.breedingInquiry.updateMany({
              where: { id: parsed.id, tenantId },
              data: updateData,
            });
          }
          results.success++;
        }
      } catch (err) {
        console.error(`Failed to process ${compositeId}:`, err);
        results.failed++;
      }
    }

    return reply.send({
      ok: true,
      processed: results.success,
      failed: results.failed,
    });
  });

  // GET /communications/counts - Get unread/flagged counts for sidebar badges
  app.get("/communications/counts", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const tenantOrg = await prisma.organization.findFirst({
      where: { tenantId },
      select: { partyId: true },
    });
    const orgPartyId = tenantOrg?.partyId;

    // Count unread threads
    let unreadThreads = 0;
    if (orgPartyId) {
      // Get all threads for the org
      const threads = await prisma.messageThread.findMany({
        where: { tenantId, archived: false },
        select: {
          id: true,
          participants: {
            where: { partyId: orgPartyId },
            select: { lastReadAt: true },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, senderPartyId: true },
          },
        },
      });

      for (const thread of threads) {
        const orgParticipant = thread.participants[0];
        const lastMessage = thread.messages[0];
        if (
          lastMessage &&
          lastMessage.senderPartyId !== orgPartyId &&
          (!orgParticipant?.lastReadAt ||
            new Date(lastMessage.createdAt) > new Date(orgParticipant.lastReadAt))
        ) {
          unreadThreads++;
        }
      }
    }

    // Count flagged items and sent emails
    const [
      flaggedThreads,
      flaggedEmails,
      draftCount,
      sentPartyEmails,
      sentUnlinkedEmails,
      unreadInquiries,
    ] = await Promise.all([
      prisma.messageThread.count({ where: { tenantId, flagged: true, archived: false } }),
      prisma.emailSendLog.count({ where: { tenantId, flagged: true, archived: false } }),
      prisma.draft.count({ where: { tenantId } }),
      prisma.partyEmail.count({ where: { tenantId, status: "sent" } }),
      prisma.unlinkedEmail.count({ where: { tenantId, direction: "outbound" } }),
      prisma.breedingInquiry.count({ where: { tenantId, status: "NEW" } }),
    ]);

    return reply.send({
      unreadCount: unreadThreads + unreadInquiries,
      flaggedCount: flaggedThreads + flaggedEmails,
      draftCount,
      sentCount: sentPartyEmails + sentUnlinkedEmails,
    });
  });

  // GET /communications/email/:compositeId - Get email details by composite ID
  // Supports partyEmail:123 and unlinkedEmail:456 formats
  app.get("/communications/email/:compositeId", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const compositeId = (req.params as any).compositeId as string;
    const parsed = parseCompositeId(compositeId);

    if (!parsed) {
      return reply.code(400).send({ error: "invalid_id_format" });
    }

    try {
      if (parsed.type === "partyEmail") {
        const email = await prisma.partyEmail.findFirst({
          where: { id: parsed.id, tenantId },
          include: {
            party: { select: { id: true, name: true, email: true } },
          },
        });

        if (!email) {
          return reply.code(404).send({ error: "not_found" });
        }

        // Mark as read
        if (!email.isRead) {
          await prisma.partyEmail.update({
            where: { id: email.id },
            data: { isRead: true },
          });
        }

        return reply.send({
          email: {
            id: compositeId,
            type: "partyEmail",
            partyId: email.partyId,
            partyName: email.party?.name || null,
            partyEmail: email.party?.email || null,
            toEmail: email.toEmail,
            subject: email.subject,
            body: email.body,
            status: email.status,
            sentAt: email.sentAt?.toISOString(),
            createdAt: email.createdAt.toISOString(),
            isRead: true, // Now marked as read
          },
        });
      } else if (parsed.type === "unlinkedEmail") {
        const email = await prisma.unlinkedEmail.findFirst({
          where: { id: parsed.id, tenantId },
          include: {
            linkedParty: { select: { id: true, name: true, email: true } },
          },
        });

        if (!email) {
          return reply.code(404).send({ error: "not_found" });
        }

        // Mark as read
        if (!email.isRead) {
          await prisma.unlinkedEmail.update({
            where: { id: email.id },
            data: { isRead: true },
          });
        }

        return reply.send({
          email: {
            id: compositeId,
            type: "unlinkedEmail",
            partyId: email.linkedPartyId,
            partyName: email.linkedParty?.name || null,
            partyEmail: email.linkedParty?.email || null,
            toEmail: email.toAddresses.join(", "),
            fromEmail: email.fromAddress,
            subject: email.subject,
            bodyText: email.bodyText,
            bodyHtml: email.bodyHtml,
            status: email.status,
            direction: email.direction,
            sentAt: email.sentAt?.toISOString(),
            createdAt: email.createdAt.toISOString(),
            isRead: true, // Now marked as read
          },
        });
      } else {
        return reply.code(400).send({ error: "unsupported_email_type" });
      }
    } catch (err) {
      console.error("Failed to get email:", err);
      return reply.code(500).send({ error: "get_email_failed" });
    }
  });

  // GET /communications/breeding-inquiry/:id - Get breeding inquiry details
  app.get("/communications/breeding-inquiry/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const inquiryId = Number((req.params as any).id);

    try {
      const inquiry = await prisma.breedingInquiry.findFirst({
        where: { id: inquiryId, tenantId },
        include: {
          listing: {
            select: {
              id: true,
              listingNumber: true,
              headline: true,
              animalId: true,
              animal: {
                select: {
                  id: true,
                  name: true,
                  species: true,
                  breed: true,
                },
              },
            },
          },
        },
      });

      if (!inquiry) {
        return reply.code(404).send({ error: "inquiry_not_found" });
      }

      // Mark as read if not already
      if (inquiry.status === "NEW") {
        await prisma.breedingInquiry.update({
          where: { id: inquiryId },
          data: {
            status: "READ",
            readAt: new Date(),
          },
        });
      }

      return reply.send({
        inquiry: {
          id: inquiry.id,
          listingId: inquiry.listingId,
          listingNumber: inquiry.listing?.listingNumber,
          listingHeadline: inquiry.listing?.headline,
          animal: inquiry.listing?.animal,
          inquirerName: inquiry.inquirerName,
          inquirerEmail: inquiry.inquirerEmail,
          inquirerPhone: inquiry.inquirerPhone,
          inquirerType: inquiry.inquirerType,
          isBreeder: inquiry.isBreeder,
          message: inquiry.message,
          interestedInMethod: inquiry.interestedInMethod,
          status: inquiry.status,
          readAt: inquiry.readAt?.toISOString(),
          repliedAt: inquiry.repliedAt?.toISOString(),
          convertedToBookingId: inquiry.convertedToBookingId,
          convertedAt: inquiry.convertedAt?.toISOString(),
          referrerUrl: inquiry.referrerUrl,
          utmSource: inquiry.utmSource,
          utmMedium: inquiry.utmMedium,
          utmCampaign: inquiry.utmCampaign,
          createdAt: inquiry.createdAt.toISOString(),
        },
      });
    } catch (err) {
      console.error("Failed to get breeding inquiry:", err);
      return reply.code(500).send({ error: "get_inquiry_failed" });
    }
  });

  // POST /communications/breeding-inquiry/:id/reply - Reply to breeding inquiry
  app.post("/communications/breeding-inquiry/:id/reply", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const inquiryId = Number((req.params as any).id);
    const { body: replyBody } = req.body as { body: string };

    if (!replyBody || !replyBody.trim()) {
      return reply.code(400).send({ error: "reply_body_required" });
    }

    try {
      const inquiry = await prisma.breedingInquiry.findFirst({
        where: { id: inquiryId, tenantId },
        select: { id: true, inquirerEmail: true },
      });

      if (!inquiry) {
        return reply.code(404).send({ error: "inquiry_not_found" });
      }

      // Update inquiry status to REPLIED
      await prisma.breedingInquiry.update({
        where: { id: inquiryId },
        data: {
          status: "REPLIED",
          repliedAt: new Date(),
        },
      });

      // TODO: Send actual email to inquirer
      // For now, just return success
      // In production, integrate with email service (SendGrid, SES, etc.)

      return reply.send({
        ok: true,
        message: "Reply sent successfully",
      });
    } catch (err) {
      console.error("Failed to reply to breeding inquiry:", err);
      return reply.code(500).send({ error: "reply_failed" });
    }
  });

  // POST /communications/breeding-inquiry/:id/convert - Convert inquiry to booking
  app.post("/communications/breeding-inquiry/:id/convert", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const inquiryId = Number((req.params as any).id);

    try {
      const inquiry = await prisma.breedingInquiry.findFirst({
        where: { id: inquiryId, tenantId },
        include: {
          listing: {
            select: {
              id: true,
              animalId: true,
              species: true,
              breed: true,
              feeCents: true,
              breedingMethods: true,
            },
          },
        },
      });

      if (!inquiry) {
        return reply.code(404).send({ error: "inquiry_not_found" });
      }

      if (inquiry.convertedToBookingId) {
        return reply.code(400).send({ error: "already_converted" });
      }

      // Generate booking number
      const bookingCount = await prisma.breedingBooking.count({ where: { offeringTenantId: tenantId } });
      const bookingNumber = `BK-${String(bookingCount + 1).padStart(6, "0")}`;

      // Create a Party record for the external inquirer
      const seekingParty = await prisma.party.create({
        data: {
          tenantId,
          type: "CONTACT",
          name: inquiry.inquirerName,
          email: inquiry.inquirerEmail,
          phoneE164: inquiry.inquirerPhone,
        },
      });

      // Create booking
      const booking = await prisma.breedingBooking.create({
        data: {
          bookingNumber,

          // Lineage
          sourceListingId: inquiry.listingId,
          sourceInquiryId: inquiry.id,

          // Offering side (from listing)
          offeringTenantId: tenantId,
          offeringAnimalId: inquiry.listing!.animalId!,

          // Seeking side (from inquiry - external party)
          seekingPartyId: seekingParty.id,
          seekingTenantId: null,
          seekingAnimalId: null,

          // Details
          species: inquiry.listing!.species,
          bookingType: "STUD_SERVICE",
          preferredMethod: inquiry.interestedInMethod || inquiry.listing!.breedingMethods[0],

          // Financials
          agreedFeeCents: inquiry.listing!.feeCents || 0,
          feeDirection: "I_RECEIVE",

          // Status
          status: "INQUIRY",
          statusChangedAt: new Date(),

          // Requirements
          requirements: {},
          requirementsConfig: inquiry.listing!.species === "HORSE" ? "HORSE_DEFAULT" : null,

          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Mark inquiry as converted
      await prisma.breedingInquiry.update({
        where: { id: inquiryId },
        data: {
          status: "CONVERTED",
          convertedToBookingId: booking.id,
          convertedAt: new Date(),
        },
      });

      return reply.send({
        ok: true,
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
      });
    } catch (err) {
      console.error("Failed to convert inquiry to booking:", err);
      return reply.code(500).send({ error: "conversion_failed" });
    }
  });
};

export default routes;
