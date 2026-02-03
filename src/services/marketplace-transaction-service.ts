// src/services/marketplace-transaction-service.ts
/**
 * Marketplace Transaction Service
 *
 * Business logic for transaction operations including:
 * - Fee calculations
 * - Transaction creation with invoice
 * - Payment processing
 * - Refund handling
 */

import prisma from "../prisma.js";
import type { MarketplaceTransaction, MarketplaceServiceListing, MarketplaceProvider, MarketplaceUser } from "@prisma/client";
import { stripe } from "./stripe-service.js";

/**
 * Fee calculation result
 */
export interface TransactionFees {
  servicePriceCents: number;
  platformFeeCents: number;
  stripeFeesCents: number;
  totalCents: number;
}

/**
 * Transaction with full details for responses
 */
export type TransactionWithDetails = MarketplaceTransaction & {
  client: MarketplaceUser;
  provider: MarketplaceProvider & {
    user: MarketplaceUser;
  };
  listing: MarketplaceServiceListing | null;
};

/**
 * Calculate transaction fees
 *
 * Fee structure:
 * - Platform fee: 10% of service price
 * - Stripe fees: 2.9% + $0.30 (only for Stripe mode)
 * - Total: service price + platform fee + stripe fees
 *
 * @param servicePriceCents - Base service price in cents
 * @param paymentMode - "manual" or "stripe"
 * @returns Fee breakdown
 */
export function calculateTransactionFees(
  servicePriceCents: number,
  paymentMode: "manual" | "stripe"
): TransactionFees {
  // Platform fee: 10% of service price
  const platformFeeCents = Math.round(servicePriceCents * 0.10);

  // Subtotal before Stripe fees
  const subtotal = servicePriceCents + platformFeeCents;

  // Stripe fees: 2.9% + $0.30 (only for Stripe mode)
  const stripeFeesCents = paymentMode === "stripe"
    ? Math.round(subtotal * 0.029 + 30)
    : 0;

  // Total amount buyer pays
  const totalCents = subtotal + stripeFeesCents;

  return {
    servicePriceCents,
    platformFeeCents,
    stripeFeesCents,
    totalCents,
  };
}

/**
 * Validate listing is available for booking
 *
 * @param listing - Service listing to validate
 * @throws Error if listing is not available
 */
function validateListingAvailability(listing: MarketplaceServiceListing | null): void {
  if (!listing) {
    throw new Error("listing_not_found");
  }

  if (listing.status !== "LIVE") {
    throw new Error("listing_not_published");
  }

  if (listing.deletedAt) {
    throw new Error("listing_deleted");
  }

  if (!listing.priceCents) {
    throw new Error("listing_price_required");
  }
}

/**
 * Create transaction with invoice
 *
 * Creates a new transaction for a service booking, calculates fees,
 * creates associated invoice, and returns full transaction details.
 *
 * @param params - Transaction creation parameters
 * @returns Full transaction with provider and listing details
 */
export async function createTransaction(params: {
  clientId: number;
  serviceListingId: number;
  buyerNotes?: string;
}): Promise<TransactionWithDetails> {
  const { clientId, serviceListingId, buyerNotes } = params;

  // Fetch listing with provider details
  const listing = await prisma.mktListingProviderService.findUnique({
    where: { id: serviceListingId },
    include: {
      provider: {
        include: {
          user: true,
        },
      },
    },
  });

  // Validate listing availability
  validateListingAvailability(listing);

  // Get provider payment mode
  const paymentMode = listing!.provider.paymentMode as "manual" | "stripe";

  // Calculate fees
  const fees = calculateTransactionFees(
    Number(listing!.priceCents!),
    paymentMode
  );

  // Create transaction, invoice, and message thread in a transaction block
  const transaction = await prisma.$transaction(async (tx) => {
    // Create transaction
    const newTransaction = await tx.marketplaceTransaction.create({
      data: {
        clientId,
        providerId: listing!.providerId,
        listingId: serviceListingId,

        // Snapshot service details at booking time
        serviceDescription: `${listing!.title}${listing!.description ? ": " + listing!.description : ""}`,
        serviceNotes: buyerNotes || null,

        // Fee breakdown
        servicePriceCents: BigInt(fees.servicePriceCents),
        platformFeeCents: BigInt(fees.platformFeeCents),
        stripeFeesCents: BigInt(fees.stripeFeesCents),
        totalCents: BigInt(fees.totalCents),

        // Transaction status
        status: "pending",
      },
      include: {
        client: true,
        provider: {
          include: {
            user: true,
          },
        },
        listing: true,
      },
    });

    // Create associated invoice
    await tx.marketplaceInvoice.create({
      data: {
        transactionId: BigInt(newTransaction.id),
        clientId: clientId,
        providerId: listing!.providerId,

        // Invoice number (auto-generated or manual)
        invoiceNumber: `MP-${Date.now()}-${newTransaction.id}`,

        // Amounts
        subtotalCents: BigInt(fees.servicePriceCents + fees.platformFeeCents),
        totalCents: BigInt(fees.totalCents),
        balanceCents: BigInt(fees.totalCents),

        // Status
        status: "pending",
        sentAt: new Date(),
        issuedAt: new Date(),

        // Payment mode
        paymentMode,
      },
    });

    // Auto-create message thread for this transaction
    await tx.marketplaceMessageThread.create({
      data: {
        clientId,
        providerId: listing!.providerId,
        listingId: serviceListingId,
        transactionId: BigInt(newTransaction.id),
        subject: `Booking: ${listing!.title}`,
        status: "active",
      },
    });

    return newTransaction;
  });

  return transaction as TransactionWithDetails;
}

/**
 * Find transaction by ID with full details
 *
 * @param transactionId - Transaction ID
 * @returns Transaction with provider, client, and listing details or null
 */
export async function findTransactionById(
  transactionId: number
): Promise<TransactionWithDetails | null> {
  const transaction = await prisma.marketplaceTransaction.findUnique({
    where: { id: transactionId },
    include: {
      client: true,
      provider: {
        include: {
          user: true,
        },
      },
      listing: true,
    },
  });

  return transaction as TransactionWithDetails | null;
}

/**
 * Find transaction by ID scoped to buyer
 *
 * @param transactionId - Transaction ID
 * @param clientId - Buyer's user ID
 * @returns Transaction or null if not found/unauthorized
 */
export async function findBuyerTransaction(
  transactionId: number,
  clientId: number
): Promise<TransactionWithDetails | null> {
  const transaction = await prisma.marketplaceTransaction.findFirst({
    where: {
      id: transactionId,
      clientId,
    },
    include: {
      client: true,
      provider: {
        include: {
          user: true,
        },
      },
      listing: true,
    },
  });

  return transaction as TransactionWithDetails | null;
}

/**
 * Find transaction by ID scoped to provider
 *
 * @param transactionId - Transaction ID
 * @param providerId - Provider ID
 * @returns Transaction or null if not found/unauthorized
 */
export async function findProviderTransaction(
  transactionId: number,
  providerId: number
): Promise<TransactionWithDetails | null> {
  const transaction = await prisma.marketplaceTransaction.findFirst({
    where: {
      id: transactionId,
      providerId,
    },
    include: {
      client: true,
      provider: {
        include: {
          user: true,
        },
      },
      listing: true,
    },
  });

  return transaction as TransactionWithDetails | null;
}

/**
 * Find transaction accessible by user (buyer or provider)
 *
 * @param transactionId - Transaction ID
 * @param userId - User ID (buyer or provider's user)
 * @returns Transaction or null if not found/unauthorized
 */
export async function findAccessibleTransaction(
  transactionId: number,
  userId: number
): Promise<TransactionWithDetails | null> {
  const transaction = await prisma.marketplaceTransaction.findFirst({
    where: {
      id: transactionId,
      OR: [
        { clientId: userId },
        { provider: { userId } },
      ],
    },
    include: {
      client: true,
      provider: {
        include: {
          user: true,
        },
      },
      listing: true,
    },
  });

  return transaction as TransactionWithDetails | null;
}

/**
 * Mark transaction as paid by buyer (manual payment mode)
 * Buyer claims they have sent payment externally
 *
 * @param transactionId - Transaction ID
 * @param clientId - Buyer's user ID
 * @throws Error if transaction not found, already paid, or not manual mode
 */
export async function markTransactionAsPaid(
  transactionId: number,
  clientId: number
): Promise<TransactionWithDetails> {
  // Find transaction
  const transaction = await findBuyerTransaction(transactionId, clientId);

  if (!transaction) {
    throw new Error("transaction_not_found");
  }

  if (transaction.status !== "pending") {
    throw new Error("transaction_not_pending");
  }

  // Get invoice to check payment mode
  const invoice = await prisma.marketplaceInvoice.findUnique({
    where: { transactionId: BigInt(transactionId) },
  });

  if (!invoice) {
    throw new Error("invoice_not_found");
  }

  if (invoice.paymentMode !== "manual") {
    throw new Error("manual_payment_only");
  }

  // Update invoice status to awaiting_confirmation
  await prisma.marketplaceInvoice.update({
    where: { id: invoice.id },
    data: {
      status: "awaiting_confirmation",
    },
  });

  // Return updated transaction
  return findBuyerTransaction(transactionId, clientId) as Promise<TransactionWithDetails>;
}

/**
 * Confirm manual payment (provider confirms payment received)
 *
 * @param transactionId - Transaction ID
 * @param providerId - Provider ID
 * @throws Error if transaction not found, not awaiting confirmation
 */
export async function confirmManualPayment(
  transactionId: number,
  providerId: number
): Promise<TransactionWithDetails> {
  // Find transaction
  const transaction = await findProviderTransaction(transactionId, providerId);

  if (!transaction) {
    throw new Error("transaction_not_found");
  }

  if (transaction.status !== "pending") {
    throw new Error("transaction_not_pending");
  }

  // Get invoice
  const invoice = await prisma.marketplaceInvoice.findUnique({
    where: { transactionId: BigInt(transactionId) },
  });

  if (!invoice) {
    throw new Error("invoice_not_found");
  }

  if (invoice.paymentMode !== "manual") {
    throw new Error("manual_payment_only");
  }

  if (invoice.status !== "awaiting_confirmation") {
    throw new Error("not_awaiting_confirmation");
  }

  // Update both transaction and invoice to paid
  await prisma.$transaction(async (tx) => {
    await tx.marketplaceTransaction.update({
      where: { id: transactionId },
      data: {
        status: "paid",
        paidAt: new Date(),
      },
    });

    await tx.marketplaceInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "paid",
        paidAt: new Date(),
        balanceCents: BigInt(0),
      },
    });
  });

  // Return updated transaction
  return findProviderTransaction(transactionId, providerId) as Promise<TransactionWithDetails>;
}

/**
 * Create Stripe Checkout session for transaction
 *
 * @param transactionId - Transaction ID
 * @param clientId - Buyer's user ID
 * @returns Stripe Checkout session URL
 * @throws Error if transaction not found, not pending, or not Stripe mode
 */
export async function createTransactionCheckout(
  transactionId: number,
  clientId: number
): Promise<string> {
  // Find transaction
  const transaction = await findBuyerTransaction(transactionId, clientId);

  if (!transaction) {
    throw new Error("transaction_not_found");
  }

  if (transaction.status !== "pending") {
    throw new Error("transaction_not_pending");
  }

  // Get invoice
  const invoice = await prisma.marketplaceInvoice.findUnique({
    where: { transactionId: BigInt(transactionId) },
  });

  if (!invoice) {
    throw new Error("invoice_not_found");
  }

  if (invoice.paymentMode !== "stripe") {
    throw new Error("stripe_payment_only");
  }

  // Check if provider has Stripe account
  if (!transaction.provider.stripeConnectAccountId) {
    throw new Error("provider_stripe_not_configured");
  }

  // Create Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: transaction.client.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: transaction.listing?.title || transaction.serviceDescription.split(':')[0],
            description: transaction.serviceDescription,
          },
          unit_amount: Number(transaction.totalCents),
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: Number(transaction.platformFeeCents + transaction.stripeFeesCents),
      transfer_data: {
        destination: transaction.provider.stripeConnectAccountId,
      },
      metadata: {
        transactionId: transactionId.toString(),
        providerId: transaction.providerId.toString(),
        clientId: clientId.toString(),
      },
    },
    metadata: {
      transactionId: transactionId.toString(),
      providerId: transaction.providerId.toString(),
      clientId: clientId.toString(),
    },
    success_url: `${process.env.MARKETPLACE_URL || "http://marketplace.breederhq.test:5174"}/transactions/${transactionId}?payment=success`,
    cancel_url: `${process.env.MARKETPLACE_URL || "http://marketplace.breederhq.test:5174"}/transactions/${transactionId}?payment=cancelled`,
  });

  // Note: stripeCheckoutId field doesn't exist in schema yet
  // Transaction tracking will be done via metadata in webhook

  return session.url!;
}

/**
 * Mark service as started (provider indicates service has begun)
 *
 * @param transactionId - Transaction ID
 * @param providerId - Provider ID
 * @throws Error if transaction not found or not in paid status
 */
export async function startService(
  transactionId: number,
  providerId: number
): Promise<TransactionWithDetails> {
  const transaction = await findProviderTransaction(transactionId, providerId);

  if (!transaction) {
    throw new Error("transaction_not_found");
  }

  if (transaction.status !== "paid") {
    throw new Error("transaction_not_paid");
  }

  await prisma.marketplaceTransaction.update({
    where: { id: transactionId },
    data: {
      status: "started",
      startedAt: new Date(),
    },
  });

  return findProviderTransaction(transactionId, providerId) as Promise<TransactionWithDetails>;
}

/**
 * Mark service as completed (provider indicates service is finished)
 *
 * @param transactionId - Transaction ID
 * @param providerId - Provider ID
 * @throws Error if transaction not found or not in paid/started status
 */
export async function completeService(
  transactionId: number,
  providerId: number
): Promise<TransactionWithDetails> {
  const transaction = await findProviderTransaction(transactionId, providerId);

  if (!transaction) {
    throw new Error("transaction_not_found");
  }

  if (transaction.status !== "paid" && transaction.status !== "started") {
    throw new Error("invalid_status_for_completion");
  }

  await prisma.marketplaceTransaction.update({
    where: { id: transactionId },
    data: {
      status: "completed",
      completedAt: new Date(),
    },
  });

  // Update provider stats
  await prisma.marketplaceProvider.update({
    where: { id: providerId },
    data: {
      completedTransactions: { increment: 1 },
    },
  });

  return findProviderTransaction(transactionId, providerId) as Promise<TransactionWithDetails>;
}

/**
 * Cancel transaction (buyer or provider can cancel)
 *
 * @param transactionId - Transaction ID
 * @param userId - User ID (buyer or provider's user)
 * @param reason - Cancellation reason
 * @throws Error if transaction not found or already completed
 */
export async function cancelTransaction(
  transactionId: number,
  userId: number,
  reason?: string
): Promise<TransactionWithDetails> {
  const transaction = await findAccessibleTransaction(transactionId, userId);

  if (!transaction) {
    throw new Error("transaction_not_found");
  }

  // Cannot cancel completed transactions
  if (transaction.status === "completed" || transaction.status === "cancelled" || transaction.status === "refunded") {
    throw new Error("cannot_cancel_transaction");
  }

  // If transaction is paid, it requires refund
  if (transaction.status === "paid" || transaction.status === "started") {
    throw new Error("paid_transaction_requires_refund");
  }

  await prisma.marketplaceTransaction.update({
    where: { id: transactionId },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: reason || null,
    },
  });

  return findAccessibleTransaction(transactionId, userId) as Promise<TransactionWithDetails>;
}

/**
 * Process refund for transaction (full or partial)
 *
 * @param transactionId - Transaction ID
 * @param providerId - Provider ID (only provider can initiate refund)
 * @param reason - Refund reason
 * @param amountCents - Amount to refund in cents (defaults to full refund)
 * @throws Error if transaction not found, not paid, or Stripe refund fails
 */
export async function refundTransaction(
  transactionId: number,
  providerId: number,
  reason?: string,
  amountCents?: number
): Promise<TransactionWithDetails> {
  const transaction = await findProviderTransaction(transactionId, providerId);

  if (!transaction) {
    throw new Error("transaction_not_found");
  }

  if (transaction.status !== "paid" && transaction.status !== "started") {
    throw new Error("only_paid_transactions_can_be_refunded");
  }

  // Determine refund amount (default to full refund)
  const totalPaidCents = Number(transaction.totalCents);
  const existingRefundCents = Number(transaction.refundAmountCents || 0n);
  const refundAmountCents = amountCents ?? totalPaidCents;

  // Validate refund amount
  if (refundAmountCents <= 0) {
    throw new Error("refund_amount_must_be_positive");
  }

  if (refundAmountCents + existingRefundCents > totalPaidCents) {
    throw new Error("refund_amount_exceeds_total_paid");
  }

  // Get invoice to check payment mode
  const invoice = await prisma.marketplaceInvoice.findUnique({
    where: { transactionId: BigInt(transactionId) },
  });

  if (!invoice) {
    throw new Error("invoice_not_found");
  }

  // For Stripe mode, process Stripe refund
  if (invoice.paymentMode === "stripe") {
    if (!invoice.stripePaymentIntentId) {
      throw new Error("stripe_payment_intent_not_found");
    }

    try {
      // Create refund through Stripe API
      // This will automatically reverse the application fee and transfer proportionally
      await stripe.refunds.create({
        payment_intent: invoice.stripePaymentIntentId,
        amount: refundAmountCents, // Stripe API uses cents
        reason: "requested_by_customer",
      });
    } catch (stripeError: any) {
      console.error("Stripe refund failed:", stripeError);
      throw new Error(`stripe_refund_failed: ${stripeError.message}`);
    }
  }

  // Calculate new refund amount and determine if fully refunded
  const newRefundAmountCents = existingRefundCents + refundAmountCents;
  const isFullyRefunded = newRefundAmountCents >= totalPaidCents;

  // Update transaction and invoice
  await prisma.$transaction(async (tx) => {
    await tx.marketplaceTransaction.update({
      where: { id: transactionId },
      data: {
        status: isFullyRefunded ? "refunded" : "paid", // Keep as "paid" if partial refund
        refundedAt: isFullyRefunded ? new Date() : transaction.refundedAt, // Only set if full refund
        refundAmountCents: BigInt(newRefundAmountCents),
        refundReason: reason || transaction.refundReason || null,
        cancellationReason: reason || transaction.cancellationReason || null,
      },
    });

    // Update invoice balance
    const newBalanceCents = totalPaidCents - newRefundAmountCents;
    await tx.marketplaceInvoice.update({
      where: { id: invoice.id },
      data: {
        status: isFullyRefunded ? "refunded" : "paid",
        balanceCents: BigInt(newBalanceCents),
      },
    });
  });

  return findProviderTransaction(transactionId, providerId) as Promise<TransactionWithDetails>;
}
/**
 * List provider's transactions
 *
 * @param providerId - Provider ID
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Array of transactions with pagination info
 */
export async function listProviderTransactions(
  providerId: number,
  page: number = 1,
  limit: number = 20
): Promise<{ transactions: TransactionWithDetails[]; total: number; page: number; limit: number }> {
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    prisma.marketplaceTransaction.findMany({
      where: {
        providerId,
      },
      include: {
        client: true,
        provider: {
          include: {
            user: true,
          },
        },
        listing: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.marketplaceTransaction.count({
      where: {
        providerId,
      },
    }),
  ]);

  return {
    transactions: transactions as TransactionWithDetails[],
    total,
    page,
    limit,
  };
}
