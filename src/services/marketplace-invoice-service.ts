/**
 * Marketplace Invoice Service
 *
 * Handles Stripe Invoice creation and management for marketplace providers.
 * Invoices are created directly on the provider's Stripe Connect account,
 * with NO platform fees - providers receive 100% of payments.
 *
 * The platform facilitates connections but is NOT a broker.
 */

import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import prisma from "../prisma.js";
import { getStripe } from "./stripe-service.js";

// ============================================================================
// Types
// ============================================================================

export interface CreateInvoiceParams {
  providerId: number;
  clientEmail: string;
  clientName: string;
  description: string;
  amountCents: number;
  dueInDays?: number;
  transactionId?: number; // Optional link to existing marketplace transaction
  notes?: string;
}

export interface InvoiceWithDetails {
  id: number;
  invoiceNumber: string;
  stripeInvoiceId: string | null;
  stripeInvoiceUrl: string | null;
  stripeInvoicePdfUrl: string | null;
  providerId: number;
  clientId: number;
  client: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  subtotalCents: bigint;
  totalCents: bigint;
  paidCents: bigint;
  balanceCents: bigint;
  status: string;
  paymentMode: string;
  issuedAt: Date | null;
  sentAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  voidedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  transactionId: bigint | null;
}

export interface ListInvoicesParams {
  providerId: number;
  status?: string[];
  page?: number;
  limit?: number;
}

export interface PaginatedInvoices {
  invoices: InvoiceWithDetails[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get or create a Stripe Customer on the provider's connected account
 */
async function getOrCreateConnectedCustomer(
  stripeAccountId: string,
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<string> {
  // Check if customer already exists on this connected account
  const existingCustomers = await getStripe().customers.list(
    {
      email,
      limit: 1,
    },
    {
      stripeAccount: stripeAccountId,
    }
  );

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  // Create new customer on connected account
  const customer = await getStripe().customers.create(
    {
      email,
      name,
      metadata,
    },
    {
      stripeAccount: stripeAccountId,
    }
  );

  return customer.id;
}

/**
 * Generate a unique invoice number
 */
function generateInvoiceNumber(providerId: number): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `INV-${providerId}-${timestamp}-${random}`;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Create a Stripe Invoice on the provider's connected account
 *
 * This creates the invoice directly on the provider's Stripe account,
 * with NO application fees - the provider receives 100% of the payment.
 */
export async function createStripeInvoice(
  params: CreateInvoiceParams
): Promise<InvoiceWithDetails> {
  const {
    providerId,
    clientEmail,
    clientName,
    description,
    amountCents,
    dueInDays = 7,
    transactionId,
    notes,
  } = params;

  // Get provider with Stripe account
  const provider = await prisma.marketplaceProvider.findUnique({
    where: { id: providerId },
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectPayoutsEnabled: true,
      businessName: true,
    },
  });

  if (!provider) {
    throw new Error("provider_not_found");
  }

  if (!provider.stripeConnectAccountId) {
    throw new Error("provider_stripe_not_configured");
  }

  if (!provider.stripeConnectPayoutsEnabled) {
    throw new Error("provider_stripe_payouts_not_enabled");
  }

  // Find or create marketplace user for the client
  let marketplaceUser = await prisma.marketplaceUser.findUnique({
    where: { email: clientEmail },
  });

  if (!marketplaceUser) {
    // Create marketplace user for this client
    // Note: This is an "invoice-only" client - they haven't registered yet
    // We create with a random passwordHash that can't be used for login
    // They can later register properly using password reset flow
    const nameParts = clientName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || null;

    // Generate a random 64-byte hash that won't match any real password
    const placeholderPasswordHash = `invoice_client_${randomBytes(64).toString("hex")}`;

    marketplaceUser = await prisma.marketplaceUser.create({
      data: {
        email: clientEmail,
        firstName,
        lastName,
        passwordHash: placeholderPasswordHash,
        userType: "buyer",
      },
    });
  }

  // Get or create Stripe customer on provider's connected account
  const stripeCustomerId = await getOrCreateConnectedCustomer(
    provider.stripeConnectAccountId,
    clientEmail,
    clientName,
    {
      marketplaceUserId: String(marketplaceUser.id),
      providerId: String(providerId),
    }
  );

  // Create invoice on provider's Stripe account (NO application_fee_amount)
  const stripeInvoice = await getStripe().invoices.create(
    {
      customer: stripeCustomerId,
      collection_method: "send_invoice",
      days_until_due: dueInDays,
      description,
      metadata: {
        providerId: String(providerId),
        clientId: String(marketplaceUser.id),
        transactionId: transactionId ? String(transactionId) : "",
        source: "breederhq_marketplace",
      },
      // NO application_fee_amount - provider keeps 100%
    },
    {
      stripeAccount: provider.stripeConnectAccountId,
    }
  );

  // Add line item
  await getStripe().invoiceItems.create(
    {
      customer: stripeCustomerId,
      invoice: stripeInvoice.id,
      amount: amountCents,
      currency: "usd",
      description,
    },
    {
      stripeAccount: provider.stripeConnectAccountId,
    }
  );

  // Generate invoice number
  const invoiceNumber = generateInvoiceNumber(providerId);

  // Create local invoice record
  // Note: If transactionId is provided, we need to handle differently
  // For now, we'll create a standalone invoice without a transaction link
  // since the existing schema requires a transaction

  // For standalone invoices (not linked to a transaction), we need to create
  // a placeholder transaction or modify the schema. For now, let's create
  // a "direct invoice" transaction.
  let dbTransactionId: bigint;

  if (transactionId) {
    // Verify transaction belongs to this provider
    const existingTransaction = await prisma.marketplaceTransaction.findFirst({
      where: {
        id: transactionId,
        providerId,
      },
    });

    if (!existingTransaction) {
      throw new Error("transaction_not_found");
    }

    dbTransactionId = BigInt(transactionId);

    // Check if invoice already exists for this transaction
    const existingInvoice = await prisma.marketplaceInvoice.findUnique({
      where: { transactionId: dbTransactionId },
    });

    if (existingInvoice) {
      throw new Error("invoice_already_exists_for_transaction");
    }
  } else {
    // Create a direct invoice transaction (no listing involved)
    const transaction = await prisma.marketplaceTransaction.create({
      data: {
        clientId: marketplaceUser.id,
        providerId,
        listingId: null,
        serviceDescription: description,
        servicePriceCents: BigInt(amountCents),
        platformFeeCents: BigInt(0), // No platform fees
        stripeFeesCents: BigInt(0),
        totalCents: BigInt(amountCents),
        status: "pending",
      },
    });

    dbTransactionId = BigInt(transaction.id);
  }

  // Create the invoice record
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueInDays);

  const invoice = await prisma.marketplaceInvoice.create({
    data: {
      transactionId: dbTransactionId,
      providerId,
      clientId: marketplaceUser.id,
      invoiceNumber,
      subtotalCents: BigInt(amountCents),
      taxCents: BigInt(0),
      totalCents: BigInt(amountCents),
      paidCents: BigInt(0),
      balanceCents: BigInt(amountCents),
      status: "draft",
      paymentMode: "stripe",
      stripeInvoiceId: stripeInvoice.id,
      issuedAt: new Date(),
      dueAt: dueDate,
      notes,
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
    },
  });

  return invoice as unknown as InvoiceWithDetails;
}

/**
 * Send an invoice to the client via Stripe
 *
 * This finalizes the invoice and triggers Stripe to send an email
 * with a hosted payment link.
 */
export async function sendInvoice(
  invoiceId: number,
  providerId: number
): Promise<InvoiceWithDetails> {
  // Get invoice with provider info
  const invoice = await prisma.marketplaceInvoice.findFirst({
    where: {
      id: invoiceId,
      providerId,
    },
    include: {
      provider: {
        select: {
          stripeConnectAccountId: true,
        },
      },
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error("invoice_not_found");
  }

  if (!invoice.stripeInvoiceId) {
    throw new Error("stripe_invoice_not_created");
  }

  if (!invoice.provider.stripeConnectAccountId) {
    throw new Error("provider_stripe_not_configured");
  }

  if (invoice.status !== "draft") {
    throw new Error("invoice_already_sent");
  }

  // Finalize and send the invoice via Stripe
  const stripeInvoice = await getStripe().invoices.sendInvoice(
    invoice.stripeInvoiceId,
    {
      stripeAccount: invoice.provider.stripeConnectAccountId,
    }
  );

  // Update local invoice record
  const updatedInvoice = await prisma.marketplaceInvoice.update({
    where: { id: invoiceId },
    data: {
      status: "sent",
      sentAt: new Date(),
      stripeInvoiceUrl: stripeInvoice.hosted_invoice_url,
      stripeInvoicePdfUrl: stripeInvoice.invoice_pdf,
      stripeInvoiceSentAt: new Date(),
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
    },
  });

  // Update transaction status to invoiced
  await prisma.marketplaceTransaction.update({
    where: { id: Number(invoice.transactionId) },
    data: {
      status: "invoiced",
      invoicedAt: new Date(),
    },
  });

  console.log("[Invoice] Sent:", {
    invoiceId,
    stripeInvoiceId: invoice.stripeInvoiceId,
    providerId,
    clientEmail: invoice.client.email,
  });

  return updatedInvoice as unknown as InvoiceWithDetails;
}

/**
 * Void an unpaid invoice
 */
export async function voidInvoice(
  invoiceId: number,
  providerId: number
): Promise<InvoiceWithDetails> {
  // Get invoice with provider info
  const invoice = await prisma.marketplaceInvoice.findFirst({
    where: {
      id: invoiceId,
      providerId,
    },
    include: {
      provider: {
        select: {
          stripeConnectAccountId: true,
        },
      },
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error("invoice_not_found");
  }

  if (!invoice.stripeInvoiceId) {
    throw new Error("stripe_invoice_not_created");
  }

  if (!invoice.provider.stripeConnectAccountId) {
    throw new Error("provider_stripe_not_configured");
  }

  // Can only void draft or sent invoices (not paid)
  if (!["draft", "sent", "pending"].includes(invoice.status)) {
    throw new Error("cannot_void_invoice");
  }

  // Void the invoice in Stripe
  await getStripe().invoices.voidInvoice(invoice.stripeInvoiceId, {
    stripeAccount: invoice.provider.stripeConnectAccountId,
  });

  // Update local invoice record
  const updatedInvoice = await prisma.marketplaceInvoice.update({
    where: { id: invoiceId },
    data: {
      status: "voided",
      voidedAt: new Date(),
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
    },
  });

  // Update transaction status to cancelled
  await prisma.marketplaceTransaction.update({
    where: { id: Number(invoice.transactionId) },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: "Invoice voided by provider",
    },
  });

  console.log("[Invoice] Voided:", {
    invoiceId,
    stripeInvoiceId: invoice.stripeInvoiceId,
    providerId,
  });

  return updatedInvoice as unknown as InvoiceWithDetails;
}

/**
 * Get invoice by ID
 */
export async function getInvoice(
  invoiceId: number,
  providerId: number
): Promise<InvoiceWithDetails | null> {
  const invoice = await prisma.marketplaceInvoice.findFirst({
    where: {
      id: invoiceId,
      providerId,
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
    },
  });

  return invoice as unknown as InvoiceWithDetails | null;
}

/**
 * List invoices for a provider
 */
export async function listProviderInvoices(
  params: ListInvoicesParams
): Promise<PaginatedInvoices> {
  const { providerId, status, page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;

  const where: any = {
    providerId,
  };

  if (status && status.length > 0) {
    where.status = { in: status };
  }

  const [invoices, total] = await Promise.all([
    prisma.marketplaceInvoice.findMany({
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
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.marketplaceInvoice.count({ where }),
  ]);

  return {
    invoices: invoices as unknown as InvoiceWithDetails[],
    total,
    page,
    limit,
  };
}

/**
 * Get Stripe invoice PDF URL
 *
 * Retrieves the current PDF URL from Stripe (URLs expire)
 */
export async function getInvoicePdfUrl(
  invoiceId: number,
  providerId: number
): Promise<string> {
  const invoice = await prisma.marketplaceInvoice.findFirst({
    where: {
      id: invoiceId,
      providerId,
    },
    include: {
      provider: {
        select: {
          stripeConnectAccountId: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error("invoice_not_found");
  }

  if (!invoice.stripeInvoiceId) {
    throw new Error("stripe_invoice_not_created");
  }

  if (!invoice.provider.stripeConnectAccountId) {
    throw new Error("provider_stripe_not_configured");
  }

  // Get fresh invoice data from Stripe
  const stripeInvoice = await getStripe().invoices.retrieve(
    invoice.stripeInvoiceId,
    {
      stripeAccount: invoice.provider.stripeConnectAccountId,
    }
  );

  if (!stripeInvoice.invoice_pdf) {
    throw new Error("pdf_not_available");
  }

  return stripeInvoice.invoice_pdf;
}

// ============================================================================
// Webhook Handlers
// ============================================================================

/**
 * Handle invoice.sent webhook from connected account
 */
export async function handleInvoiceSent(
  event: Stripe.Event,
  stripeAccountId: string
): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice;

  // Find our invoice by Stripe ID
  const invoice = await prisma.marketplaceInvoice.findFirst({
    where: {
      stripeInvoiceId: stripeInvoice.id,
    },
  });

  if (!invoice) {
    console.warn("[Invoice Webhook] Invoice not found for:", stripeInvoice.id);
    return;
  }

  // Update local record
  await prisma.marketplaceInvoice.update({
    where: { id: invoice.id },
    data: {
      status: "sent",
      sentAt: new Date(),
      stripeInvoiceUrl: stripeInvoice.hosted_invoice_url,
      stripeInvoicePdfUrl: stripeInvoice.invoice_pdf,
      stripeInvoiceSentAt: new Date(),
    },
  });

  console.log("[Invoice Webhook] Invoice sent:", {
    invoiceId: invoice.id,
    stripeInvoiceId: stripeInvoice.id,
  });
}

/**
 * Handle invoice.paid webhook from connected account
 */
export async function handleInvoicePaid(
  event: Stripe.Event,
  stripeAccountId: string
): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice;

  // Find our invoice by Stripe ID with relations for email sending
  const invoice = await prisma.marketplaceInvoice.findFirst({
    where: {
      stripeInvoiceId: stripeInvoice.id,
    },
    include: {
      provider: {
        include: {
          user: { select: { email: true, firstName: true } },
        },
      },
      client: {
        select: { email: true, firstName: true },
      },
      transaction: {
        select: { serviceDescription: true },
      },
    },
  });

  if (!invoice) {
    console.warn("[Invoice Webhook] Invoice not found for:", stripeInvoice.id);
    return;
  }

  // Update invoice and transaction in a transaction
  await prisma.$transaction(async (tx) => {
    // Extract payment intent and charge IDs from the webhook invoice data
    // These fields are expandable in Stripe's API and may be string IDs or expanded objects
    const rawInvoice = stripeInvoice as unknown as Record<string, unknown>;
    let paymentIntentId: string | null = null;
    let chargeId: string | null = null;

    if (rawInvoice.payment_intent) {
      paymentIntentId =
        typeof rawInvoice.payment_intent === "string"
          ? rawInvoice.payment_intent
          : (rawInvoice.payment_intent as { id?: string })?.id || null;
    }

    if (rawInvoice.charge) {
      chargeId =
        typeof rawInvoice.charge === "string"
          ? rawInvoice.charge
          : (rawInvoice.charge as { id?: string })?.id || null;
    }

    // Update invoice
    await tx.marketplaceInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "paid",
        paidAt: new Date(),
        paidCents: BigInt(stripeInvoice.amount_paid),
        balanceCents: BigInt(0),
        stripePaymentIntentId: paymentIntentId,
        stripeChargeId: chargeId,
      },
    });

    // Update transaction
    await tx.marketplaceTransaction.update({
      where: { id: Number(invoice.transactionId) },
      data: {
        status: "paid",
        paidAt: new Date(),
      },
    });
  });

  console.log("[Invoice Webhook] Invoice paid:", {
    invoiceId: invoice.id,
    stripeInvoiceId: stripeInvoice.id,
    amountPaid: stripeInvoice.amount_paid,
  });

  // Send confirmation emails (import dynamically to avoid circular deps)
  try {
    const { sendPaymentReceivedEmailToBuyer, sendPaymentReceivedEmailToProvider } =
      await import("./marketplace-email-service.js");

    const totalAmount = `$${(stripeInvoice.amount_paid / 100).toFixed(2)}`;
    const serviceTitle = invoice.transaction?.serviceDescription?.split(":")[0] || "Service";

    // Send confirmation to client/buyer
    if (invoice.client?.email) {
      sendPaymentReceivedEmailToBuyer({
        buyerEmail: invoice.client.email,
        buyerFirstName: invoice.client.firstName || "Customer",
        transactionId: Number(invoice.transactionId),
        serviceTitle,
        providerBusinessName: invoice.provider.businessName || "Provider",
        totalAmount,
      }).catch((err) => console.error("[Invoice Email] Failed to send buyer confirmation:", err));
    }

    // Send notification to provider
    if (invoice.provider.user?.email) {
      sendPaymentReceivedEmailToProvider({
        providerEmail: invoice.provider.user.email,
        providerBusinessName: invoice.provider.businessName || "Provider",
        transactionId: Number(invoice.transactionId),
        serviceTitle,
        buyerName: invoice.client?.firstName || "Customer",
        totalAmount,
        paymentMode: "stripe",
      }).catch((err) => console.error("[Invoice Email] Failed to send provider notification:", err));
    }
  } catch (err) {
    console.error("[Invoice Email] Failed to send confirmation emails:", err);
  }
}

/**
 * Handle invoice.voided webhook from connected account
 */
export async function handleInvoiceVoided(
  event: Stripe.Event,
  stripeAccountId: string
): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice;

  // Find our invoice by Stripe ID
  const invoice = await prisma.marketplaceInvoice.findFirst({
    where: {
      stripeInvoiceId: stripeInvoice.id,
    },
  });

  if (!invoice) {
    console.warn("[Invoice Webhook] Invoice not found for:", stripeInvoice.id);
    return;
  }

  // Update local record
  await prisma.marketplaceInvoice.update({
    where: { id: invoice.id },
    data: {
      status: "voided",
      voidedAt: new Date(),
    },
  });

  console.log("[Invoice Webhook] Invoice voided:", {
    invoiceId: invoice.id,
    stripeInvoiceId: stripeInvoice.id,
  });
}

/**
 * Handle invoice.payment_failed webhook from connected account
 */
export async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  stripeAccountId: string
): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice;

  // Find our invoice by Stripe ID with relations for email sending
  const invoice = await prisma.marketplaceInvoice.findFirst({
    where: {
      stripeInvoiceId: stripeInvoice.id,
    },
    include: {
      provider: {
        include: {
          user: { select: { email: true } },
        },
      },
      client: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!invoice) {
    console.warn("[Invoice Webhook] Invoice not found for:", stripeInvoice.id);
    return;
  }

  console.log("[Invoice Webhook] Payment failed:", {
    invoiceId: invoice.id,
    stripeInvoiceId: stripeInvoice.id,
    attemptCount: stripeInvoice.attempt_count,
  });

  // Send notification to provider about failed payment
  try {
    const { sendInvoicePaymentFailedToProvider } = await import("./marketplace-email-service.js");

    const clientName = invoice.client?.firstName && invoice.client?.lastName
      ? `${invoice.client.firstName} ${invoice.client.lastName}`
      : invoice.client?.email || "Customer";
    const totalAmount = `$${(Number(invoice.totalCents) / 100).toFixed(2)}`;

    if (invoice.provider?.user?.email) {
      sendInvoicePaymentFailedToProvider({
        providerEmail: invoice.provider.user.email,
        providerBusinessName: invoice.provider.businessName || "Provider",
        clientName,
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice.id,
        totalAmount,
        attemptCount: stripeInvoice.attempt_count || 1,
      }).catch((err) => console.error("[Invoice Email] Failed to send payment failed notification:", err));
    }
  } catch (err) {
    console.error("[Invoice Email] Failed to send payment failed notification:", err);
  }
}
