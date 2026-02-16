// src/routes/mobile-provider.ts
// Mobile provider API routes (JWT-authenticated).
// These endpoints are thin wrappers around existing marketplace logic,
// authenticated via Bearer token (not session cookies).
//
// Mounted at: /api/v1/mobile/provider
//
// Endpoints:
//   GET  /dashboard             → Provider dashboard stats
//   GET  /listings              → List provider's service listings
//   GET  /listings/:id          → Get single listing
//   PUT  /listings/:id          → Update listing fields
//   POST /listings/:id/publish  → Publish listing
//   POST /listings/:id/unpublish → Unpublish listing
//   GET  /messages/threads      → Provider message threads
//   GET  /messages/threads/:id  → Thread detail with messages
//   POST /messages/threads/:id/messages → Send message
//   GET  /profile               → Provider profile
//   PATCH /profile              → Update provider profile

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import prisma from "../prisma.js";
import { requireMobileProvider } from "../middleware/mobile-provider-auth.js";

export default async function mobileProviderRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // All routes require authenticated provider
  app.addHook("preHandler", requireMobileProvider);

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  app.get("/dashboard", async (req, reply) => {
    const provider = req.mobileProvider!;

    try {
      const recentTransactions = await prisma.marketplaceTransaction.findMany({
        where: { providerId: provider.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          totalCents: true,
          serviceDescription: true,
          createdAt: true,
          completedAt: true,
          paidAt: true,
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          listing: {
            select: { id: true, title: true },
          },
        },
      });

      return reply.send({
        stats: {
          totalRevenueCents: provider.totalRevenueCents.toString(),
          lifetimePayoutCents: provider.lifetimePayoutCents.toString(),
          activeListings: provider.activeListings,
          totalListings: provider.totalListings,
          totalTransactions: provider.totalTransactions,
          completedTransactions: provider.completedTransactions,
          averageRating: provider.averageRating.toString(),
          totalReviews: provider.totalReviews,
          verifiedProvider: provider.verifiedProvider,
          premiumProvider: provider.premiumProvider,
          quickResponder: provider.quickResponder,
        },
        recentTransactions: recentTransactions.map((t) => ({
          id: t.id.toString(),
          status: t.status,
          totalCents: t.totalCents.toString(),
          serviceDescription: t.serviceDescription,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
          paidAt: t.paidAt,
          client: t.client,
          listing: t.listing,
        })),
        provider: {
          id: provider.id,
          businessName: provider.businessName,
          providerType: provider.providerType,
          status: provider.status,
          paymentMode: provider.paymentMode,
          stripeConnectOnboardingComplete:
            provider.stripeConnectOnboardingComplete,
          stripeConnectPayoutsEnabled: provider.stripeConnectPayoutsEnabled,
        },
      });
    } catch (err: unknown) {
      req.log?.error?.(
        { err, providerId: provider.id },
        "Mobile provider dashboard query failed"
      );
      return reply.code(500).send({ error: "Failed to load dashboard" });
    }
  });

  // ─── Listings ──────────────────────────────────────────────────────────────

  app.get("/listings", async (req, reply) => {
    const provider = req.mobileProvider!;
    const query = req.query as {
      page?: string;
      limit?: string;
      status?: string;
    };

    const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      providerId: provider.id,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    try {
      const [listings, total] = await Promise.all([
        prisma.mktListingBreederService.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            coverImageUrl: true,
            images: true,
            city: true,
            state: true,
            priceCents: true,
            priceType: true,
            status: true,
            viewCount: true,
            inquiryCount: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            assignments: {
              include: { tag: true },
            },
          },
        }),
        prisma.mktListingBreederService.count({ where }),
      ]);

      return reply.send({
        items: listings.map((l) => ({
          id: l.id,
          title: l.title,
          description: l.description,
          category: l.category,
          coverImageUrl: l.coverImageUrl,
          images: l.images,
          city: l.city,
          state: l.state,
          priceCents: l.priceCents,
          priceType: l.priceType,
          status: l.status,
          viewCount: l.viewCount,
          inquiryCount: l.inquiryCount,
          publishedAt: l.publishedAt,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
          tags: l.assignments?.map((a: { tag: { id: number; name: string } }) => ({
            id: a.tag.id,
            name: a.tag.name,
          })) ?? [],
        })),
        total,
        page,
        limit,
        hasMore: skip + listings.length < total,
      });
    } catch (err: unknown) {
      req.log?.error?.(
        { err, providerId: provider.id },
        "Failed to list provider listings"
      );
      return reply.code(500).send({ error: "Failed to load listings" });
    }
  });

  app.get<{ Params: { id: string } }>("/listings/:id", async (req, reply) => {
    const provider = req.mobileProvider!;
    const listingId = parseInt(req.params.id, 10);

    if (isNaN(listingId)) {
      return reply.code(400).send({ error: "Invalid listing ID" });
    }

    const listing = await prisma.mktListingBreederService.findFirst({
      where: { id: listingId, providerId: provider.id, deletedAt: null },
      include: {
        assignments: { include: { tag: true } },
      },
    });

    if (!listing) {
      return reply.code(404).send({ error: "Listing not found" });
    }

    return reply.send({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      coverImageUrl: listing.coverImageUrl,
      images: listing.images,
      city: listing.city,
      state: listing.state,
      zip: listing.zip,
      country: listing.country,
      priceCents: listing.priceCents,
      priceType: listing.priceType,
      status: listing.status,
      viewCount: listing.viewCount,
      inquiryCount: listing.inquiryCount,
      publishedAt: listing.publishedAt,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      tags:
        listing.assignments?.map((a) => ({
          id: a.tag.id,
          name: a.tag.name,
        })) ?? [],
    });
  });

  app.put<{ Params: { id: string } }>("/listings/:id", async (req, reply) => {
    const provider = req.mobileProvider!;
    const listingId = parseInt(req.params.id, 10);

    if (isNaN(listingId)) {
      return reply.code(400).send({ error: "Invalid listing ID" });
    }

    const listing = await prisma.mktListingBreederService.findFirst({
      where: { id: listingId, providerId: provider.id, deletedAt: null },
    });

    if (!listing) {
      return reply.code(404).send({ error: "Listing not found" });
    }

    const body = req.body as Record<string, unknown>;
    const allowedFields = [
      "title",
      "description",
      "city",
      "state",
      "zip",
      "country",
      "priceCents",
      "priceType",
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ error: "No valid fields to update" });
    }

    try {
      const updated = await prisma.mktListingBreederService.update({
        where: { id: listingId },
        data,
      });

      return reply.send({ ok: true, listing: updated });
    } catch (err: unknown) {
      req.log?.error?.({ err, listingId }, "Failed to update listing");
      return reply.code(500).send({ error: "Failed to update listing" });
    }
  });

  app.post<{ Params: { id: string } }>(
    "/listings/:id/publish",
    async (req, reply) => {
      const provider = req.mobileProvider!;
      const listingId = parseInt(req.params.id, 10);

      if (isNaN(listingId)) {
        return reply.code(400).send({ error: "Invalid listing ID" });
      }

      const listing = await prisma.mktListingBreederService.findFirst({
        where: { id: listingId, providerId: provider.id, deletedAt: null },
      });

      if (!listing) {
        return reply.code(404).send({ error: "Listing not found" });
      }

      if (!listing.title || listing.title.trim().length === 0) {
        return reply.code(400).send({ error: "Title required to publish" });
      }

      if (!listing.category) {
        return reply.code(400).send({ error: "Category required to publish" });
      }

      if (listing.status === "LIVE") {
        return reply
          .code(409)
          .send({ error: "Listing is already published" });
      }

      try {
        const updated = await prisma.mktListingBreederService.update({
          where: { id: listingId },
          data: { status: "LIVE", publishedAt: new Date() },
        });

        return reply.send({
          ok: true,
          listing: {
            id: updated.id,
            status: updated.status,
            publishedAt: updated.publishedAt,
          },
        });
      } catch (err: unknown) {
        req.log?.error?.({ err, listingId }, "Failed to publish listing");
        return reply.code(500).send({ error: "Failed to publish listing" });
      }
    }
  );

  app.post<{ Params: { id: string } }>(
    "/listings/:id/unpublish",
    async (req, reply) => {
      const provider = req.mobileProvider!;
      const listingId = parseInt(req.params.id, 10);

      if (isNaN(listingId)) {
        return reply.code(400).send({ error: "Invalid listing ID" });
      }

      const listing = await prisma.mktListingBreederService.findFirst({
        where: { id: listingId, providerId: provider.id, deletedAt: null },
      });

      if (!listing) {
        return reply.code(404).send({ error: "Listing not found" });
      }

      if (listing.status !== "LIVE") {
        return reply.code(409).send({ error: "Listing is not published" });
      }

      try {
        const updated = await prisma.mktListingBreederService.update({
          where: { id: listingId },
          data: { status: "DRAFT" },
        });

        return reply.send({
          ok: true,
          listing: { id: updated.id, status: updated.status },
        });
      } catch (err: unknown) {
        req.log?.error?.({ err, listingId }, "Failed to unpublish listing");
        return reply.code(500).send({ error: "Failed to unpublish listing" });
      }
    }
  );

  // ─── Messages ──────────────────────────────────────────────────────────────

  app.get("/messages/threads", async (req, reply) => {
    const provider = req.mobileProvider!;
    const query = req.query as { page?: string; limit?: string };

    const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || "20", 10)));
    const skip = (page - 1) * limit;

    try {
      const [threads, total] = await Promise.all([
        prisma.marketplaceMessageThread.findMany({
          where: {
            providerId: provider.id,
            deletedByProviderAt: null,
          },
          orderBy: { lastMessageAt: "desc" },
          skip,
          take: limit,
          include: {
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            listing: {
              select: { id: true, title: true },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                messageText: true,
                senderType: true,
                createdAt: true,
                readAt: true,
              },
            },
          },
        }),
        prisma.marketplaceMessageThread.count({
          where: {
            providerId: provider.id,
            deletedByProviderAt: null,
          },
        }),
      ]);

      return reply.send({
        threads: threads.map((t) => ({
          id: t.id,
          subject: t.subject,
          status: t.status,
          lastMessageAt: t.lastMessageAt,
          createdAt: t.createdAt,
          client: t.client,
          listing: t.listing,
          lastMessage: t.messages[0] ?? null,
        })),
        total,
        page,
        limit,
        hasMore: skip + threads.length < total,
      });
    } catch (err: unknown) {
      req.log?.error?.(
        { err, providerId: provider.id },
        "Failed to list message threads"
      );
      return reply.code(500).send({ error: "Failed to load messages" });
    }
  });

  app.get<{ Params: { id: string } }>(
    "/messages/threads/:id",
    async (req, reply) => {
      const provider = req.mobileProvider!;
      const threadId = parseInt(req.params.id, 10);

      if (isNaN(threadId)) {
        return reply.code(400).send({ error: "Invalid thread ID" });
      }

      const thread = await prisma.marketplaceMessageThread.findFirst({
        where: {
          id: threadId,
          providerId: provider.id,
          deletedByProviderAt: null,
        },
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          listing: {
            select: { id: true, title: true },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              messageText: true,
              senderType: true,
              senderId: true,
              readAt: true,
              createdAt: true,
            },
          },
        },
      });

      if (!thread) {
        return reply.code(404).send({ error: "Thread not found" });
      }

      // Mark all unread messages from client as read
      await prisma.marketplaceMessage.updateMany({
        where: {
          threadId,
          senderType: "client",
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      return reply.send({
        id: thread.id,
        subject: thread.subject,
        status: thread.status,
        lastMessageAt: thread.lastMessageAt,
        createdAt: thread.createdAt,
        client: thread.client,
        listing: thread.listing,
        messages: thread.messages.map((m) => ({
          id: m.id.toString(),
          messageText: m.messageText,
          senderType: m.senderType,
          senderId: m.senderId,
          readAt: m.readAt,
          createdAt: m.createdAt,
        })),
      });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/messages/threads/:id/messages",
    async (req, reply) => {
      const provider = req.mobileProvider!;
      const marketplaceUserId = req.mobileMarketplaceUserId!;
      const threadId = parseInt(req.params.id, 10);

      if (isNaN(threadId)) {
        return reply.code(400).send({ error: "Invalid thread ID" });
      }

      const { messageText } = req.body as { messageText?: string };
      if (!messageText?.trim()) {
        return reply.code(400).send({ error: "Message text required" });
      }

      // Verify thread ownership
      const thread = await prisma.marketplaceMessageThread.findFirst({
        where: {
          id: threadId,
          providerId: provider.id,
          deletedByProviderAt: null,
        },
      });

      if (!thread) {
        return reply.code(404).send({ error: "Thread not found" });
      }

      try {
        const [message] = await Promise.all([
          prisma.marketplaceMessage.create({
            data: {
              threadId,
              senderId: marketplaceUserId,
              senderType: "provider",
              messageText: messageText.trim(),
            },
          }),
          prisma.marketplaceMessageThread.update({
            where: { id: threadId },
            data: {
              lastMessageAt: new Date(),
              // Track first provider reply for Quick Responder badge
              ...(!thread.firstProviderReplyAt
                ? {
                    firstProviderReplyAt: new Date(),
                    responseTimeSeconds: thread.firstClientMessageAt
                      ? Math.floor(
                          (Date.now() -
                            thread.firstClientMessageAt.getTime()) /
                            1000
                        )
                      : null,
                  }
                : {}),
            },
          }),
        ]);

        return reply.send({
          ok: true,
          message: {
            id: message.id.toString(),
            messageText: message.messageText,
            senderType: message.senderType,
            createdAt: message.createdAt,
          },
        });
      } catch (err: unknown) {
        req.log?.error?.({ err, threadId }, "Failed to send message");
        return reply.code(500).send({ error: "Failed to send message" });
      }
    }
  );

  // ─── Profile ───────────────────────────────────────────────────────────────

  app.get("/profile", async (req, reply) => {
    const provider = req.mobileProvider!;

    return reply.send({
      id: provider.id,
      businessName: provider.businessName,
      businessDescription: provider.businessDescription,
      providerType: provider.providerType,
      logoUrl: provider.logoUrl,
      coverImageUrl: provider.coverImageUrl,
      publicEmail: provider.publicEmail,
      publicPhone: provider.publicPhone,
      website: provider.website,
      city: provider.city,
      state: provider.state,
      zip: provider.zip,
      country: provider.country,
      paymentMode: provider.paymentMode,
      stripeConnectOnboardingComplete:
        provider.stripeConnectOnboardingComplete,
      stripeConnectPayoutsEnabled: provider.stripeConnectPayoutsEnabled,
      status: provider.status,
      verifiedProvider: provider.verifiedProvider,
      premiumProvider: provider.premiumProvider,
      quickResponder: provider.quickResponder,
      averageRating: provider.averageRating.toString(),
      totalReviews: provider.totalReviews,
    });
  });

  app.patch("/profile", async (req, reply) => {
    const provider = req.mobileProvider!;
    const body = req.body as Record<string, unknown>;

    const allowedFields = [
      "businessName",
      "businessDescription",
      "publicEmail",
      "publicPhone",
      "website",
      "city",
      "state",
      "zip",
      "country",
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ error: "No valid fields to update" });
    }

    try {
      const updated = await prisma.marketplaceProvider.update({
        where: { id: provider.id },
        data,
      });

      return reply.send({
        ok: true,
        profile: {
          id: updated.id,
          businessName: updated.businessName,
          businessDescription: updated.businessDescription,
          publicEmail: updated.publicEmail,
          publicPhone: updated.publicPhone,
          website: updated.website,
          city: updated.city,
          state: updated.state,
          zip: updated.zip,
          country: updated.country,
        },
      });
    } catch (err: unknown) {
      req.log?.error?.(
        { err, providerId: provider.id },
        "Failed to update provider profile"
      );
      return reply.code(500).send({ error: "Failed to update profile" });
    }
  });
}
