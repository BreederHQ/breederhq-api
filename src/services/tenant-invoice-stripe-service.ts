/**
 * Tenant Invoice Stripe Service
 *
 * Handles Stripe Invoice creation and management for breeder tenants.
 * Invoices are created directly on the tenant's Stripe Connect account,
 * with NO platform fees - breeders receive 100% of payments.
 *
 * Key Business Requirement: The platform facilitates connections but is NOT a broker.
 * Breeders invoice clients directly through their own Stripe account.
 *
 * Payment Model:
 * - Quick Payment (always): Client receives email with Stripe hosted payment link
 * - Portal Payment (for animal transactions): Client can also view/pay in portal
 */

import Stripe from "stripe";
import prisma from "../prisma.js";
import { stripe } from "./stripe-service.js";
import { canTenantAcceptStripePayments, getTenantStripeAccountId } from "./tenant-stripe-connect-service.js";

// ============================================================================
// Types
// ============================================================================

export interface CreateTenantStripeInvoiceParams {
  tenantId: number;
  invoiceId: number; // Existing invoice ID from platform finance module
  dueInDays?: number;
}

export interface TenantInvoiceWithStripe {
  id: number;
  invoiceNumber: string;
  stripeInvoiceId: string | null;
  stripeInvoiceUrl: string | null;
  stripeInvoicePdfUrl: string | null;
  status: string;
  totalCents: bigint;
  paidCents: bigint;
  balanceCents: bigint;
  sentAt: Date | null;
  paidAt: Date | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get or create a Stripe Customer on the tenant's connected account
 */
async function getOrCreateConnectedCustomer(
  stripeAccountId: string,
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<string> {
  // Check if customer already exists on this connected account
  const existingCustomers = await stripe.customers.list(
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
  const customer = await stripe.customers.create(
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

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Convert an existing platform invoice to a Stripe invoice on the tenant's connected account
 *
 * This creates the invoice directly on the tenant's Stripe account,
 * with NO application fees - the tenant receives 100% of the payment.
 */
export async function createStripeInvoiceForTenant(
  params: CreateTenantStripeInvoiceParams
): Promise<TenantInvoiceWithStripe> {
  const { tenantId, invoiceId, dueInDays = 7 } = params;

  // Get tenant with Stripe account
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      stripeConnectAccountId: true,
      stripeConnectPayoutsEnabled: true,
    },
  });

  if (!tenant) {
    throw new Error("tenant_not_found");
  }

  if (!tenant.stripeConnectAccountId) {
    throw new Error("tenant_stripe_not_configured");
  }

  if (!tenant.stripeConnectPayoutsEnabled) {
    throw new Error("tenant_stripe_payouts_not_enabled");
  }

  // Get the existing invoice with client info
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId,
      deletedAt: null,
    },
    include: {
      clientParty: {
        select: {
          id: true,
          email: true,
          name: true,
          contact: { select: { display_name: true, first_name: true, last_name: true } },
          organization: { select: { name: true } },
        },
      },
      LineItems: true,
    },
  });

  if (!invoice) {
    throw new Error("invoice_not_found");
  }

  if (invoice.stripeInvoiceId) {
    throw new Error("stripe_invoice_already_exists");
  }

  // Get client email and name
  const clientParty = invoice.clientParty;
  if (!clientParty?.email) {
    throw new Error("client_email_required");
  }

  const clientName = clientParty.name
    || clientParty.contact?.display_name
    || (clientParty.contact?.first_name && clientParty.contact?.last_name
      ? `${clientParty.contact.first_name} ${clientParty.contact.last_name}`
      : null)
    || clientParty.organization?.name
    || "Customer";

  // Get or create Stripe customer on tenant's connected account
  const stripeCustomerId = await getOrCreateConnectedCustomer(
    tenant.stripeConnectAccountId,
    clientParty.email,
    clientName,
    {
      tenantId: String(tenantId),
      partyId: String(clientParty.id),
      source: "breederhq_platform",
    }
  );

  // Build description from invoice data
  let description = `Invoice ${invoice.invoiceNumber}`;
  if (invoice.notes) {
    description += ` - ${invoice.notes}`;
  }

  // Determine if this is an animal-related invoice (for portal eligibility)
  const hasAnimalContext = !!(invoice.animalId || invoice.offspringId || invoice.groupId || invoice.breedingPlanId || invoice.waitlistEntryId);

  // Create invoice on tenant's Stripe account (NO application_fee_amount)
  const stripeInvoice = await stripe.invoices.create(
    {
      customer: stripeCustomerId,
      collection_method: "send_invoice",
      days_until_due: dueInDays,
      description,
      metadata: {
        tenantId: String(tenantId),
        invoiceId: String(invoiceId),
        partyId: String(clientParty.id),
        hasAnimalContext: hasAnimalContext ? "true" : "false",
        source: "breederhq_platform",
      },
      // NO application_fee_amount - tenant keeps 100%
    },
    {
      stripeAccount: tenant.stripeConnectAccountId,
    }
  );

  // Add line items from platform invoice
  if (invoice.LineItems && invoice.LineItems.length > 0) {
    for (const item of invoice.LineItems) {
      await stripe.invoiceItems.create(
        {
          customer: stripeCustomerId,
          invoice: stripeInvoice.id,
          amount: Number(item.totalCents),
          currency: invoice.currency.toLowerCase(),
          description: item.description,
        },
        {
          stripeAccount: tenant.stripeConnectAccountId,
        }
      );
    }
  } else {
    // No line items - add single item for total amount
    await stripe.invoiceItems.create(
      {
        customer: stripeCustomerId,
        invoice: stripeInvoice.id,
        amount: Number(invoice.amountCents),
        currency: invoice.currency.toLowerCase(),
        description,
      },
      {
        stripeAccount: tenant.stripeConnectAccountId,
      }
    );
  }

  // Update local invoice record with Stripe info
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueInDays);

  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      stripeInvoiceId: stripeInvoice.id,
      paymentModeSnapshot: "stripe",
      dueAt: invoice.dueAt || dueDate,
    },
  });

  return {
    id: updatedInvoice.id,
    invoiceNumber: updatedInvoice.invoiceNumber,
    stripeInvoiceId: stripeInvoice.id,
    stripeInvoiceUrl: null, // Set after sending
    stripeInvoicePdfUrl: null,
    status: updatedInvoice.status,
    totalCents: updatedInvoice.amountCents,
    paidCents: updatedInvoice.amountCents - updatedInvoice.balanceCents,
    balanceCents: updatedInvoice.balanceCents,
    sentAt: null,
    paidAt: updatedInvoice.paidAt,
  };
}

/**
 * Send a Stripe invoice to the client
 *
 * This finalizes the invoice and triggers Stripe to send an email
 * with a hosted payment link.
 */
export async function sendTenantStripeInvoice(
  tenantId: number,
  invoiceId: number
): Promise<TenantInvoiceWithStripe> {
  // Get invoice with tenant info
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId,
      deletedAt: null,
    },
    include: {
      tenant: {
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

  if (!invoice.tenant.stripeConnectAccountId) {
    throw new Error("tenant_stripe_not_configured");
  }

  // Check if already sent (status would be 'issued' or later)
  if (invoice.status !== "draft") {
    throw new Error("invoice_already_sent");
  }

  // Finalize and send the invoice via Stripe
  const stripeInvoice = await stripe.invoices.sendInvoice(
    invoice.stripeInvoiceId,
    {
      stripeAccount: invoice.tenant.stripeConnectAccountId,
    }
  );

  // Update local invoice record
  const now = new Date();
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "issued",
      issuedAt: invoice.issuedAt || now,
      // Note: These fields need to be added to the schema
      // stripeInvoiceUrl: stripeInvoice.hosted_invoice_url,
      // stripeInvoicePdfUrl: stripeInvoice.invoice_pdf,
      // stripeInvoiceSentAt: now,
    },
  });

  console.log("[Tenant Invoice] Sent:", {
    invoiceId,
    stripeInvoiceId: invoice.stripeInvoiceId,
    tenantId,
  });

  return {
    id: updatedInvoice.id,
    invoiceNumber: updatedInvoice.invoiceNumber,
    stripeInvoiceId: invoice.stripeInvoiceId,
    stripeInvoiceUrl: stripeInvoice.hosted_invoice_url || null,
    stripeInvoicePdfUrl: stripeInvoice.invoice_pdf || null,
    status: updatedInvoice.status,
    totalCents: updatedInvoice.amountCents,
    paidCents: updatedInvoice.amountCents - updatedInvoice.balanceCents,
    balanceCents: updatedInvoice.balanceCents,
    sentAt: now,
    paidAt: updatedInvoice.paidAt,
  };
}

/**
 * Void a Stripe invoice
 */
export async function voidTenantStripeInvoice(
  tenantId: number,
  invoiceId: number
): Promise<TenantInvoiceWithStripe> {
  // Get invoice with tenant info
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId,
      deletedAt: null,
    },
    include: {
      tenant: {
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

  if (!invoice.tenant.stripeConnectAccountId) {
    throw new Error("tenant_stripe_not_configured");
  }

  // Can only void draft or issued invoices (not paid)
  if (!["draft", "issued", "partially_paid"].includes(invoice.status)) {
    throw new Error("cannot_void_invoice");
  }

  // Void the invoice in Stripe
  await stripe.invoices.voidInvoice(invoice.stripeInvoiceId, {
    stripeAccount: invoice.tenant.stripeConnectAccountId,
  });

  // Update local invoice record
  const now = new Date();
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "void",
      voidedAt: now,
    },
  });

  console.log("[Tenant Invoice] Voided:", {
    invoiceId,
    stripeInvoiceId: invoice.stripeInvoiceId,
    tenantId,
  });

  return {
    id: updatedInvoice.id,
    invoiceNumber: updatedInvoice.invoiceNumber,
    stripeInvoiceId: invoice.stripeInvoiceId,
    stripeInvoiceUrl: null,
    stripeInvoicePdfUrl: null,
    status: updatedInvoice.status,
    totalCents: updatedInvoice.amountCents,
    paidCents: updatedInvoice.amountCents - updatedInvoice.balanceCents,
    balanceCents: updatedInvoice.balanceCents,
    sentAt: null,
    paidAt: updatedInvoice.paidAt,
  };
}

/**
 * Get Stripe invoice PDF URL
 *
 * Retrieves the current PDF URL from Stripe (URLs expire)
 */
export async function getTenantInvoicePdfUrl(
  tenantId: number,
  invoiceId: number
): Promise<string> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId,
      deletedAt: null,
    },
    include: {
      tenant: {
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

  if (!invoice.tenant.stripeConnectAccountId) {
    throw new Error("tenant_stripe_not_configured");
  }

  // Get fresh invoice data from Stripe
  const stripeInvoice = await stripe.invoices.retrieve(
    invoice.stripeInvoiceId,
    {
      stripeAccount: invoice.tenant.stripeConnectAccountId,
    }
  );

  if (!stripeInvoice.invoice_pdf) {
    throw new Error("pdf_not_available");
  }

  return stripeInvoice.invoice_pdf;
}

/**
 * Get Stripe invoice hosted URL (for quick payment)
 */
export async function getTenantInvoicePaymentUrl(
  tenantId: number,
  invoiceId: number
): Promise<string> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId,
      deletedAt: null,
    },
    include: {
      tenant: {
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

  if (!invoice.tenant.stripeConnectAccountId) {
    throw new Error("tenant_stripe_not_configured");
  }

  // Get fresh invoice data from Stripe
  const stripeInvoice = await stripe.invoices.retrieve(
    invoice.stripeInvoiceId,
    {
      stripeAccount: invoice.tenant.stripeConnectAccountId,
    }
  );

  if (!stripeInvoice.hosted_invoice_url) {
    throw new Error("payment_url_not_available");
  }

  return stripeInvoice.hosted_invoice_url;
}

// ============================================================================
// Webhook Handlers
// ============================================================================

/**
 * Handle invoice.sent webhook from tenant's connected account
 */
export async function handleTenantInvoiceSent(
  event: Stripe.Event,
  stripeAccountId: string
): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice;
  const source = stripeInvoice.metadata?.source;

  // Only handle platform invoices (not marketplace provider invoices)
  if (source !== "breederhq_platform") {
    return;
  }

  // Find our invoice by Stripe ID
  const invoice = await prisma.invoice.findFirst({
    where: {
      stripeInvoiceId: stripeInvoice.id,
    },
  });

  if (!invoice) {
    console.warn("[Tenant Invoice Webhook] Invoice not found for:", stripeInvoice.id);
    return;
  }

  // Update local record
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "issued",
      issuedAt: invoice.issuedAt || new Date(),
      // Note: These fields need to be added to the schema
      // stripeInvoiceUrl: stripeInvoice.hosted_invoice_url,
      // stripeInvoicePdfUrl: stripeInvoice.invoice_pdf,
      // stripeInvoiceSentAt: new Date(),
    },
  });

  console.log("[Tenant Invoice Webhook] Invoice sent:", {
    invoiceId: invoice.id,
    stripeInvoiceId: stripeInvoice.id,
  });
}

/**
 * Handle invoice.paid webhook from tenant's connected account
 */
export async function handleTenantInvoicePaid(
  event: Stripe.Event,
  stripeAccountId: string
): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice;
  const source = stripeInvoice.metadata?.source;

  // Only handle platform invoices
  if (source !== "breederhq_platform") {
    return;
  }

  // Find our invoice by Stripe ID
  const invoice = await prisma.invoice.findFirst({
    where: {
      stripeInvoiceId: stripeInvoice.id,
    },
  });

  if (!invoice) {
    console.warn("[Tenant Invoice Webhook] Invoice not found for:", stripeInvoice.id);
    return;
  }

  // Extract payment intent and charge IDs
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
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "paid",
      paidAt: new Date(),
      balanceCents: 0,
      stripePaymentIntentId: paymentIntentId,
      // stripeChargeId: chargeId, // Add to schema if needed
    },
  });

  console.log("[Tenant Invoice Webhook] Invoice paid:", {
    invoiceId: invoice.id,
    stripeInvoiceId: stripeInvoice.id,
    amountPaid: stripeInvoice.amount_paid,
  });

  // TODO: Send confirmation emails to breeder and client
}

/**
 * Handle invoice.voided webhook from tenant's connected account
 */
export async function handleTenantInvoiceVoided(
  event: Stripe.Event,
  stripeAccountId: string
): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice;
  const source = stripeInvoice.metadata?.source;

  // Only handle platform invoices
  if (source !== "breederhq_platform") {
    return;
  }

  // Find our invoice by Stripe ID
  const invoice = await prisma.invoice.findFirst({
    where: {
      stripeInvoiceId: stripeInvoice.id,
    },
  });

  if (!invoice) {
    console.warn("[Tenant Invoice Webhook] Invoice not found for:", stripeInvoice.id);
    return;
  }

  // Update local record
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "void",
      voidedAt: new Date(),
    },
  });

  console.log("[Tenant Invoice Webhook] Invoice voided:", {
    invoiceId: invoice.id,
    stripeInvoiceId: stripeInvoice.id,
  });
}

/**
 * Handle invoice.payment_failed webhook from tenant's connected account
 */
export async function handleTenantInvoicePaymentFailed(
  event: Stripe.Event,
  stripeAccountId: string
): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice;
  const source = stripeInvoice.metadata?.source;

  // Only handle platform invoices
  if (source !== "breederhq_platform") {
    return;
  }

  // Find our invoice by Stripe ID
  const invoice = await prisma.invoice.findFirst({
    where: {
      stripeInvoiceId: stripeInvoice.id,
    },
  });

  if (!invoice) {
    console.warn("[Tenant Invoice Webhook] Invoice not found for:", stripeInvoice.id);
    return;
  }

  console.log("[Tenant Invoice Webhook] Payment failed:", {
    invoiceId: invoice.id,
    stripeInvoiceId: stripeInvoice.id,
    attemptCount: stripeInvoice.attempt_count,
  });

  // TODO: Optionally notify breeder of failed payment attempt
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a tenant can create Stripe invoices
 */
export async function canTenantCreateStripeInvoices(tenantId: number): Promise<boolean> {
  return canTenantAcceptStripePayments(tenantId);
}

/**
 * Get invoice Stripe status
 */
export async function getInvoiceStripeStatus(
  tenantId: number,
  invoiceId: number
): Promise<{
  hasStripeInvoice: boolean;
  stripeInvoiceId: string | null;
  paymentUrl: string | null;
  pdfUrl: string | null;
  stripeStatus: string | null;
}> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId,
      deletedAt: null,
    },
    include: {
      tenant: {
        select: {
          stripeConnectAccountId: true,
        },
      },
    },
  });

  if (!invoice || !invoice.stripeInvoiceId || !invoice.tenant.stripeConnectAccountId) {
    return {
      hasStripeInvoice: false,
      stripeInvoiceId: null,
      paymentUrl: null,
      pdfUrl: null,
      stripeStatus: null,
    };
  }

  try {
    const stripeInvoice = await stripe.invoices.retrieve(
      invoice.stripeInvoiceId,
      {
        stripeAccount: invoice.tenant.stripeConnectAccountId,
      }
    );

    return {
      hasStripeInvoice: true,
      stripeInvoiceId: invoice.stripeInvoiceId,
      paymentUrl: stripeInvoice.hosted_invoice_url || null,
      pdfUrl: stripeInvoice.invoice_pdf || null,
      stripeStatus: stripeInvoice.status || null,
    };
  } catch (err) {
    console.error("[Tenant Invoice] Failed to get Stripe invoice status:", err);
    return {
      hasStripeInvoice: true,
      stripeInvoiceId: invoice.stripeInvoiceId,
      paymentUrl: null,
      pdfUrl: null,
      stripeStatus: null,
    };
  }
}
