// src/routes/admin-subscriptions.ts
// Admin routes for managing subscriptions, products, and entitlements
//
// GET    /api/v1/admin/subscriptions          - List all subscriptions
// GET    /api/v1/admin/subscriptions/:id       - Get subscription details
// POST   /api/v1/admin/subscriptions           - Manually create subscription
// PATCH  /api/v1/admin/subscriptions/:id       - Update subscription
// DELETE /api/v1/admin/subscriptions/:id       - Cancel subscription
//
// GET    /api/v1/admin/products                - List all products
// GET    /api/v1/admin/products/:id            - Get product details
// POST   /api/v1/admin/products                - Create product
// PATCH  /api/v1/admin/products/:id            - Update product
// DELETE /api/v1/admin/products/:id            - Deactivate product
//
// GET    /api/v1/admin/products/:id/entitlements    - List product entitlements
// POST   /api/v1/admin/products/:id/entitlements    - Add entitlement to product
// PATCH  /api/v1/admin/products/:id/entitlements/:key - Update entitlement
// DELETE /api/v1/admin/products/:id/entitlements/:key - Remove entitlement
//
// POST   /api/v1/admin/test-email              - Send a test email (dev/testing)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";
import { auditSuccess } from "../services/audit.js";
import { sendEmail } from "../services/email-service.js";

/**
 * Require the current user to be a super admin.
 * Returns actor ID if authorized, or sends error response and returns null.
 */
async function requireSuperAdmin(
  req: any,
  reply: any
): Promise<string | null> {
  const actorId = getActorId(req);
  if (!actorId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { isSuperAdmin: true },
  });

  if (!actor?.isSuperAdmin) {
    reply
      .code(403)
      .send({ error: "forbidden", message: "Super admin access required" });
    return null;
  }

  return actorId;
}

const adminSubscriptionRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────── SUBSCRIPTIONS ───────────────────

  /**
   * GET /api/v1/admin/subscriptions
   *
   * List all subscriptions with filtering and pagination
   *
   * Query params:
   *   status?: TRIAL | ACTIVE | PAST_DUE | CANCELED | INCOMPLETE
   *   tenantId?: number
   *   page?: number
   *   limit?: number
   */
  app.get<{
    Querystring: {
      status?: string;
      tenantId?: string;
      page?: string;
      limit?: string;
    };
  }>("/admin/subscriptions", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const { status, tenantId, page = "1", limit = "50" } = req.query;

      const where: any = {};
      if (status) where.status = status;
      if (tenantId) where.tenantId = Number(tenantId);

      const skip = (Number(page) - 1) * Number(limit);

      const [subscriptions, total] = await Promise.all([
        prisma.subscription.findMany({
          where,
          include: {
            product: {
              select: {
                id: true,
                name: true,
                priceUSD: true,
              },
            },
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
            addOns: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.subscription.count({ where }),
      ]);

      return reply.send({
        subscriptions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list subscriptions");
      return reply.code(500).send({ error: "list_subscriptions_failed" });
    }
  });

  /**
   * GET /api/v1/admin/subscriptions/:id
   *
   * Get detailed subscription information
   */
  app.get<{ Params: { id: string } }>("/admin/subscriptions/:id", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const subscription = await prisma.subscription.findUnique({
        where: { id: Number(req.params.id) },
        include: {
          product: {
            include: {
              entitlements: true,
            },
          },
          tenant: true,
          addOns: {
            include: {
              product: {
                include: {
                  entitlements: true,
                },
              },
            },
          },
        },
      });

      if (!subscription) {
        return reply.code(404).send({ error: "subscription_not_found" });
      }

      return reply.send({ subscription });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get subscription");
      return reply.code(500).send({ error: "get_subscription_failed" });
    }
  });

  /**
   * POST /api/v1/admin/subscriptions
   *
   * Manually create a subscription for a tenant (for testing, comps, etc.)
   *
   * Body:
   * {
   *   tenantId: number,
   *   productId: number,
   *   status?: "TRIAL" | "ACTIVE",
   *   currentPeriodStart?: string (ISO),
   *   currentPeriodEnd?: string (ISO)
   * }
   */
  app.post<{
    Body: {
      tenantId: number;
      productId: number;
      status?: string;
      currentPeriodStart?: string;
      currentPeriodEnd?: string;
    };
  }>("/admin/subscriptions", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const {
        tenantId,
        productId,
        status = "ACTIVE",
        currentPeriodStart,
        currentPeriodEnd,
      } = req.body;

      // Check if product exists
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return reply.code(404).send({ error: "product_not_found" });
      }

      // Check if tenant exists
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }

      // Create subscription
      const subscription = await prisma.subscription.create({
        data: {
          tenantId,
          productId,
          status: status as any,
          currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : new Date(),
          currentPeriodEnd: currentPeriodEnd
            ? new Date(currentPeriodEnd)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          amountCents: product.priceUSD,
          billingInterval: product.billingInterval ?? "MONTHLY",
        },
        include: {
          product: true,
          tenant: true,
        },
      });

      await auditSuccess(req, "ADMIN_SUBSCRIPTION_CREATED" as any, {
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        surface: "PLATFORM",
        detail: { subscriptionId: subscription.id, forTenantId: tenantId, productId },
      });

      return reply.send({ subscription });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create subscription");
      return reply.code(500).send({ error: "create_subscription_failed" });
    }
  });

  /**
   * PATCH /api/v1/admin/subscriptions/:id
   *
   * Update subscription details
   *
   * Body:
   * {
   *   status?: string,
   *   currentPeriodEnd?: string,
   *   cancelAtPeriodEnd?: boolean
   * }
   */
  app.patch<{
    Params: { id: string };
    Body: {
      status?: string;
      currentPeriodEnd?: string;
      cancelAtPeriodEnd?: boolean;
    };
  }>("/admin/subscriptions/:id", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const { status, currentPeriodEnd, cancelAtPeriodEnd } = req.body;

      const data: any = {};
      if (status) data.status = status;
      if (currentPeriodEnd) data.currentPeriodEnd = new Date(currentPeriodEnd);
      if (cancelAtPeriodEnd !== undefined) data.cancelAtPeriodEnd = cancelAtPeriodEnd;

      const subscription = await prisma.subscription.update({
        where: { id: Number(req.params.id) },
        data,
        include: {
          product: true,
          tenant: true,
        },
      });

      await auditSuccess(req, "ADMIN_SUBSCRIPTION_UPDATED" as any, {
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        surface: "PLATFORM",
        detail: { subscriptionId: subscription.id, changes: data },
      });

      return reply.send({ subscription });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to update subscription");
      return reply.code(500).send({ error: "update_subscription_failed" });
    }
  });

  // ─────────────────── PRODUCTS ───────────────────

  /**
   * GET /api/v1/admin/products
   *
   * List all products (including inactive)
   *
   * Query params:
   *   type?: SUBSCRIPTION | ADDON
   *   active?: true | false
   */
  app.get<{
    Querystring: {
      type?: string;
      active?: string;
    };
  }>("/admin/products", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const { type, active } = req.query;

      const where: any = {};
      if (type) where.type = type;
      if (active !== undefined) where.active = active === "true";

      const products = await prisma.product.findMany({
        where,
        include: {
          entitlements: {
            orderBy: { entitlementKey: "asc" },
          },
          _count: {
            select: {
              subscriptions: true,
              addOns: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      });

      return reply.send({ products });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list products");
      return reply.code(500).send({ error: "list_products_failed" });
    }
  });

  /**
   * GET /api/v1/admin/products/:id
   *
   * Get product details with entitlements
   */
  app.get<{ Params: { id: string } }>("/admin/products/:id", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const product = await prisma.product.findUnique({
        where: { id: Number(req.params.id) },
        include: {
          entitlements: {
            orderBy: { entitlementKey: "asc" },
          },
          _count: {
            select: {
              subscriptions: true,
              addOns: true,
            },
          },
        },
      });

      if (!product) {
        return reply.code(404).send({ error: "product_not_found" });
      }

      return reply.send({ product });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get product");
      return reply.code(500).send({ error: "get_product_failed" });
    }
  });

  /**
   * POST /api/v1/admin/products
   *
   * Create a new product
   *
   * Body:
   * {
   *   name: string,
   *   description?: string,
   *   type: "SUBSCRIPTION" | "ADDON",
   *   priceUSD: number (cents),
   *   billingInterval?: "MONTHLY" | "YEARLY",
   *   features?: string[],
   *   sortOrder?: number
   * }
   */
  app.post<{
    Body: {
      name: string;
      description?: string;
      type: string;
      priceUSD: number;
      billingInterval?: string;
      features?: string[];
      sortOrder?: number;
    };
  }>("/admin/products", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const { name, description, type, priceUSD, billingInterval, features, sortOrder } =
        req.body;

      const product = await prisma.product.create({
        data: {
          name,
          description,
          type: type as any,
          priceUSD,
          billingInterval: billingInterval as any,
          features: features || [],
          sortOrder: sortOrder ?? 0,
          active: true,
        },
        include: {
          entitlements: true,
        },
      });

      await auditSuccess(req, "ADMIN_PRODUCT_CREATED" as any, {
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        surface: "PLATFORM",
        detail: { productId: product.id, name },
      });

      return reply.send({ product });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create product");
      return reply.code(500).send({ error: "create_product_failed" });
    }
  });

  /**
   * PATCH /api/v1/admin/products/:id
   *
   * Update product details
   */
  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      priceUSD?: number;
      features?: string[];
      active?: boolean;
      sortOrder?: number;
    };
  }>("/admin/products/:id", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const product = await prisma.product.update({
        where: { id: Number(req.params.id) },
        data: req.body,
        include: {
          entitlements: true,
        },
      });

      await auditSuccess(req, "ADMIN_PRODUCT_UPDATED" as any, {
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        surface: "PLATFORM",
        detail: { productId: product.id, changes: req.body },
      });

      return reply.send({ product });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to update product");
      return reply.code(500).send({ error: "update_product_failed" });
    }
  });

  // ─────────────────── ENTITLEMENTS ───────────────────

  /**
   * POST /api/v1/admin/products/:id/entitlements
   *
   * Add an entitlement to a product
   *
   * Body:
   * {
   *   entitlementKey: string,
   *   limitValue: number | null (null = unlimited)
   * }
   */
  app.post<{
    Params: { id: string };
    Body: {
      entitlementKey: string;
      limitValue: number | null;
    };
  }>("/admin/products/:id/entitlements", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const { entitlementKey, limitValue } = req.body;

      const entitlement = await prisma.productEntitlement.create({
        data: {
          productId: Number(req.params.id),
          entitlementKey: entitlementKey as any,
          limitValue,
        },
      });

      await auditSuccess(req, "ADMIN_ENTITLEMENT_CREATED" as any, {
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        surface: "PLATFORM",
        detail: { productId: Number(req.params.id), entitlementKey, limitValue },
      });

      return reply.send({ entitlement });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create entitlement");
      return reply.code(500).send({ error: "create_entitlement_failed" });
    }
  });

  /**
   * PATCH /api/v1/admin/products/:id/entitlements/:key
   *
   * Update an entitlement's limit
   *
   * Body:
   * {
   *   limitValue: number | null
   * }
   */
  app.patch<{
    Params: { id: string; key: string };
    Body: {
      limitValue: number | null;
    };
  }>("/admin/products/:id/entitlements/:key", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const { limitValue } = req.body;

      const entitlement = await prisma.productEntitlement.updateMany({
        where: {
          productId: Number(req.params.id),
          entitlementKey: req.params.key as any,
        },
        data: {
          limitValue,
        },
      });

      await auditSuccess(req, "ADMIN_ENTITLEMENT_UPDATED" as any, {
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        surface: "PLATFORM",
        detail: {
          productId: Number(req.params.id),
          entitlementKey: req.params.key,
          limitValue,
        },
      });

      return reply.send({ success: true, updated: entitlement.count });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to update entitlement");
      return reply.code(500).send({ error: "update_entitlement_failed" });
    }
  });

  /**
   * DELETE /api/v1/admin/products/:id/entitlements/:key
   *
   * Remove an entitlement from a product
   */
  app.delete<{
    Params: { id: string; key: string };
  }>("/admin/products/:id/entitlements/:key", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      await prisma.productEntitlement.deleteMany({
        where: {
          productId: Number(req.params.id),
          entitlementKey: req.params.key as any,
        },
      });

      await auditSuccess(req, "ADMIN_ENTITLEMENT_DELETED" as any, {
        userId: (req as any).userId,
        tenantId: (req as any).tenantId,
        surface: "PLATFORM",
        detail: { productId: Number(req.params.id), entitlementKey: req.params.key },
      });

      return reply.send({ success: true });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to delete entitlement");
      return reply.code(500).send({ error: "delete_entitlement_failed" });
    }
  });

  // ─────────────────── TEST EMAIL ───────────────────

  /**
   * POST /api/v1/admin/test-email
   *
   * Send a test email to verify email configuration.
   * In dev mode, this will respect EMAIL_DEV_REDIRECT/EMAIL_DEV_LOG_ONLY settings.
   *
   * Body:
   * {
   *   to?: string (defaults to current user's email)
   * }
   */
  app.post<{
    Body: {
      to?: string;
    };
  }>("/admin/test-email", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const tenantId = Number((req as any).tenantId);
      const userId = (req as any).userId;

      // Get recipient - use provided email or fall back to current user's email
      let recipientEmail = req.body?.to;

      if (!recipientEmail && userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        recipientEmail = user?.email;
      }

      if (!recipientEmail) {
        return reply.code(400).send({ error: "missing_recipient", message: "Provide 'to' in body or ensure you're logged in" });
      }

      const result = await sendEmail({
        tenantId: tenantId || 1,
        to: recipientEmail,
        subject: "BreederHQ Test Email",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Test Email from BreederHQ</h1>
            <p>This is a test email to verify your email configuration is working correctly.</p>
            <p style="background: #f3f4f6; padding: 12px; border-radius: 6px;">
              <strong>Timestamp:</strong> ${new Date().toISOString()}<br>
              <strong>Environment:</strong> ${process.env.NODE_ENV || "development"}<br>
              <strong>From:</strong> ${process.env.RESEND_FROM_EMAIL || "not configured"}
            </p>
            <p style="color: #6b7280; font-size: 14px;">If you received this email, your email setup is working!</p>
          </div>
        `,
        category: "transactional",
        metadata: { test: true, initiatedBy: userId },
      });

      if (result.ok) {
        return reply.send({
          success: true,
          message: result.skipped
            ? "Email logged (dev mode - not actually sent)"
            : "Test email sent successfully",
          providerMessageId: result.providerMessageId,
          skipped: result.skipped,
        });
      } else {
        return reply.code(500).send({
          success: false,
          error: result.error,
          message: "Failed to send test email",
        });
      }
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to send test email");
      return reply.code(500).send({ error: "test_email_failed", message: err.message });
    }
  });
};

export default adminSubscriptionRoutes;
