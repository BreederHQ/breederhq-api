/**
 * Stripe Service
 *
 * Handles all Stripe API interactions for subscription management.
 */

import Stripe from "stripe";
import prisma from "../prisma.js";

// Initialize Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});

/**
 * Get or create a Stripe customer for a tenant
 *
 * @param tenantId - The tenant ID
 * @param email - Customer email (usually org owner email)
 * @param name - Customer name (usually org name)
 * @returns Stripe customer ID
 */
export async function getOrCreateStripeCustomer(
  tenantId: number,
  email: string,
  name: string
): Promise<string> {
  // Check if tenant already has a Stripe customer ID
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true } as any,
  }) as any;

  if (tenant?.stripeCustomerId) {
    return tenant.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      tenantId: tenantId.toString(),
    },
  });

  // Store customer ID in database
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { stripeCustomerId: customer.id } as any,
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout Session for subscription
 *
 * @param tenantId - The tenant ID
 * @param productId - The product ID to subscribe to
 * @param successUrl - URL to redirect to on success
 * @param cancelUrl - URL to redirect to on cancel
 * @returns Checkout session URL
 */
export async function createCheckoutSession(
  tenantId: number,
  productId: number,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  // Get product details
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      stripePriceId: true,
      type: true,
    },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  if (!product.stripePriceId) {
    throw new Error("Product does not have a Stripe price ID configured");
  }

  if (product.type !== "SUBSCRIPTION") {
    throw new Error("Product is not a subscription");
  }

  // Get tenant info for customer creation
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      stripeCustomerId: true,
      organizations: {
        take: 1,
        select: {
          party: {
            select: { email: true },
          },
        },
      },
    } as any,
  }) as any;

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const email = tenant.organizations[0]?.party?.email || "";
  const customerId = tenant.stripeCustomerId || await getOrCreateStripeCustomer(
    tenantId,
    email,
    tenant.name
  );

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: product.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        tenantId: tenantId.toString(),
        productId: productId.toString(),
      },
    },
    metadata: {
      tenantId: tenantId.toString(),
      productId: productId.toString(),
    },
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return session.url;
}

/**
 * Create a Stripe Customer Portal session
 *
 * @param tenantId - The tenant ID
 * @param returnUrl - URL to return to after managing subscription
 * @returns Portal session URL
 */
export async function createCustomerPortalSession(
  tenantId: number,
  returnUrl: string
): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true } as any,
  }) as any;

  if (!tenant?.stripeCustomerId) {
    throw new Error("No Stripe customer found for this tenant");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Add an add-on to an existing subscription
 *
 * @param subscriptionId - The subscription ID (internal)
 * @param addOnProductId - The add-on product ID
 * @returns Updated subscription
 */
export async function addSubscriptionAddOn(
  subscriptionId: number,
  addOnProductId: number
) {
  // Get subscription with Stripe subscription ID
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      stripeSubscriptionId: true,
      tenantId: true,
    },
  });

  if (!subscription?.stripeSubscriptionId) {
    throw new Error("Subscription not found or not linked to Stripe");
  }

  // Get add-on product
  const addOnProduct = await prisma.product.findUnique({
    where: { id: addOnProductId },
    select: {
      name: true,
      stripePriceId: true,
      type: true,
      priceUSD: true,
    },
  });

  if (!addOnProduct) {
    throw new Error("Add-on product not found");
  }

  if (addOnProduct.type !== "ADD_ON") {
    throw new Error("Product is not an add-on");
  }

  if (!addOnProduct.stripePriceId) {
    throw new Error("Add-on does not have a Stripe price ID");
  }

  // Add the item to the Stripe subscription
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.stripeSubscriptionId
  );

  await stripe.subscriptionItems.create({
    subscription: stripeSubscription.id,
    price: addOnProduct.stripePriceId,
    quantity: 1,
  });

  // Record in database
  await prisma.subscriptionAddOn.create({
    data: {
      subscriptionId,
      productId: addOnProductId,
      quantity: 1,
      amountCents: addOnProduct.priceUSD,
    },
  });

  return { success: true };
}

/**
 * Cancel a subscription
 *
 * @param subscriptionId - The subscription ID (internal)
 * @param cancelAtPeriodEnd - Whether to cancel at period end or immediately
 */
export async function cancelSubscription(
  subscriptionId: number,
  cancelAtPeriodEnd: boolean = true
) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { stripeSubscriptionId: true },
  });

  if (!subscription?.stripeSubscriptionId) {
    throw new Error("Subscription not found or not linked to Stripe");
  }

  if (cancelAtPeriodEnd) {
    // Schedule cancellation at period end
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update local record - keep ACTIVE but mark canceledAt
    // Webhook will update to CANCELED when actually canceled
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        canceledAt: new Date(),
      },
    });
  } else {
    // Cancel immediately
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

    // Update local record
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
      },
    });
  }

  return { success: true };
}

/**
 * Sync subscription from Stripe to local database
 *
 * @param stripeSubscriptionId - The Stripe subscription ID
 */
export async function syncSubscriptionFromStripe(
  stripeSubscriptionId: string
): Promise<void> {
  const stripeSubscription = await stripe.subscriptions.retrieve(
    stripeSubscriptionId,
    { expand: ["items.data.price.product"] }
  ) as any;

  const tenantId = parseInt(stripeSubscription.metadata.tenantId || "0");
  if (!tenantId) {
    throw new Error("Subscription missing tenantId in metadata");
  }

  // Get product by Stripe price ID
  const stripePriceId = stripeSubscription.items.data[0]?.price.id;
  const product = await prisma.product.findFirst({
    where: { stripePriceId },
  });

  if (!product) {
    throw new Error(`Product not found for Stripe price ID: ${stripePriceId}`);
  }

  // Map Stripe status to our status
  let status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" = "ACTIVE";
  if (stripeSubscription.status === "trialing") status = "TRIAL";
  else if (stripeSubscription.status === "past_due") status = "PAST_DUE";
  else if (stripeSubscription.status === "canceled") status = "CANCELED";
  else if (stripeSubscription.status === "incomplete") status = "INCOMPLETE";
  // If cancel_at_period_end is true, keep status as ACTIVE but canceledAt will be set

  // Upsert subscription
  await prisma.subscription.upsert({
    where: {
      stripeSubscriptionId: stripeSubscription.id,
    },
    create: {
      tenantId,
      productId: product.id,
      stripeSubscriptionId: stripeSubscription.id,
      status,
      amountCents: (stripeSubscription.items.data[0]?.price.unit_amount || 0),
      currency: (stripeSubscription.currency || "USD").toUpperCase(),
      billingInterval: stripeSubscription.items.data[0]?.price.recurring?.interval === "year"
        ? "YEARLY"
        : "MONTHLY",
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      canceledAt: stripeSubscription.canceled_at
        ? new Date(stripeSubscription.canceled_at * 1000)
        : null,
    },
    update: {
      status,
      amountCents: (stripeSubscription.items.data[0]?.price.unit_amount || 0),
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      canceledAt: stripeSubscription.canceled_at
        ? new Date(stripeSubscription.canceled_at * 1000)
        : null,
    },
  });
}
