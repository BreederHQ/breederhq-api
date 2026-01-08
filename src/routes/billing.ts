// src/routes/billing.ts
// Billing and subscription management routes
//
// POST /api/v1/billing/checkout           - Create Stripe checkout session
// POST /api/v1/billing/portal              - Create Stripe customer portal session
// POST /api/v1/billing/add-ons             - Add an add-on to subscription
// POST /api/v1/billing/cancel              - Cancel subscription
// POST /api/v1/billing/webhooks/stripe     - Stripe webhook endpoint (public)
// GET  /api/v1/billing/subscription        - Get current subscription details

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  createCheckoutSession,
  createCustomerPortalSession,
  addSubscriptionAddOn,
  cancelSubscription,
  syncSubscriptionFromStripe,
  stripe,
} from "../services/stripe-service.js";
import prisma from "../prisma.js";
import { auditSuccess } from "../services/audit.js";
import {
  sendPaymentFailedEmail,
  sendSubscriptionCanceledEmail,
  sendSubscriptionRenewedEmail,
} from "../services/email-service.js";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const billingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /api/v1/billing/checkout
   *
   * Creates a Stripe Checkout session for subscribing to a plan.
   *
   * Body:
   * {
   *   productId: number,
   *   successUrl: string,
   *   cancelUrl: string
   * }
   *
   * Response:
   * {
   *   checkoutUrl: string
   * }
   */
  app.post<{
    Body: {
      productId: number;
      successUrl: string;
      cancelUrl: string;
    };
  }>("/billing/checkout", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const { productId, successUrl, cancelUrl } = req.body;

      if (!productId || !successUrl || !cancelUrl) {
        return reply.code(400).send({ error: "missing_required_fields" });
      }

      const checkoutUrl = await createCheckoutSession(
        tenantId,
        productId,
        successUrl,
        cancelUrl
      );

      await auditSuccess(req, "BILLING_CHECKOUT_CREATED" as any, {
        userId: (req as any).userId,
        tenantId,
        surface: "PLATFORM",
        detail: { productId, checkoutUrl },
      });

      return reply.send({ checkoutUrl });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create checkout session");
      return reply.code(500).send({ error: "checkout_failed", detail: err.message });
    }
  });

  /**
   * POST /api/v1/billing/portal
   *
   * Creates a Stripe Customer Portal session for managing subscription.
   *
   * Body:
   * {
   *   returnUrl: string
   * }
   *
   * Response:
   * {
   *   portalUrl: string
   * }
   */
  app.post<{ Body: { returnUrl: string } }>("/billing/portal", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const { returnUrl } = req.body;

      if (!returnUrl) {
        return reply.code(400).send({ error: "missing_return_url" });
      }

      const portalUrl = await createCustomerPortalSession(tenantId, returnUrl);

      await auditSuccess(req, "BILLING_PORTAL_ACCESSED" as any, {
        userId: (req as any).userId,
        tenantId,
        surface: "PLATFORM",
        detail: { returnUrl },
      });

      return reply.send({ portalUrl });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create portal session");
      return reply.code(500).send({ error: "portal_failed", detail: err.message });
    }
  });

  /**
   * POST /api/v1/billing/add-ons
   *
   * Adds an add-on to the current subscription.
   *
   * Body:
   * {
   *   addOnProductId: number
   * }
   *
   * Response:
   * {
   *   success: true
   * }
   */
  app.post<{ Body: { addOnProductId: number } }>(
    "/billing/add-ons",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        if (!tenantId) {
          return reply.code(400).send({ error: "missing_tenant" });
        }

        const { addOnProductId } = req.body;

        if (!addOnProductId) {
          return reply.code(400).send({ error: "missing_addon_product_id" });
        }

        // Get current subscription
        const subscription = await prisma.subscription.findFirst({
          where: {
            tenantId,
            status: { in: ["ACTIVE", "TRIAL"] },
          },
        });

        if (!subscription) {
          return reply.code(404).send({ error: "no_active_subscription" });
        }

        const result = await addSubscriptionAddOn(subscription.id, addOnProductId);

        await auditSuccess(req, "BILLING_ADDON_ADDED" as any, {
          userId: (req as any).userId,
          tenantId,
          surface: "PLATFORM",
          detail: { addOnProductId, subscriptionId: subscription.id },
        });

        return reply.send(result);
      } catch (err: any) {
        req.log?.error?.({ err }, "Failed to add add-on");
        return reply.code(500).send({ error: "addon_failed", detail: err.message });
      }
    }
  );

  /**
   * POST /api/v1/billing/cancel
   *
   * Cancels the current subscription.
   *
   * Body:
   * {
   *   cancelAtPeriodEnd?: boolean (default: true)
   * }
   *
   * Response:
   * {
   *   success: true
   * }
   */
  app.post<{ Body: { cancelAtPeriodEnd?: boolean } }>(
    "/billing/cancel",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        if (!tenantId) {
          return reply.code(400).send({ error: "missing_tenant" });
        }

        const { cancelAtPeriodEnd = true } = req.body || {};

        // Get current subscription
        const subscription = await prisma.subscription.findFirst({
          where: {
            tenantId,
            status: { in: ["ACTIVE", "TRIAL", "PAST_DUE"] },
          },
        });

        if (!subscription) {
          return reply.code(404).send({ error: "no_active_subscription" });
        }

        const result = await cancelSubscription(subscription.id, cancelAtPeriodEnd);

        await auditSuccess(req, "BILLING_SUBSCRIPTION_CANCELED" as any, {
          userId: (req as any).userId,
          tenantId,
          surface: "PLATFORM",
          detail: { subscriptionId: subscription.id, cancelAtPeriodEnd },
        });

        return reply.send(result);
      } catch (err: any) {
        req.log?.error?.({ err }, "Failed to cancel subscription");
        return reply.code(500).send({ error: "cancel_failed", detail: err.message });
      }
    }
  );

  /**
   * GET /api/v1/billing/subscription
   *
   * Gets the current subscription details for the tenant.
   *
   * Response:
   * {
   *   subscription: {
   *     id: number,
   *     status: string,
   *     product: { name: string, features: string[] },
   *     currentPeriodStart: string,
   *     currentPeriodEnd: string,
   *     canceledAt: string | null,
   *     addOns: []
   *   }
   * }
   */
  app.get("/billing/subscription", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const subscription = await prisma.subscription.findFirst({
        where: {
          tenantId,
          status: { in: ["ACTIVE", "TRIAL", "PAST_DUE", "CANCELED"] },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              features: true,
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
      });

      if (!subscription) {
        return reply.code(404).send({ error: "no_subscription" });
      }

      return reply.send({
        subscription: {
          id: subscription.id,
          status: subscription.status,
          product: subscription.product,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          canceledAt: subscription.canceledAt,
          addOns: subscription.addOns.map((addOn) => ({
            id: addOn.id,
            product: addOn.product,
            quantity: addOn.quantity,
          })),
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get subscription");
      return reply.code(500).send({ error: "get_subscription_failed" });
    }
  });

  /**
   * GET /api/v1/billing/plans
   *
   * Gets all available subscription plans
   *
   * Response:
   * {
   *   plans: Array<{
   *     id: number,
   *     name: string,
   *     description: string,
   *     priceMonthly: number,
   *     priceYearly: number,
   *     tier: string,
   *     features: string[],
   *     quotas: object
   *   }>
   * }
   */
  app.get("/billing/plans", async (req, reply) => {
    try {
      const plans = await prisma.product.findMany({
        where: {
          type: "SUBSCRIPTION",
          active: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          id: true,
          name: true,
          description: true,
          priceUSD: true,
          billingInterval: true,
          features: true,
          stripePriceId: true,
          entitlements: {
            select: {
              entitlementKey: true,
              limitValue: true,
            },
          },
        },
      });

      // Transform entitlements into a quotas object and convert price from cents to dollars
      const formattedPlans = plans.map((plan) => {
        const quotas: Record<string, number | null> = {};
        plan.entitlements.forEach((ent) => {
          quotas[ent.entitlementKey] = ent.limitValue;
        });

        // Convert priceUSD from cents to dollars
        const priceMonthly = plan.priceUSD / 100;
        const priceYearly = plan.billingInterval === "YEARLY" ? plan.priceUSD / 100 : priceMonthly * 10;

        return {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          priceMonthly,
          priceYearly,
          tier: plan.name.toUpperCase(), // Use name as tier for now
          features: Array.isArray(plan.features) ? plan.features : [],
          quotas,
          stripePriceId: plan.stripePriceId,
          stripeYearlyPriceId: null, // Not in schema yet
        };
      });

      return reply.send({ plans: formattedPlans });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get plans");
      return reply.code(500).send({ error: "get_plans_failed" });
    }
  });

  /**
   * POST /api/v1/billing/webhooks/stripe
   *
   * Stripe webhook endpoint for receiving subscription events.
   * This endpoint is PUBLIC (no auth required) and verified using Stripe signature.
   *
   * Events handled:
   * - checkout.session.completed
   * - customer.subscription.created
   * - customer.subscription.updated
   * - customer.subscription.deleted
   * - invoice.payment_succeeded
   * - invoice.payment_failed
   */
  app.post(
    "/billing/webhooks/stripe",
    {
      config: {
        // Allow raw body for Stripe signature verification
        rawBody: true,
      },
    },
    async (req, reply) => {
      try {
        const signature = req.headers["stripe-signature"];

        if (!signature || !STRIPE_WEBHOOK_SECRET) {
          req.log.warn("Missing Stripe signature or webhook secret");
          return reply.code(400).send({ error: "missing_signature" });
        }

        // Verify webhook signature
        let event;
        try {
          event = stripe.webhooks.constructEvent(
            (req as any).rawBody as Buffer,
            signature as string,
            STRIPE_WEBHOOK_SECRET
          );
        } catch (err: any) {
          req.log.error({ err }, "Webhook signature verification failed");
          return reply.code(400).send({ error: "invalid_signature" });
        }

        req.log.info({ type: event.type, id: event.id }, "Stripe webhook received");

        // Handle different event types
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as any;
            if (session.mode === "subscription" && session.subscription) {
              await syncSubscriptionFromStripe(session.subscription);
              req.log.info(
                { subscriptionId: session.subscription },
                "Subscription created from checkout"
              );
            }
            break;
          }

          case "customer.subscription.created":
          case "customer.subscription.updated": {
            const subscription = event.data.object as any;
            await syncSubscriptionFromStripe(subscription.id);
            req.log.info({ subscriptionId: subscription.id }, "Subscription synced");
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as any;
            const dbSubscription = await prisma.subscription.findFirst({
              where: { stripeSubscriptionId: subscription.id },
              include: { product: true },
            });

            await prisma.subscription.updateMany({
              where: { stripeSubscriptionId: subscription.id },
              data: {
                status: "CANCELED",
                canceledAt: new Date(),
              },
            });

            // Send cancellation email
            if (dbSubscription && dbSubscription.currentPeriodEnd) {
              try {
                await sendSubscriptionCanceledEmail(
                  dbSubscription.tenantId,
                  dbSubscription.product.name,
                  dbSubscription.currentPeriodEnd
                );
              } catch (err) {
                req.log.error({ err }, "Failed to send subscription canceled email");
              }
            }

            req.log.info({ subscriptionId: subscription.id }, "Subscription canceled");
            break;
          }

          case "invoice.payment_succeeded": {
            const invoice = event.data.object as any;
            if (invoice.subscription) {
              await syncSubscriptionFromStripe(invoice.subscription);

              // Send renewal email (skip for first invoice)
              if (invoice.billing_reason === "subscription_cycle") {
                const dbSubscription = await prisma.subscription.findFirst({
                  where: { stripeSubscriptionId: invoice.subscription },
                  include: { product: true },
                });

                if (dbSubscription && dbSubscription.currentPeriodEnd) {
                  try {
                    await sendSubscriptionRenewedEmail(
                      dbSubscription.tenantId,
                      dbSubscription.product.name,
                      dbSubscription.currentPeriodEnd,
                      invoice.amount_paid / 100, // Convert cents to dollars
                      invoice.hosted_invoice_url || undefined
                    );
                  } catch (err) {
                    req.log.error({ err }, "Failed to send subscription renewed email");
                  }
                }
              }

              req.log.info(
                { subscriptionId: invoice.subscription },
                "Payment succeeded, subscription synced"
              );
            }
            break;
          }

          case "invoice.payment_failed": {
            const invoice = event.data.object as any;
            if (invoice.subscription) {
              const dbSubscription = await prisma.subscription.findFirst({
                where: { stripeSubscriptionId: invoice.subscription },
                include: { product: true },
              });

              await prisma.subscription.updateMany({
                where: { stripeSubscriptionId: invoice.subscription },
                data: { status: "PAST_DUE" },
              });

              // Send payment failed email
              if (dbSubscription) {
                try {
                  await sendPaymentFailedEmail(
                    dbSubscription.tenantId,
                    dbSubscription.product.name,
                    invoice.amount_due / 100, // Convert cents to dollars
                    invoice.hosted_invoice_url,
                    invoice.next_payment_attempt
                      ? new Date(invoice.next_payment_attempt * 1000)
                      : undefined
                  );
                } catch (err) {
                  req.log.error({ err }, "Failed to send payment failed email");
                }
              }

              req.log.warn(
                { subscriptionId: invoice.subscription },
                "Payment failed, subscription marked past due"
              );
            }
            break;
          }

          default:
            req.log.info({ type: event.type }, "Unhandled webhook event type");
        }

        return reply.send({ received: true });
      } catch (err: any) {
        req.log?.error?.({ err }, "Webhook processing failed");
        return reply.code(500).send({ error: "webhook_failed" });
      }
    }
  );
};

export default billingRoutes;
