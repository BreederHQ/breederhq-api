/**
 * Marketplace Invoice Routes
 *
 * Mounted at: /api/v1/marketplace/invoices
 *
 * Provides endpoints for marketplace providers to create and manage
 * Stripe invoices for their clients. Invoices are created directly
 * on the provider's Stripe Connect account with NO platform fees.
 *
 * Endpoints:
 *   POST   /                 - Create a new invoice
 *   GET    /                 - List provider's invoices
 *   GET    /:id              - Get invoice details
 *   POST   /:id/send         - Send invoice to client via Stripe
 *   POST   /:id/void         - Void an unpaid invoice
 *   GET    /:id/pdf          - Get invoice PDF URL
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { requireProvider } from "../middleware/marketplace-provider-auth.js";
import * as invoiceService from "../services/marketplace-invoice-service.js";

export default async function marketplaceInvoicesRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /* ───────────────────────── Create Invoice ───────────────────────── */

  /**
   * POST / - Create a new invoice
   *
   * Creates a Stripe Invoice on the provider's connected account.
   * The invoice is created in draft status and must be sent separately.
   */
  app.post("/", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;

    const {
      clientEmail,
      clientName,
      description,
      amountCents,
      dueInDays,
      transactionId,
      notes,
    } = (req.body || {}) as {
      clientEmail?: string;
      clientName?: string;
      description?: string;
      amountCents?: number;
      dueInDays?: number;
      transactionId?: number;
      notes?: string;
    };

    // Validation
    if (!clientEmail || !clientEmail.includes("@")) {
      return reply.code(400).send({
        error: "invalid_client_email",
        message: "A valid client email is required.",
      });
    }

    // Prevent self-invoicing
    if (clientEmail.trim().toLowerCase() === provider.user.email.toLowerCase()) {
      return reply.code(400).send({
        error: "self_invoice_not_allowed",
        message: "You cannot create an invoice for yourself.",
      });
    }

    if (!clientName || clientName.trim().length === 0) {
      return reply.code(400).send({
        error: "client_name_required",
        message: "Client name is required.",
      });
    }

    if (!description || description.trim().length === 0) {
      return reply.code(400).send({
        error: "description_required",
        message: "Invoice description is required.",
      });
    }

    if (!amountCents || amountCents < 100) {
      return reply.code(400).send({
        error: "invalid_amount",
        message: "Amount must be at least $1.00 (100 cents).",
      });
    }

    if (dueInDays !== undefined && (dueInDays < 1 || dueInDays > 90)) {
      return reply.code(400).send({
        error: "invalid_due_days",
        message: "Due days must be between 1 and 90.",
      });
    }

    // Check if provider has Stripe Connect set up
    if (!provider.stripeConnectAccountId) {
      return reply.code(400).send({
        error: "stripe_not_configured",
        message: "Please complete Stripe Connect onboarding before creating invoices.",
      });
    }

    if (!provider.stripeConnectPayoutsEnabled) {
      return reply.code(400).send({
        error: "stripe_payouts_not_enabled",
        message: "Stripe payouts are not yet enabled. Please complete onboarding.",
      });
    }

    try {
      const invoice = await invoiceService.createStripeInvoice({
        providerId: provider.id,
        clientEmail: clientEmail.trim().toLowerCase(),
        clientName: clientName.trim(),
        description: description.trim(),
        amountCents,
        dueInDays,
        transactionId,
        notes,
      });

      return reply.code(201).send({
        success: true,
        invoice,
      });
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Failed to create invoice");

      // Handle known errors
      if (err.message === "transaction_not_found") {
        return reply.code(404).send({
          error: "transaction_not_found",
          message: "The specified transaction was not found.",
        });
      }

      if (err.message === "invoice_already_exists_for_transaction") {
        return reply.code(409).send({
          error: "invoice_exists",
          message: "An invoice already exists for this transaction.",
        });
      }

      return reply.code(500).send({
        error: "create_failed",
        message: "Failed to create invoice. Please try again.",
      });
    }
  });

  /* ───────────────────────── List Invoices ───────────────────────── */

  /**
   * GET / - List provider's invoices
   *
   * Supports filtering by status and pagination.
   */
  app.get("/", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;

    const query = req.query as {
      status?: string | string[];
      page?: string;
      limit?: string;
    };

    // Parse status filter (can be single value or array)
    let statusFilter: string[] | undefined;
    if (query.status) {
      statusFilter = Array.isArray(query.status) ? query.status : [query.status];
    }

    // Parse pagination
    const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10) || 20));

    try {
      const result = await invoiceService.listProviderInvoices({
        providerId: provider.id,
        status: statusFilter,
        page,
        limit,
      });

      return reply.send(result);
    } catch (err: any) {
      req.log?.error?.({ err, providerId: provider.id }, "Failed to list invoices");
      return reply.code(500).send({
        error: "list_failed",
        message: "Failed to retrieve invoices.",
      });
    }
  });

  /* ───────────────────────── Get Invoice ───────────────────────── */

  /**
   * GET /:id - Get invoice details
   */
  app.get("/:id", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { id } = req.params as { id: string };

    const invoiceId = parseInt(id, 10);
    if (isNaN(invoiceId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid invoice ID.",
      });
    }

    try {
      const invoice = await invoiceService.getInvoice(invoiceId, provider.id);

      if (!invoice) {
        return reply.code(404).send({
          error: "not_found",
          message: "Invoice not found.",
        });
      }

      return reply.send({ invoice });
    } catch (err: any) {
      req.log?.error?.({ err, invoiceId, providerId: provider.id }, "Failed to get invoice");
      return reply.code(500).send({
        error: "get_failed",
        message: "Failed to retrieve invoice.",
      });
    }
  });

  /* ───────────────────────── Send Invoice ───────────────────────── */

  /**
   * POST /:id/send - Send invoice to client via Stripe
   *
   * Finalizes the invoice and triggers Stripe to send an email
   * with a hosted payment link.
   */
  app.post("/:id/send", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { id } = req.params as { id: string };

    const invoiceId = parseInt(id, 10);
    if (isNaN(invoiceId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid invoice ID.",
      });
    }

    try {
      const invoice = await invoiceService.sendInvoice(invoiceId, provider.id);

      return reply.send({
        success: true,
        message: "Invoice sent successfully.",
        invoice,
      });
    } catch (err: any) {
      req.log?.error?.({ err, invoiceId, providerId: provider.id }, "Failed to send invoice");

      // Handle known errors
      if (err.message === "invoice_not_found") {
        return reply.code(404).send({
          error: "not_found",
          message: "Invoice not found.",
        });
      }

      if (err.message === "invoice_already_sent") {
        return reply.code(400).send({
          error: "already_sent",
          message: "This invoice has already been sent.",
        });
      }

      if (err.message === "stripe_invoice_not_created") {
        return reply.code(400).send({
          error: "stripe_error",
          message: "Invoice is not properly configured in Stripe.",
        });
      }

      return reply.code(500).send({
        error: "send_failed",
        message: "Failed to send invoice. Please try again.",
      });
    }
  });

  /* ───────────────────────── Void Invoice ───────────────────────── */

  /**
   * POST /:id/void - Void an unpaid invoice
   *
   * Voids the invoice in Stripe and marks it as cancelled locally.
   */
  app.post("/:id/void", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { id } = req.params as { id: string };

    const invoiceId = parseInt(id, 10);
    if (isNaN(invoiceId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid invoice ID.",
      });
    }

    try {
      const invoice = await invoiceService.voidInvoice(invoiceId, provider.id);

      return reply.send({
        success: true,
        message: "Invoice voided successfully.",
        invoice,
      });
    } catch (err: any) {
      req.log?.error?.({ err, invoiceId, providerId: provider.id }, "Failed to void invoice");

      // Handle known errors
      if (err.message === "invoice_not_found") {
        return reply.code(404).send({
          error: "not_found",
          message: "Invoice not found.",
        });
      }

      if (err.message === "cannot_void_invoice") {
        return reply.code(400).send({
          error: "cannot_void",
          message: "This invoice cannot be voided. It may already be paid or voided.",
        });
      }

      return reply.code(500).send({
        error: "void_failed",
        message: "Failed to void invoice. Please try again.",
      });
    }
  });

  /* ───────────────────────── Get PDF URL ───────────────────────── */

  /**
   * GET /:id/pdf - Get invoice PDF URL
   *
   * Returns the current PDF download URL from Stripe.
   * Note: URLs may expire, so fetch fresh each time.
   */
  app.get("/:id/pdf", {
    preHandler: requireProvider,
  }, async (req, reply) => {
    const provider = req.marketplaceProvider!;
    const { id } = req.params as { id: string };

    const invoiceId = parseInt(id, 10);
    if (isNaN(invoiceId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid invoice ID.",
      });
    }

    try {
      const url = await invoiceService.getInvoicePdfUrl(invoiceId, provider.id);

      return reply.send({ url });
    } catch (err: any) {
      req.log?.error?.({ err, invoiceId, providerId: provider.id }, "Failed to get PDF URL");

      // Handle known errors
      if (err.message === "invoice_not_found") {
        return reply.code(404).send({
          error: "not_found",
          message: "Invoice not found.",
        });
      }

      if (err.message === "pdf_not_available") {
        return reply.code(400).send({
          error: "pdf_not_available",
          message: "PDF is not available for this invoice. It may need to be sent first.",
        });
      }

      return reply.code(500).send({
        error: "pdf_failed",
        message: "Failed to get invoice PDF.",
      });
    }
  });
}
