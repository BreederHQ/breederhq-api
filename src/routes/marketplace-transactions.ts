// src/routes/marketplace-transactions.ts
/**
 * Marketplace Transaction Routes
 *
 * Handles transaction creation, payment processing, and lifecycle management.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireMarketplaceAuth, requireProvider } from "../middleware/marketplace-auth.js";
import {
  createTransaction,
  findAccessibleTransaction,
  findBuyerTransaction,
  findProviderTransaction,
  markTransactionAsPaid,
  confirmManualPayment,
  createTransactionCheckout,
  startService,
  completeService,
  cancelTransaction,
  refundTransaction,
  type TransactionWithDetails,
} from "../services/marketplace-transaction-service.js";
import {
  sendTransactionCreatedEmailToBuyer,
  sendTransactionCreatedEmailToProvider,
  sendPaymentReceivedEmailToBuyer,
  sendPaymentReceivedEmailToProvider,
  sendServiceStartedEmailToBuyer,
  sendServiceCompletedEmailToBuyer,
  sendCancellationEmail,
} from "../services/marketplace-email-service.js";
import prisma from "../prisma.js";
import { validateLegalAcceptancePayload, writeLegalAcceptance } from "../services/marketplace-legal-service.js";

/**
 * Parse paging parameters from query
 */
function parsePaging(q: any) {
  const page = parseInt(q.page, 10) || 1;
  const limit = Math.min(parseInt(q.limit, 10) || 25, 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Transform transaction to DTO for responses
 * Converts BigInt fields to strings
 */
function toTransactionDTO(transaction: TransactionWithDetails) {
  // Extract service title from description
  const serviceTitle = transaction.serviceDescription.split(':')[0];

  return {
    id: Number(transaction.id),
    clientId: transaction.clientId,
    providerId: transaction.providerId,
    listingId: transaction.listingId,

    // Service details
    serviceTitle,
    serviceDescription: transaction.serviceDescription,
    serviceNotes: transaction.serviceNotes,

    // Pricing (BigInt to string)
    servicePriceCents: transaction.servicePriceCents.toString(),
    platformFeeCents: transaction.platformFeeCents.toString(),
    stripeFeesCents: transaction.stripeFeesCents.toString(),
    totalCents: transaction.totalCents.toString(),

    // Status
    status: transaction.status,
    cancellationReason: transaction.cancellationReason,

    // Timestamps
    createdAt: transaction.createdAt.toISOString(),
    paidAt: transaction.paidAt?.toISOString() || null,
    startedAt: transaction.startedAt?.toISOString() || null,
    completedAt: transaction.completedAt?.toISOString() || null,
    cancelledAt: transaction.cancelledAt?.toISOString() || null,
    refundedAt: transaction.refundedAt?.toISOString() || null,

    // Embedded objects
    client: {
      id: transaction.client.id,
      email: transaction.client.email,
      firstName: transaction.client.firstName,
      lastName: transaction.client.lastName,
    },
    provider: {
      id: transaction.provider.id,
      businessName: transaction.provider.businessName,
      logoUrl: transaction.provider.logoUrl,
      city: transaction.provider.city,
      state: transaction.provider.state,
      paymentMode: transaction.provider.paymentMode,
      paymentInstructions: transaction.provider.paymentMode === "manual"
        ? transaction.provider.paymentInstructions
        : null,
    },
    // Listing relation removed (use listingId instead)
    listing: null,
  };
}

export default async function marketplaceTransactionsRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/marketplace/transactions
   * Create new transaction (book a service)
   */
  app.post(
    "/transactions",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;

      // Parse request body
      const body = req.body as {
        serviceListingId?: number;
        buyerNotes?: string;
        legalAcceptance?: unknown;
      };

      // Validate required fields
      if (!body.serviceListingId) {
        return reply.code(400).send({
          error: "service_listing_id_required",
          message: "serviceListingId is required.",
        });
      }

      // Validate buyerNotes length
      if (body.buyerNotes && body.buyerNotes.length > 1000) {
        return reply.code(400).send({
          error: "buyer_notes_too_long",
          message: "Buyer notes must be 1000 characters or less.",
        });
      }

      try {
        // Fetch listing to verify buyer is not the provider
        const listing = await prisma.mktListingBreederService.findUnique({
          where: { id: body.serviceListingId },
          include: {
            provider: true,
          },
        });

        if (!listing) {
          return reply.code(404).send({
            error: "listing_not_found",
            message: "Service listing not found.",
          });
        }

        // Check if buyer is trying to book their own listing
        if (listing.provider && listing.provider.userId === userId) {
          return reply.code(400).send({
            error: "cannot_book_own_service",
            message: "You cannot book your own service.",
          });
        }

        // Create transaction
        const transaction = await createTransaction({
          clientId: userId,
          serviceListingId: body.serviceListingId,
          buyerNotes: body.buyerNotes,
        });

        // Record legal acceptance (buyer terms + transaction terms)
        if (body.legalAcceptance) {
          try {
            const payload = validateLegalAcceptancePayload(body.legalAcceptance);
            writeLegalAcceptance(payload, req, {
              marketplaceUserId: userId,
              entityType: "transaction",
              entityId: Number(transaction.id),
            }).catch((err) => {
              console.error("Failed to record legal acceptance for transaction:", err);
            });
          } catch (err) {
            // Log validation failure but don't block the transaction
            console.error("Invalid legal acceptance payload for transaction:", err);
          }
        }

        // Send confirmation emails to buyer and provider
        const totalAmount = `$${(Number(transaction.totalCents) / 100).toFixed(2)}`;
        const serviceTitle = transaction.serviceDescription.split(':')[0];

        // Send buyer email (fire and forget)
        sendTransactionCreatedEmailToBuyer({
          buyerEmail: transaction.client.email,
          buyerFirstName: transaction.client.firstName || "",
          transactionId: Number(transaction.id),
          serviceTitle,
          providerBusinessName: transaction.provider.businessName,
          totalAmount,
          paymentMode: transaction.provider.paymentMode as "manual" | "stripe",
          paymentInstructions: transaction.provider.paymentMode === "manual"
            ? transaction.provider.paymentInstructions
            : null,
        }).catch((err) => {
          console.error("Failed to send transaction created email to buyer:", err);
        });

        // Send provider email (fire and forget)
        sendTransactionCreatedEmailToProvider({
          providerEmail: transaction.provider.user.email,
          providerBusinessName: transaction.provider.businessName,
          transactionId: Number(transaction.id),
          serviceTitle,
          buyerName: `${transaction.client.firstName || ""} ${transaction.client.lastName || ""}`.trim() || transaction.client.email,
          buyerNotes: transaction.serviceNotes,
          totalAmount,
        }).catch((err) => {
          console.error("Failed to send transaction created email to provider:", err);
        });

        // Return transaction DTO
        return reply.code(201).send(toTransactionDTO(transaction));
      } catch (error: any) {
        // Handle validation errors from service
        if (error.message === "listing_not_found") {
          return reply.code(404).send({
            error: "listing_not_found",
            message: "Service listing not found.",
          });
        }

        if (error.message === "listing_not_published") {
          return reply.code(400).send({
            error: "listing_unavailable",
            message: "Service listing is not available for booking.",
          });
        }

        if (error.message === "listing_deleted") {
          return reply.code(400).send({
            error: "listing_unavailable",
            message: "Service listing is no longer available.",
          });
        }

        if (error.message === "listing_price_required") {
          return reply.code(400).send({
            error: "listing_unavailable",
            message: "Service listing does not have a price set.",
          });
        }

        if (error.message === "self_booking_not_allowed") {
          return reply.code(400).send({
            error: "cannot_book_own_service",
            message: "You cannot book your own service.",
          });
        }

        // Log unexpected errors
        console.error("Error creating transaction:", error);
        return reply.code(500).send({
          error: "transaction_creation_failed",
          message: "Failed to create transaction. Please try again.",
        });
      }
    }
  );

  /**
   * GET /api/v1/marketplace/transactions
   * List buyer's transactions
   */
  app.get(
    "/transactions",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: {
          max: 100,
          timeWindow: "1 minute",
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;

      // Parse query params
      const query = req.query as {
        status?: string;
        page?: string;
        limit?: string;
        sort?: string;
      };

      const { limit, offset } = parsePaging(query);
      const page = query.page ? parseInt(query.page, 10) : 1;

      // Build where clause
      const where: any = {
        clientId: userId,
      };

      if (query.status) {
        where.status = query.status;
      }

      // Parse sort parameter
      const sortParam = query.sort || "-createdAt";
      const orderBy: any[] = [];

      for (const sortField of sortParam.split(",")) {
        if (sortField.startsWith("-")) {
          const field = sortField.substring(1);
          orderBy.push({ [field]: "desc" });
        } else {
          orderBy.push({ [sortField]: "asc" });
        }
      }

      // Fetch transactions
      const [transactions, total] = await Promise.all([
        prisma.marketplaceTransaction.findMany({
          where,
          include: {
            client: true,
            provider: {
              include: {
                user: true,
              },
            },
          },
          orderBy,
          skip: offset,
          take: limit,
        }),
        prisma.marketplaceTransaction.count({ where }),
      ]);

      // Transform to DTOs
      const items = transactions.map((t) => toTransactionDTO(t as any));

      return reply.send({
        items,
        total,
        page,
        limit,
        hasMore: offset + transactions.length < total,
      });
    }
  );

  /**
   * GET /api/v1/marketplace/transactions/:id
   * Get single transaction detail
   * Accessible by buyer or provider
   */
  app.get(
    "/transactions/:id",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: {
          max: 100,
          timeWindow: "1 minute",
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const params = req.params as { id: string };
      const transactionId = parseInt(params.id, 10);

      if (isNaN(transactionId)) {
        return reply.code(400).send({
          error: "invalid_transaction_id",
          message: "Invalid transaction ID.",
        });
      }

      // Find transaction accessible by user (buyer or provider)
      const transaction = await findAccessibleTransaction(transactionId, userId);

      if (!transaction) {
        return reply.code(404).send({
          error: "transaction_not_found",
          message: "Transaction not found or access denied.",
        });
      }

      return reply.send(toTransactionDTO(transaction));
    }
  );

  /**
   * POST /api/v1/marketplace/transactions/:id/checkout
   * Create Stripe Checkout session (Stripe mode only)
   */
  app.post(
    "/transactions/:id/checkout",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const params = req.params as { id: string };
      const transactionId = parseInt(params.id, 10);

      if (isNaN(transactionId)) {
        return reply.code(400).send({
          error: "invalid_transaction_id",
          message: "Invalid transaction ID.",
        });
      }

      try {
        const checkoutUrl = await createTransactionCheckout(transactionId, userId);

        return reply.send({
          ok: true,
          checkoutUrl,
        });
      } catch (error: any) {
        if (error.message === "transaction_not_found") {
          return reply.code(404).send({
            error: "transaction_not_found",
            message: "Transaction not found or access denied.",
          });
        }

        if (error.message === "transaction_not_pending") {
          return reply.code(400).send({
            error: "transaction_not_pending",
            message: "Transaction is not in pending status.",
          });
        }

        if (error.message === "stripe_payment_only") {
          return reply.code(400).send({
            error: "stripe_payment_only",
            message: "Checkout is only available for Stripe payment mode.",
          });
        }

        if (error.message === "provider_stripe_not_configured") {
          return reply.code(400).send({
            error: "provider_not_configured",
            message: "Provider has not configured Stripe payments yet.",
          });
        }

        console.error("Error creating checkout session:", error);
        return reply.code(500).send({
          error: "checkout_failed",
          message: "Failed to create checkout session. Please try again.",
        });
      }
    }
  );

  /**
   * POST /api/v1/marketplace/transactions/:id/mark-paid
   * Buyer marks manual payment as sent
   */
  app.post(
    "/transactions/:id/mark-paid",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 hour",
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const params = req.params as { id: string };
      const transactionId = parseInt(params.id, 10);

      if (isNaN(transactionId)) {
        return reply.code(400).send({
          error: "invalid_transaction_id",
          message: "Invalid transaction ID.",
        });
      }

      try {
        const transaction = await markTransactionAsPaid(transactionId, userId);

        return reply.send({
          ok: true,
          message: "Payment marked as sent. Waiting for provider confirmation.",
          transaction: toTransactionDTO(transaction),
        });
      } catch (error: any) {
        if (error.message === "transaction_not_found") {
          return reply.code(404).send({
            error: "transaction_not_found",
            message: "Transaction not found or access denied.",
          });
        }

        if (error.message === "transaction_not_pending") {
          return reply.code(400).send({
            error: "transaction_not_pending",
            message: "Transaction is not in pending status.",
          });
        }

        if (error.message === "manual_payment_only") {
          return reply.code(400).send({
            error: "manual_payment_only",
            message: "This action is only available for manual payment mode.",
          });
        }

        console.error("Error marking payment as sent:", error);
        return reply.code(500).send({
          error: "mark_paid_failed",
          message: "Failed to mark payment as sent. Please try again.",
        });
      }
    }
  );

  /**
   * POST /api/v1/marketplace/transactions/:id/confirm-payment
   * Provider confirms manual payment received
   */
  app.post(
    "/transactions/:id/confirm-payment",
    {
      preHandler: requireProvider,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 hour",
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const params = req.params as { id: string };
      const transactionId = parseInt(params.id, 10);

      if (isNaN(transactionId)) {
        return reply.code(400).send({
          error: "invalid_transaction_id",
          message: "Invalid transaction ID.",
        });
      }

      // Load provider for this user
      const provider = await prisma.marketplaceProvider.findUnique({
        where: { userId },
      });

      if (!provider) {
        return reply.code(404).send({
          error: "provider_not_found",
          message: "Provider account not found.",
        });
      }

      try {
        const transaction = await confirmManualPayment(transactionId, provider.id);

        // Send payment confirmation emails (fire and forget)
        const totalAmount = `$${(Number(transaction.totalCents) / 100).toFixed(2)}`;
        const serviceTitle = transaction.serviceDescription.split(':')[0];

        // Send buyer email
        sendPaymentReceivedEmailToBuyer({
          buyerEmail: transaction.client.email,
          buyerFirstName: transaction.client.firstName || "",
          transactionId: Number(transaction.id),
          serviceTitle,
          providerBusinessName: transaction.provider.businessName,
          totalAmount,
        }).catch((err) => {
          console.error("Failed to send payment received email to buyer:", err);
        });

        // Send provider email
        sendPaymentReceivedEmailToProvider({
          providerEmail: transaction.provider.user.email,
          providerBusinessName: transaction.provider.businessName,
          transactionId: Number(transaction.id),
          serviceTitle,
          buyerName: `${transaction.client.firstName || ""} ${transaction.client.lastName || ""}`.trim() || transaction.client.email,
          totalAmount,
          paymentMode: "manual",
        }).catch((err) => {
          console.error("Failed to send payment received email to provider:", err);
        });

        return reply.send({
          ok: true,
          message: "Payment confirmed. Transaction is now paid.",
          transaction: toTransactionDTO(transaction),
        });
      } catch (error: any) {
        if (error.message === "transaction_not_found") {
          return reply.code(404).send({
            error: "transaction_not_found",
            message: "Transaction not found or access denied.",
          });
        }

        if (error.message === "transaction_not_pending") {
          return reply.code(400).send({
            error: "transaction_not_pending",
            message: "Transaction is not in pending status.",
          });
        }

        if (error.message === "manual_payment_only") {
          return reply.code(400).send({
            error: "manual_payment_only",
            message: "This action is only available for manual payment mode.",
          });
        }

        if (error.message === "not_awaiting_confirmation") {
          return reply.code(400).send({
            error: "not_awaiting_confirmation",
            message: "Payment has not been marked as sent by the buyer yet.",
          });
        }

        console.error("Error confirming payment:", error);
        return reply.code(500).send({
          error: "confirm_payment_failed",
          message: "Failed to confirm payment. Please try again.",
        });
      }
    }
  );

  /**
   * POST /api/v1/marketplace/transactions/:id/start
   * Provider marks service as started
   */
  app.post(
    "/transactions/:id/start",
    {
      preHandler: requireProvider,
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 hour",
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const params = req.params as { id: string };
      const transactionId = parseInt(params.id, 10);

      if (isNaN(transactionId)) {
        return reply.code(400).send({
          error: "invalid_transaction_id",
          message: "Invalid transaction ID.",
        });
      }

      const provider = await prisma.marketplaceProvider.findUnique({
        where: { userId },
      });

      if (!provider) {
        return reply.code(404).send({
          error: "provider_not_found",
          message: "Provider account not found.",
        });
      }

      try {
        const transaction = await startService(transactionId, provider.id);

        // Send service started email to buyer
        const serviceTitle = transaction.serviceDescription.split(':')[0];
        sendServiceStartedEmailToBuyer({
          buyerEmail: transaction.client.email,
          buyerFirstName: transaction.client.firstName || "",
          transactionId: Number(transaction.id),
          serviceTitle,
          providerBusinessName: transaction.provider.businessName,
        }).catch((err) => {
          console.error("Failed to send service started email to buyer:", err);
        });

        return reply.send({
          ok: true,
          message: "Service marked as started.",
          transaction: toTransactionDTO(transaction),
        });
      } catch (error: any) {
        if (error.message === "transaction_not_found") {
          return reply.code(404).send({
            error: "transaction_not_found",
            message: "Transaction not found or access denied.",
          });
        }

        if (error.message === "transaction_not_paid") {
          return reply.code(400).send({
            error: "transaction_not_paid",
            message: "Service can only be started for paid transactions.",
          });
        }

        console.error("Error starting service:", error);
        return reply.code(500).send({
          error: "start_service_failed",
          message: "Failed to start service. Please try again.",
        });
      }
    }
  );

  /**
   * POST /api/v1/marketplace/transactions/:id/complete
   * Provider marks service as completed
   */
  app.post(
    "/transactions/:id/complete",
    {
      preHandler: requireProvider,
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 hour",
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const params = req.params as { id: string };
      const transactionId = parseInt(params.id, 10);

      if (isNaN(transactionId)) {
        return reply.code(400).send({
          error: "invalid_transaction_id",
          message: "Invalid transaction ID.",
        });
      }

      const provider = await prisma.marketplaceProvider.findUnique({
        where: { userId },
      });

      if (!provider) {
        return reply.code(404).send({
          error: "provider_not_found",
          message: "Provider account not found.",
        });
      }

      try {
        const transaction = await completeService(transactionId, provider.id);

        // Send service completed email to buyer (with review prompt)
        const serviceTitle = transaction.serviceDescription.split(':')[0];
        sendServiceCompletedEmailToBuyer({
          buyerEmail: transaction.client.email,
          buyerFirstName: transaction.client.firstName || "",
          transactionId: Number(transaction.id),
          serviceTitle,
          providerBusinessName: transaction.provider.businessName,
        }).catch((err) => {
          console.error("Failed to send service completed email to buyer:", err);
        });

        return reply.send({
          ok: true,
          message: "Service marked as completed.",
          transaction: toTransactionDTO(transaction),
        });
      } catch (error: any) {
        if (error.message === "transaction_not_found") {
          return reply.code(404).send({
            error: "transaction_not_found",
            message: "Transaction not found or access denied.",
          });
        }

        if (error.message === "invalid_status_for_completion") {
          return reply.code(400).send({
            error: "invalid_status",
            message: "Service must be paid or started before it can be completed.",
          });
        }

        console.error("Error completing service:", error);
        return reply.code(500).send({
          error: "complete_service_failed",
          message: "Failed to complete service. Please try again.",
        });
      }
    }
  );

  /**
   * POST /api/v1/marketplace/transactions/:id/cancel
   * Cancel transaction (before payment)
   */
  app.post(
    "/transactions/:id/cancel",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const params = req.params as { id: string };
      const body = req.body as { reason?: string };
      const transactionId = parseInt(params.id, 10);

      if (isNaN(transactionId)) {
        return reply.code(400).send({
          error: "invalid_transaction_id",
          message: "Invalid transaction ID.",
        });
      }

      try {
        const transaction = await cancelTransaction(transactionId, userId, body.reason);

        // Send cancellation email to both parties
        const serviceTitle = transaction.serviceDescription.split(':')[0];

        // Email to buyer
        sendCancellationEmail({
          recipientEmail: transaction.client.email,
          recipientName: transaction.client.firstName || "there",
          recipient: "buyer",
          transactionId: Number(transaction.id),
          serviceTitle,
          reason: transaction.cancellationReason,
          refundInitiated: false,
        }).catch((err) => {
          console.error("Failed to send cancellation email to buyer:", err);
        });

        // Email to provider
        sendCancellationEmail({
          recipientEmail: transaction.provider.user.email,
          recipientName: transaction.provider.businessName,
          recipient: "provider",
          transactionId: Number(transaction.id),
          serviceTitle,
          reason: transaction.cancellationReason,
          refundInitiated: false,
        }).catch((err) => {
          console.error("Failed to send cancellation email to provider:", err);
        });

        return reply.send({
          ok: true,
          message: "Transaction cancelled successfully.",
          transaction: toTransactionDTO(transaction),
        });
      } catch (error: any) {
        if (error.message === "transaction_not_found") {
          return reply.code(404).send({
            error: "transaction_not_found",
            message: "Transaction not found or access denied.",
          });
        }

        if (error.message === "cannot_cancel_transaction") {
          return reply.code(400).send({
            error: "cannot_cancel",
            message: "This transaction cannot be cancelled.",
          });
        }

        if (error.message === "paid_transaction_requires_refund") {
          return reply.code(400).send({
            error: "requires_refund",
            message: "Paid transactions must be refunded instead of cancelled.",
          });
        }

        console.error("Error cancelling transaction:", error);
        return reply.code(500).send({
          error: "cancel_failed",
          message: "Failed to cancel transaction. Please try again.",
        });
      }
    }
  );

  /**
   * POST /api/v1/marketplace/transactions/:id/refund
   * Refund transaction (provider-initiated)
   */
  app.post(
    "/transactions/:id/refund",
    {
      preHandler: requireProvider,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.marketplaceUserId!;
      const params = req.params as { id: string };
      const body = req.body as { reason?: string; amountCents?: number };
      const transactionId = parseInt(params.id, 10);

      if (isNaN(transactionId)) {
        return reply.code(400).send({
          error: "invalid_transaction_id",
          message: "Invalid transaction ID.",
        });
      }

      // Validate amountCents if provided
      if (body.amountCents !== undefined) {
        if (typeof body.amountCents !== "number" || body.amountCents <= 0) {
          return reply.code(400).send({
            error: "invalid_refund_amount",
            message: "Refund amount must be a positive number.",
          });
        }
      }

      const provider = await prisma.marketplaceProvider.findUnique({
        where: { userId },
      });

      if (!provider) {
        return reply.code(404).send({
          error: "provider_not_found",
          message: "Provider account not found.",
        });
      }

      try {
        const transaction = await refundTransaction(
          transactionId,
          provider.id,
          body.reason,
          body.amountCents
        );

        // Send refund email to both parties
        const serviceTitle = transaction.serviceDescription.split(':')[0];

        // Email to buyer
        sendCancellationEmail({
          recipientEmail: transaction.client.email,
          recipientName: transaction.client.firstName || "there",
          recipient: "buyer",
          transactionId: Number(transaction.id),
          serviceTitle,
          reason: transaction.cancellationReason,
          refundInitiated: true,
        }).catch((err) => {
          console.error("Failed to send refund email to buyer:", err);
        });

        // Email to provider
        sendCancellationEmail({
          recipientEmail: transaction.provider.user.email,
          recipientName: transaction.provider.businessName,
          recipient: "provider",
          transactionId: Number(transaction.id),
          serviceTitle,
          reason: transaction.cancellationReason,
          refundInitiated: true,
        }).catch((err) => {
          console.error("Failed to send refund email to provider:", err);
        });

        const isPartialRefund = Number(transaction.refundAmountCents) < Number(transaction.totalCents);
        return reply.send({
          ok: true,
          message: isPartialRefund
            ? "Partial refund processed successfully."
            : "Full refund processed successfully.",
          transaction: toTransactionDTO(transaction),
          refund: {
            amount: String(transaction.refundAmountCents),
            total: String(transaction.totalCents),
            isPartial: isPartialRefund,
          },
        });
      } catch (error: any) {
        if (error.message === "transaction_not_found") {
          return reply.code(404).send({
            error: "transaction_not_found",
            message: "Transaction not found or access denied.",
          });
        }

        if (error.message === "only_paid_transactions_can_be_refunded") {
          return reply.code(400).send({
            error: "invalid_status",
            message: "Only paid or started transactions can be refunded.",
          });
        }

        if (error.message === "refund_amount_must_be_positive") {
          return reply.code(400).send({
            error: "refund_amount_must_be_positive",
            message: "Refund amount must be greater than zero.",
          });
        }

        if (error.message === "refund_amount_exceeds_total_paid") {
          return reply.code(400).send({
            error: "refund_amount_exceeds_total_paid",
            message: "Refund amount cannot exceed the total paid amount.",
          });
        }

        console.error("Error processing refund:", error);
        return reply.code(500).send({
          error: "refund_failed",
          message: "Failed to process refund. Please try again.",
        });
      }
    }
  );

  /* ───────────────────────── Service Inquiries ───────────────────────── */

  /**
   * POST /api/v1/marketplace/service-inquiries
   * Create a new inquiry thread for a service provider (pre-booking question)
   */
  app.post(
    "/service-inquiries",
    {
      preHandler: requireMarketplaceAuth,
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 hour",
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const clientId = req.marketplaceUserId!;
      const body = req.body as {
        listingId?: number;
        providerId?: number;
        subject?: string;
        message: string;
      };

      if (!body.message?.trim()) {
        return reply.code(400).send({
          error: "message_required",
          message: "Message text is required.",
        });
      }

      if (body.message.length > 2000) {
        return reply.code(400).send({
          error: "message_too_long",
          message: "Message must be 2000 characters or less.",
        });
      }

      try {
        let listing = null;
        let targetProviderId = body.providerId;

        // If listingId provided, get provider from listing
        if (body.listingId) {
          listing = await prisma.mktListingBreederService.findUnique({
            where: { id: body.listingId },
            select: { id: true, title: true, providerId: true },
          });

          if (!listing) {
            return reply.code(404).send({
              error: "listing_not_found",
              message: "Service listing not found.",
            });
          }

          targetProviderId = listing.providerId ?? undefined;
        }

        if (!targetProviderId) {
          return reply.code(400).send({
            error: "provider_required",
            message: "Either listingId or providerId is required.",
          });
        }

        // Prevent self-messaging: check if provider belongs to the same user
        const targetProvider = await prisma.marketplaceProvider.findUnique({
          where: { id: targetProviderId },
          select: { userId: true },
        });

        if (!targetProvider) {
          return reply.code(404).send({
            error: "provider_not_found",
            message: "Service provider not found.",
          });
        }

        if (targetProvider.userId === clientId) {
          return reply.code(400).send({
            error: "self_message_not_allowed",
            message: "You cannot send an inquiry to your own service listing.",
          });
        }

        // Check if client is a breeder (has linked tenantId)
        // If so, store message in their tenant for Communications Hub visibility
        const clientUser = await prisma.marketplaceUser.findUnique({
          where: { id: clientId },
          select: { tenantId: true, firstName: true, lastName: true, email: true },
        });

        if (clientUser?.tenantId) {
          // BREEDER FLOW: Create MessageThread in breeder's tenant
          // This allows bidirectional visibility:
          // - Breeder sees it in Communications Hub
          // - Provider sees it via unified messaging (Contact.marketplaceUserId)

          const breederTenantId = clientUser.tenantId;
          const providerUserId = targetProvider.userId;

          // Get or create Contact for the provider in breeder's tenant
          let providerContact = await prisma.contact.findFirst({
            where: {
              tenantId: breederTenantId,
              marketplaceUserId: providerUserId,
              deletedAt: null,
            },
            select: { id: true, partyId: true },
          });

          if (!providerContact) {
            // Get provider info for contact/party creation
            const providerInfo = await prisma.marketplaceProvider.findUnique({
              where: { id: targetProviderId },
              select: { businessName: true, publicEmail: true },
            });

            // Create Party for provider in breeder's tenant
            const providerParty = await prisma.party.create({
              data: {
                tenantId: breederTenantId,
                type: "CONTACT",
                name: providerInfo?.businessName || "Service Provider",
                email: providerInfo?.publicEmail || null,
              },
            });

            // Create Contact linking to provider's marketplace user ID
            providerContact = await prisma.contact.create({
              data: {
                tenantId: breederTenantId,
                partyId: providerParty.id,
                display_name: providerInfo?.businessName || "Service Provider",
                email: providerInfo?.publicEmail || null,
                marketplaceUserId: providerUserId,
                marketplaceFirstContactedAt: new Date(),
              },
              select: { id: true, partyId: true },
            });
          }

          // Get breeder's own party in their tenant (for sending messages)
          const breederParty = await prisma.party.findFirst({
            where: {
              tenantId: breederTenantId,
              type: "ORGANIZATION",
            },
            select: { id: true },
          });

          if (!breederParty || !providerContact.partyId) {
            // Fallback to marketplace thread if tenant setup is incomplete
            console.warn(`Breeder tenant ${breederTenantId} missing party, falling back to marketplace thread`);
          } else {
            // Check for existing MessageThread between these parties
            const existingBreederThread = await prisma.messageThread.findFirst({
              where: {
                tenantId: breederTenantId,
                archived: false,
                participants: {
                  every: {
                    partyId: { in: [breederParty.id, providerContact.partyId] },
                  },
                },
              },
              include: {
                participants: true,
              },
            });

            let breederThread = existingBreederThread;

            if (!existingBreederThread) {
              // Create new MessageThread in breeder's tenant
              const threadSubject = body.subject || (listing ? `Question about: ${listing.title}` : "General Inquiry");
              breederThread = await prisma.messageThread.create({
                data: {
                  tenantId: breederTenantId,
                  subject: threadSubject,
                  lastMessageAt: new Date(),
                  firstInboundAt: null, // Outbound from breeder
                  participants: {
                    create: [
                      { partyId: breederParty.id, lastReadAt: new Date() },
                      { partyId: providerContact.partyId },
                    ],
                  },
                },
                include: { participants: true },
              });
            }

            // Create message in the breeder's MessageThread
            const breederMessage = await prisma.message.create({
              data: {
                threadId: breederThread!.id,
                senderPartyId: breederParty.id,
                body: body.message.trim(),
              },
            });

            // Update thread lastMessageAt
            await prisma.messageThread.update({
              where: { id: breederThread!.id },
              data: { lastMessageAt: new Date() },
            });

            // Also increment listing inquiry count
            if (body.listingId) {
              await prisma.mktListingBreederService.update({
                where: { id: body.listingId },
                data: { inquiryCount: { increment: 1 } },
              });
            }

            // Return response with breeder thread format
            return reply.code(201).send({
              ok: true,
              thread: {
                id: breederThread!.id,
                prefixedId: `breeder-${breederThread!.id}`,
                subject: breederThread!.subject,
                status: "active",
                source: "breeder",
              },
              message: {
                id: Number(breederMessage.id),
                threadId: breederThread!.id,
                senderId: breederParty.id,
                senderType: "breeder",
                messageText: breederMessage.body,
                createdAt: breederMessage.createdAt.toISOString(),
              },
            });
          }
        }

        // NON-BREEDER FLOW: Use MarketplaceMessageThread (existing behavior)
        // Check for existing open inquiry thread for same listing/provider
        const existingThread = await prisma.marketplaceMessageThread.findFirst({
          where: {
            clientId,
            providerId: targetProviderId,
            listingId: body.listingId || null,
            transactionId: null, // inquiry = no transaction
            status: "active",
          },
        });

        let thread = existingThread;

        if (!existingThread) {
          // Create new inquiry thread with first client message timestamp
          thread = await prisma.marketplaceMessageThread.create({
            data: {
              clientId,
              providerId: targetProviderId,
              listingId: body.listingId || null,
              transactionId: null,
              subject: body.subject || (listing ? `Question about: ${listing.title}` : "General Inquiry"),
              status: "active",
              firstClientMessageAt: new Date(),
            },
          });

          // Increment listing inquiry count
          if (body.listingId) {
            await prisma.mktListingBreederService.update({
              where: { id: body.listingId },
              data: { inquiryCount: { increment: 1 } },
            });
          }
        }

        // Create the message
        const message = await prisma.marketplaceMessage.create({
          data: {
            threadId: thread!.id,
            senderId: clientId,
            senderType: "client",
            messageText: body.message.trim(),
          },
        });

        // Update thread lastMessageAt and track first client message if not set
        const threadUpdateData: any = { lastMessageAt: new Date() };
        if (!thread!.firstClientMessageAt) {
          threadUpdateData.firstClientMessageAt = new Date();
        }
        await prisma.marketplaceMessageThread.update({
          where: { id: thread!.id },
          data: threadUpdateData,
        });

        // TODO: Send notification email to provider

        return reply.code(201).send({
          ok: true,
          thread: {
            id: thread!.id,
            subject: thread!.subject,
            status: thread!.status,
          },
          message: {
            id: Number(message.id),
            threadId: message.threadId,
            senderId: message.senderId,
            senderType: message.senderType,
            messageText: message.messageText,
            createdAt: message.createdAt.toISOString(),
          },
        });
      } catch (error: any) {
        console.error("Error creating inquiry:", error);
        return reply.code(500).send({
          error: "inquiry_failed",
          message: "Failed to send inquiry. Please try again.",
        });
      }
    }
  );
}
