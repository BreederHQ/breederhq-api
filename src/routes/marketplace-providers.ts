// @ts-nocheck - Marketplace admin features temporarily disabled pending migration
// src/routes/marketplace-providers.ts
/**
 * Marketplace Provider Routes
 *
 * Mounted at: /api/v1/marketplace/providers
 *
 * Endpoints:
 *   POST   /register               - Convert user to provider
 *   GET    /me                     - Get current provider profile
 *   PATCH  /me                     - Update provider profile
 *   GET    /me/dashboard           - Provider dashboard stats
 *   GET    /:id                    - Public provider profile
 *   POST   /stripe-connect/start   - Initiate Stripe Connect onboarding
 *   GET    /stripe-connect/status  - Check Stripe Connect status
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { requireMarketplaceAuth } from "../middleware/marketplace-auth.js";
import { requireProvider, requireProviderWithStripe } from "../middleware/marketplace-provider-auth.js";
import { findMarketplaceUserById } from "../services/marketplace-auth-service.js";
import { sendProviderWelcomeEmail } from "../services/marketplace-email-service.js";
import { geocodeCityState, geocodeZipCode } from "../services/geocoding-service.js";
import prisma from "../prisma.js";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Geocode provider address to get lat/lng coordinates
 * Tries city+state first, falls back to zip code
 */
async function geocodeProviderAddress(city?: string | null, state?: string | null, zip?: string | null, country?: string | null): Promise<{ latitude: Decimal; longitude: Decimal } | null> {
  try {
    // Try city + state first (more accurate)
    if (city && state) {
      const result = await geocodeCityState(city, state, country || "US");
      if (result) {
        return {
          latitude: new Decimal(result.latitude.toFixed(8)),
          longitude: new Decimal(result.longitude.toFixed(8)),
        };
      }
    }

    // Fall back to zip code
    if (zip) {
      const result = await geocodeZipCode(zip, country || "US");
      if (result) {
        return {
          latitude: new Decimal(result.latitude.toFixed(8)),
          longitude: new Decimal(result.longitude.toFixed(8)),
        };
      }
    }

    return null;
  } catch (err) {
    console.error("[Geocode] Error geocoding provider address:", err);
    return null;
  }
}

const MARKETPLACE_URL = process.env.MARKETPLACE_URL || "https://marketplace.breederhq.com";

export default async function marketplaceProvidersRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /* ───────────────────────── Register ───────────────────────── */

  app.post("/register", {
    config: { rateLimit: { max: 3, timeWindow: "15 minutes" } },
    preHandler: requireMarketplaceAuth,
  }, async (req, reply) => {
    const userId = req.marketplaceUserId!;

    const {
      providerType = "",
      businessName = "",
      businessDescription,
      paymentMode = "manual",
      paymentInstructions,
      city,
      state,
      zip,
      country = "US",
      tenantId,
    } = (req.body || {}) as {
      providerType?: string;
      businessName?: string;
      businessDescription?: string;
      paymentMode?: string;
      paymentInstructions?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      tenantId?: number;
    };

    // Validation
    if (!providerType) {
      return reply.code(400).send({ error: "provider_type_required" });
    }

    const validProviderTypes = ["breeder", "trainer", "groomer", "veterinarian", "other"];
    if (!validProviderTypes.includes(providerType)) {
      return reply.code(400).send({
        error: "invalid_provider_type",
        message: `Provider type must be one of: ${validProviderTypes.join(", ")}`,
      });
    }

    if (!businessName || businessName.trim().length === 0) {
      return reply.code(400).send({ error: "business_name_required" });
    }

    const validPaymentModes = ["manual", "stripe"];
    if (!validPaymentModes.includes(paymentMode)) {
      return reply.code(400).send({
        error: "invalid_payment_mode",
        message: `Payment mode must be one of: ${validPaymentModes.join(", ")}`,
      });
    }

    // If manual mode, require payment instructions
    if (paymentMode === "manual" && (!paymentInstructions || paymentInstructions.trim().length === 0)) {
      return reply.code(400).send({
        error: "payment_instructions_required",
        message: "Payment instructions are required when using manual payment mode.",
      });
    }

    // Check if user is already a provider
    const existingProvider = await prisma.marketplaceProvider.findUnique({
      where: { userId },
    });

    if (existingProvider) {
      return reply.code(409).send({
        error: "already_provider",
        message: "User is already registered as a provider.",
        providerId: existingProvider.id,
      });
    }

    // Fetch user to update userType
    const user = await findMarketplaceUserById(userId);
    if (!user) {
      return reply.code(404).send({
        error: "user_not_found",
        message: "User not found.",
      });
    }

    try {
      // Geocode address to get lat/lng (fire-and-forget, don't block registration)
      const coords = await geocodeProviderAddress(city, state, zip, country);

      // Create provider and update user in a transaction
      const provider = await prisma.$transaction(async (tx) => {
        // Update user type to provider
        await tx.marketplaceUser.update({
          where: { id: userId },
          data: { userType: "provider" },
        });

        // Create provider record
        const newProvider = await tx.marketplaceProvider.create({
          data: {
            userId,
            providerType,
            businessName: businessName.trim(),
            businessDescription: businessDescription?.trim() || null,
            paymentMode,
            paymentInstructions: paymentInstructions?.trim() || null,
            city: city?.trim() || null,
            state: state?.trim() || null,
            zip: zip?.trim() || null,
            country: country?.trim() || "US",
            latitude: coords?.latitude || null,
            longitude: coords?.longitude || null,
            tenantId: tenantId || null,
            status: "pending", // Will be "active" after review/approval
          },
          include: { user: true },
        });

        return newProvider;
      });

      // Send provider welcome email (fire-and-forget)
      sendProviderWelcomeEmail({
        email: user.email,
        firstName: user.firstName || "there",
        businessName: provider.businessName,
        paymentMode: provider.paymentMode,
      }).catch((err) => {
        req.log?.error?.({ err, providerId: provider.id }, "Failed to send provider welcome email");
      });

      return reply.code(201).send({
        ok: true,
        provider: {
          id: provider.id,
          userId: provider.userId,
          providerType: provider.providerType,
          businessName: provider.businessName,
          businessDescription: provider.businessDescription,
          paymentMode: provider.paymentMode,
          status: provider.status,
          city: provider.city,
          state: provider.state,
          zip: provider.zip,
          country: provider.country,
          createdAt: provider.createdAt,
        },
        nextSteps: paymentMode === "manual"
          ? "You can now create listings. Buyers will use the payment instructions you provided."
          : "Complete Stripe Connect onboarding to accept automated payments.",
      });
    } catch (err: any) {
      req.log?.error?.({ err, userId }, "Provider registration failed");
      return reply.code(500).send({
        error: "registration_failed",
        message: "Failed to create provider account. Please try again.",
      });
    }
  });

  /* ───────────────────────── Get My Profile ───────────────────────── */

  app.get("/me", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;

    return reply.send({
      id: provider.id,
      userId: provider.userId,
      providerType: provider.providerType,
      businessName: provider.businessName,
      businessDescription: provider.businessDescription,
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
      paymentInstructions: provider.paymentInstructions,
      businessHours: provider.businessHours,
      timeZone: provider.timeZone,
      stripeConnectOnboardingComplete: provider.stripeConnectOnboardingComplete,
      stripeConnectPayoutsEnabled: provider.stripeConnectPayoutsEnabled,
      totalListings: provider.totalListings,
      activeListings: provider.activeListings,
      totalTransactions: provider.totalTransactions,
      completedTransactions: provider.completedTransactions,
      totalRevenueCents: provider.totalRevenueCents.toString(), // BigInt to string
      lifetimePayoutCents: provider.lifetimePayoutCents.toString(),
      averageRating: provider.averageRating.toString(),
      totalReviews: provider.totalReviews,
      verifiedProvider: provider.verifiedProvider,
      premiumProvider: provider.premiumProvider,
      quickResponder: provider.quickResponder,
      status: provider.status,
      activatedAt: provider.activatedAt,
      suspendedAt: provider.suspendedAt,
      suspendedReason: provider.suspendedReason,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    });
  });

  /* ───────────────────────── Update My Profile ───────────────────────── */

  app.patch("/me", {
    config: { rateLimit: { max: 10, timeWindow: "5 minutes" } },
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;

    const {
      businessName,
      businessDescription,
      logoUrl,
      coverImageUrl,
      publicEmail,
      publicPhone,
      website,
      city,
      state,
      zip,
      country,
      paymentMode,
      paymentInstructions,
      businessHours,
      timeZone,
    } = (req.body || {}) as {
      businessName?: string;
      businessDescription?: string;
      logoUrl?: string;
      coverImageUrl?: string;
      publicEmail?: string;
      publicPhone?: string;
      website?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      paymentMode?: string;
      paymentInstructions?: string;
      businessHours?: any;
      timeZone?: string;
    };

    // Build update data object
    const updateData: any = {};

    if (businessName !== undefined) {
      if (!businessName.trim()) {
        return reply.code(400).send({
          error: "business_name_required",
          message: "Business name cannot be empty.",
        });
      }
      updateData.businessName = businessName.trim();
    }

    if (businessDescription !== undefined) {
      updateData.businessDescription = businessDescription?.trim() || null;
    }

    if (logoUrl !== undefined) updateData.logoUrl = logoUrl?.trim() || null;
    if (coverImageUrl !== undefined) updateData.coverImageUrl = coverImageUrl?.trim() || null;
    if (publicEmail !== undefined) updateData.publicEmail = publicEmail?.trim() || null;
    if (publicPhone !== undefined) updateData.publicPhone = publicPhone?.trim() || null;
    if (website !== undefined) updateData.website = website?.trim() || null;
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (state !== undefined) updateData.state = state?.trim() || null;
    if (zip !== undefined) updateData.zip = zip?.trim() || null;
    if (country !== undefined) updateData.country = country?.trim() || null;
    if (businessHours !== undefined) updateData.businessHours = businessHours;
    if (timeZone !== undefined) updateData.timeZone = timeZone?.trim() || null;

    // Payment mode switching validation
    if (paymentMode !== undefined) {
      const validPaymentModes = ["manual", "stripe"];
      if (!validPaymentModes.includes(paymentMode)) {
        return reply.code(400).send({
          error: "invalid_payment_mode",
          message: `Payment mode must be one of: ${validPaymentModes.join(", ")}`,
        });
      }

      // Cannot switch to Stripe without completing onboarding
      if (paymentMode === "stripe") {
        if (!provider.stripeConnectAccountId || !provider.stripeConnectOnboardingComplete) {
          return reply.code(400).send({
            error: "stripe_onboarding_required",
            message: "Cannot switch to Stripe payment mode without completing Stripe Connect onboarding.",
            needsOnboarding: true,
          });
        }
      }

      // If switching to manual, require payment instructions
      if (paymentMode === "manual") {
        const instructions = paymentInstructions || provider.paymentInstructions;
        if (!instructions || instructions.trim().length === 0) {
          return reply.code(400).send({
            error: "payment_instructions_required",
            message: "Payment instructions are required when using manual payment mode.",
          });
        }
        updateData.paymentInstructions = instructions.trim();
      }

      updateData.paymentMode = paymentMode;
    }

    // Update payment instructions if provided (for manual mode)
    if (paymentInstructions !== undefined) {
      if (provider.paymentMode === "manual" || updateData.paymentMode === "manual") {
        if (!paymentInstructions.trim()) {
          return reply.code(400).send({
            error: "payment_instructions_required",
            message: "Payment instructions cannot be empty in manual payment mode.",
          });
        }
        updateData.paymentInstructions = paymentInstructions.trim();
      }
    }

    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      return reply.code(400).send({
        error: "no_fields_to_update",
        message: "No valid fields provided for update.",
      });
    }

    // Re-geocode if address fields changed
    const addressChanged = city !== undefined || state !== undefined || zip !== undefined || country !== undefined;
    if (addressChanged) {
      const newCity = updateData.city !== undefined ? updateData.city : provider.city;
      const newState = updateData.state !== undefined ? updateData.state : provider.state;
      const newZip = updateData.zip !== undefined ? updateData.zip : provider.zip;
      const newCountry = updateData.country !== undefined ? updateData.country : provider.country;

      const coords = await geocodeProviderAddress(newCity, newState, newZip, newCountry);
      if (coords) {
        updateData.latitude = coords.latitude;
        updateData.longitude = coords.longitude;
      }
    }

    try {
      const updatedProvider = await prisma.marketplaceProvider.update({
        where: { id: provider.id },
        data: updateData,
        include: { user: true },
      });

      return reply.send({
        ok: true,
        provider: {
          id: updatedProvider.id,
          businessName: updatedProvider.businessName,
          businessDescription: updatedProvider.businessDescription,
          logoUrl: updatedProvider.logoUrl,
          coverImageUrl: updatedProvider.coverImageUrl,
          publicEmail: updatedProvider.publicEmail,
          publicPhone: updatedProvider.publicPhone,
          website: updatedProvider.website,
          city: updatedProvider.city,
          state: updatedProvider.state,
          zip: updatedProvider.zip,
          country: updatedProvider.country,
          paymentMode: updatedProvider.paymentMode,
          paymentInstructions: updatedProvider.paymentInstructions,
          businessHours: updatedProvider.businessHours,
          timeZone: updatedProvider.timeZone,
          updatedAt: updatedProvider.updatedAt,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Provider profile update failed");
      return reply.code(500).send({
        error: "update_failed",
        message: "Failed to update provider profile. Please try again.",
      });
    }
  });

  /* ───────────────────────── Provider Dashboard ───────────────────────── */

  app.get("/me/dashboard", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;

    try {
      // Fetch recent transactions (may be empty for new providers)
      const recentTransactions = await prisma.marketplaceTransaction.findMany({
        where: {
          providerId: provider.id,
        },
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
            select: {
              id: true,
              title: true,
            },
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
        paymentMode: provider.paymentMode,
        stripeConnectOnboardingComplete: provider.stripeConnectOnboardingComplete,
        stripeConnectPayoutsEnabled: provider.stripeConnectPayoutsEnabled,
      });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Dashboard query failed");
      return reply.code(500).send({
        error: "dashboard_error",
        message: "Failed to load dashboard data. Please try again.",
      });
    }
  });

  /* ───────────────────────── Public Provider Profile ───────────────────────── */

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const providerId = parseInt(id, 10);

    if (isNaN(providerId)) {
      return reply.code(400).send({
        error: "invalid_provider_id",
        message: "Provider ID must be a number.",
      });
    }

    try {
      // Find provider - only show active or pending (for testing)
      const provider = await prisma.marketplaceProvider.findFirst({
        where: {
          id: providerId,
          status: { in: ["active", "pending"] }, // Include pending for testing
          deletedAt: null,
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          listings: {
            where: {
              status: "LIVE",
              deletedAt: null,
            },
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
              id: true,
              title: true,
              description: true,
              slug: true,
              priceCents: true,
              priceType: true,
              priceText: true,
              images: true,
              coverImageUrl: true,
            },
          },
          reviews: {
            where: {
              status: "published",
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              rating: true,
              reviewText: true,
              providerResponse: true,
              createdAt: true,
              client: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      if (!provider) {
        return reply.code(404).send({
          error: "provider_not_found",
          message: "Provider not found or not available.",
        });
      }

      // Public profile (exclude sensitive data)
      return reply.send({
      id: provider.id,
      providerType: provider.providerType,
      businessName: provider.businessName,
      businessDescription: provider.businessDescription,
      logoUrl: provider.logoUrl,
      coverImageUrl: provider.coverImageUrl,
      publicEmail: provider.publicEmail,
      publicPhone: provider.publicPhone,
      website: provider.website,
      city: provider.city,
      state: provider.state,
      country: provider.country,
      businessHours: provider.businessHours,
      timeZone: provider.timeZone,
      averageRating: provider.averageRating.toString(),
      totalReviews: provider.totalReviews,
      verifiedProvider: provider.verifiedProvider,
      premiumProvider: provider.premiumProvider,
      quickResponder: provider.quickResponder,
      totalListings: provider.totalListings,
      activeListings: provider.activeListings,
      createdAt: provider.createdAt,
      listings: provider.listings.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        slug: l.slug,
        priceCents: l.priceCents ? l.priceCents.toString() : null,
        priceType: l.priceType,
        priceText: l.priceText,
        images: l.images,
        coverImageUrl: l.coverImageUrl,
      })),
      reviews: provider.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        reviewText: r.reviewText,
        providerResponse: r.providerResponse,
        createdAt: r.createdAt,
        clientName: r.client ? `${r.client.firstName} ${r.client.lastName?.charAt(0) || ""}.` : "Anonymous",
      })),
    });
    } catch (err: any) {
      req.log?.error?.({ err, providerId }, "Public profile query failed");
      return reply.code(500).send({
        error: "profile_error",
        message: "Failed to load provider profile. Please try again.",
      });
    }
  });

  /* ───────────────────────── Provider Transactions ───────────────────────── */

  app.get("/transactions", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { status, page = "1", limit = "20" } = req.query as {
      status?: string;
      page?: string;
      limit?: string;
    };

    try {
      const where: any = {
        providerId: provider.id,
      };

      if (status) {
        where.status = status;
      }

      const [transactions, total] = await Promise.all([
        prisma.marketplaceTransaction.findMany({
          where,
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
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
          take: parseInt(limit, 10),
        }),
        prisma.marketplaceTransaction.count({ where }),
      ]);

      return reply.send({
        transactions: transactions.map((t) => ({
          id: t.id,
          clientId: t.clientId,
          providerId: t.providerId,
          listingId: t.listingId,
          serviceDescription: t.serviceDescription,
          notes: t.serviceNotes,
          servicePriceCents: t.servicePriceCents,
          platformFeeCents: t.platformFeeCents,
          totalCents: t.totalCents,
          providerPayoutCents: t.providerPayoutCents,
          invoiceId: t.invoiceId,
          status: t.status,
          createdAt: t.createdAt,
          paidAt: t.paidAt,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          cancelledAt: t.cancelledAt,
          listing: t.listing,
          client: t.client,
        })),
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Provider transactions query failed");
      return reply.code(500).send({
        error: "query_failed",
        message: "Failed to load transactions.",
      });
    }
  });

  /* ───────────────────────── Provider Messaging ───────────────────────── */

  /**
   * GET /messages/threads - List all message threads for the provider
   */
  app.get("/messages/threads", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { status, type, page = "1", limit = "20" } = req.query as {
      status?: string;
      type?: "inquiry" | "transaction";
      page?: string;
      limit?: string;
    };

    try {
      const where: any = {
        providerId: provider.id,
      };

      if (status) {
        where.status = status;
      }

      if (type === "inquiry") {
        where.transactionId = null;
      } else if (type === "transaction") {
        where.transactionId = { not: null };
      }

      const [threads, total] = await Promise.all([
        prisma.marketplaceMessageThread.findMany({
          where,
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
              select: {
                id: true,
                title: true,
              },
            },
            transaction: {
              select: {
                id: true,
                status: true,
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
          orderBy: { lastMessageAt: "desc" },
          skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
          take: parseInt(limit, 10),
        }),
        prisma.marketplaceMessageThread.count({ where }),
      ]);

      // Calculate unread count per thread
      const threadsWithUnread = await Promise.all(
        threads.map(async (thread) => {
          const unreadCount = await prisma.marketplaceMessage.count({
            where: {
              threadId: thread.id,
              senderType: "client",
              readAt: null,
            },
          });
          return {
            id: thread.id,
            clientId: thread.clientId,
            providerId: thread.providerId,
            listingId: thread.listingId,
            transactionId: thread.transactionId,
            subject: thread.subject,
            status: thread.status,
            lastMessageAt: thread.lastMessageAt,
            unreadCount,
            threadType: thread.transactionId ? "transaction" : "inquiry",
            lastMessage: thread.messages[0] || null,
            client: thread.client,
            listing: thread.listing,
            transaction: thread.transaction,
          };
        })
      );

      return reply.send({
        threads: threadsWithUnread,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Provider threads query failed");
      return reply.code(500).send({
        error: "query_failed",
        message: "Failed to load message threads.",
      });
    }
  });

  /**
   * GET /messages/threads/:id - Get thread with all messages
   */
  app.get("/messages/threads/:id", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { id } = req.params as { id: string };
    const threadId = parseInt(id, 10);

    if (isNaN(threadId)) {
      return reply.code(400).send({ error: "Invalid thread ID" });
    }

    try {
      const thread = await prisma.marketplaceMessageThread.findFirst({
        where: { id: threadId, providerId: provider.id },
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
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
          transaction: {
            select: {
              id: true,
              status: true,
              servicePriceCents: true,
            },
          },
        },
      });

      if (!thread) {
        return reply.code(404).send({ error: "Thread not found" });
      }

      const messages = await prisma.marketplaceMessage.findMany({
        where: { threadId },
        orderBy: { createdAt: "asc" },
      });

      return reply.send({
        thread: {
          id: thread.id,
          clientId: thread.clientId,
          providerId: thread.providerId,
          listingId: thread.listingId,
          transactionId: thread.transactionId,
          subject: thread.subject,
          status: thread.status,
          lastMessageAt: thread.lastMessageAt,
          threadType: thread.transactionId ? "transaction" : "inquiry",
          client: thread.client,
          listing: thread.listing,
          transaction: thread.transaction,
        },
        messages: messages.map((m) => ({
          id: m.id,
          threadId: m.threadId,
          senderId: m.senderId,
          senderType: m.senderType,
          messageText: m.messageText,
          createdAt: m.createdAt,
          readAt: m.readAt,
        })),
      });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id, threadId }, "Thread detail query failed");
      return reply.code(500).send({
        error: "query_failed",
        message: "Failed to load thread.",
      });
    }
  });

  /**
   * POST /messages/threads/:id/messages - Send message as provider
   */
  app.post("/messages/threads/:id/messages", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { id } = req.params as { id: string };
    const threadId = parseInt(id, 10);
    const { messageText } = (req.body || {}) as { messageText?: string };

    if (isNaN(threadId)) {
      return reply.code(400).send({ error: "Invalid thread ID" });
    }

    if (!messageText?.trim()) {
      return reply.code(400).send({ error: "Message text is required" });
    }

    try {
      // Verify thread belongs to provider
      const thread = await prisma.marketplaceMessageThread.findFirst({
        where: { id: threadId, providerId: provider.id },
      });

      if (!thread) {
        return reply.code(404).send({ error: "Thread not found" });
      }

      const message = await prisma.marketplaceMessage.create({
        data: {
          threadId,
          senderId: provider.id,
          senderType: "provider",
          messageText: messageText.trim(),
        },
      });

      // Update thread lastMessageAt
      await prisma.marketplaceMessageThread.update({
        where: { id: threadId },
        data: { lastMessageAt: new Date() },
      });

      // TODO: Send email notification to client

      return reply.send({
        message: {
          id: message.id,
          threadId: message.threadId,
          senderId: message.senderId,
          senderType: message.senderType,
          messageText: message.messageText,
          createdAt: message.createdAt,
          readAt: message.readAt,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id, threadId }, "Send message failed");
      return reply.code(500).send({
        error: "send_failed",
        message: "Failed to send message.",
      });
    }
  });

  /**
   * POST /messages/threads/:id/mark-read - Mark all client messages as read
   */
  app.post("/messages/threads/:id/mark-read", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { id } = req.params as { id: string };
    const threadId = parseInt(id, 10);

    if (isNaN(threadId)) {
      return reply.code(400).send({ error: "Invalid thread ID" });
    }

    try {
      // Verify thread belongs to provider
      const thread = await prisma.marketplaceMessageThread.findFirst({
        where: { id: threadId, providerId: provider.id },
      });

      if (!thread) {
        return reply.code(404).send({ error: "Thread not found" });
      }

      await prisma.marketplaceMessage.updateMany({
        where: {
          threadId,
          senderType: "client",
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      return reply.send({ success: true });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id, threadId }, "Mark read failed");
      return reply.code(500).send({
        error: "mark_read_failed",
        message: "Failed to mark messages as read.",
      });
    }
  });

  /* ───────────────────────── Stripe Connect ───────────────────────── */

  /**
   * POST /stripe-connect/onboarding - Start Stripe Connect onboarding
   */
  app.post("/stripe-connect/onboarding", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { returnUrl, refreshUrl } = (req.body || {}) as {
      returnUrl?: string;
      refreshUrl?: string;
    };

    if (!returnUrl || !refreshUrl) {
      return reply.code(400).send({
        error: "missing_urls",
        message: "returnUrl and refreshUrl are required",
      });
    }

    try {
      // Dynamic import to avoid issues if Stripe is not configured
      const stripeConnect = await import("../services/stripe-connect-service.js");

      let accountId = provider.stripeConnectAccountId;

      // Create Connect account if not exists
      if (!accountId) {
        accountId = await stripeConnect.createConnectAccount(provider.id);
      }

      // Create account link for onboarding
      const accountLinkUrl = await stripeConnect.createAccountLink(
        accountId,
        returnUrl,
        refreshUrl
      );

      return reply.send({ accountLinkUrl, accountId });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Stripe Connect onboarding failed");
      return reply.code(500).send({
        error: "onboarding_failed",
        message: "Failed to start Stripe Connect onboarding. Please try again.",
      });
    }
  });

  /**
   * GET /stripe-connect/status - Get Stripe Connect account status
   */
  app.get("/stripe-connect/status", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;

    // Not connected
    if (!provider.stripeConnectAccountId) {
      return reply.send({
        connected: false,
        accountId: null,
        payoutsEnabled: false,
        detailsSubmitted: false,
        chargesEnabled: false,
      });
    }

    try {
      const stripeConnect = await import("../services/stripe-connect-service.js");
      const status = await stripeConnect.getAccountStatus(provider.stripeConnectAccountId);

      return reply.send({
        ...status,
        accountId: provider.stripeConnectAccountId,
      });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Stripe Connect status check failed");
      return reply.code(500).send({
        error: "status_check_failed",
        message: "Failed to check Stripe Connect status.",
      });
    }
  });

  /**
   * POST /stripe-connect/dashboard-link - Get link to Stripe Express Dashboard
   */
  app.post("/stripe-connect/dashboard-link", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;

    if (!provider.stripeConnectAccountId) {
      return reply.code(400).send({
        error: "not_connected",
        message: "Stripe Connect is not set up for this account.",
      });
    }

    try {
      const stripeConnect = await import("../services/stripe-connect-service.js");
      const dashboardUrl = await stripeConnect.createDashboardLink(
        provider.stripeConnectAccountId
      );

      return reply.send({ dashboardUrl });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Stripe Connect dashboard link failed");
      return reply.code(500).send({
        error: "dashboard_link_failed",
        message: "Failed to create Stripe dashboard link.",
      });
    }
  });

  /**
   * POST /stripe-connect/refresh - Refresh onboarding link (if incomplete)
   */
  app.post("/stripe-connect/refresh", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { returnUrl, refreshUrl } = (req.body || {}) as {
      returnUrl?: string;
      refreshUrl?: string;
    };

    if (!returnUrl || !refreshUrl) {
      return reply.code(400).send({
        error: "missing_urls",
        message: "returnUrl and refreshUrl are required",
      });
    }

    if (!provider.stripeConnectAccountId) {
      return reply.code(400).send({
        error: "not_connected",
        message: "Stripe Connect is not set up for this account.",
      });
    }

    try {
      const stripeConnect = await import("../services/stripe-connect-service.js");
      const accountLinkUrl = await stripeConnect.createAccountLink(
        provider.stripeConnectAccountId,
        returnUrl,
        refreshUrl
      );

      return reply.send({ accountLinkUrl });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Stripe Connect refresh failed");
      return reply.code(500).send({
        error: "refresh_failed",
        message: "Failed to refresh Stripe Connect onboarding link.",
      });
    }
  });

  /* ───────────────────────── Financials ───────────────────────── */

  /**
   * GET /financials - Get provider's financial summary
   */
  app.get("/financials", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;

    try {
      const financialsService = await import("../services/marketplace-financials-service.js");
      const financials = await financialsService.getProviderFinancials(provider.id);

      return reply.send(financials);
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Financials query failed");
      return reply.code(500).send({
        error: "financials_error",
        message: "Failed to load financial data. Please try again.",
      });
    }
  });
}
