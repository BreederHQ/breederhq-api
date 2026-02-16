// src/services/listing-payment-service.ts
/**
 * Listing Payment Service
 *
 * Business logic for service provider listing subscriptions.
 * Handles payment gating, Stripe Checkout creation, webhook processing,
 * and founding provider management.
 *
 * NOTE: Several Prisma calls use `as any` casts because the new schema fields
 * (stripeSubscriptionId, isFounding, etc.) are not yet in the generated
 * Prisma client until `prisma migrate dev` runs. Once the migration is applied
 * and `prisma generate` runs, these casts can be removed.
 */

import prisma from "../prisma.js";
import { getStripe } from "./stripe-service.js";
import type { Prisma } from "@prisma/client";
import {
  sendListingActivatedEmail,
  sendListingRenewedEmail,
  sendListingPaymentFailedEmail,
  sendListingCanceledEmail,
} from "./listing-payment-emails.js";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface MarketplaceListingPaymentSettings {
  enabled: boolean;
  listingFeeCents: number;
  listingDurationDays: number;
  foundingFreeUntil: string | null;
  foundingWindowEnd: string | null;
  stripePriceId: string;
  stripeProductId: string;
  featuredUpgradeEnabled: boolean;
  featuredUpgradeFeeCents: number;
  featuredStripePriceId: string | null;
}

export interface PaymentRequirement {
  required: boolean;
  reason: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const LISTING_PAYMENT_NAMESPACE = "marketplace-listing-payments";

const DEFAULT_SETTINGS: MarketplaceListingPaymentSettings = {
  enabled: false,
  listingFeeCents: 499,
  listingDurationDays: 30,
  foundingFreeUntil: null,
  foundingWindowEnd: null,
  stripePriceId: "",
  stripeProductId: "",
  featuredUpgradeEnabled: false,
  featuredUpgradeFeeCents: 499,
  featuredStripePriceId: null,
};

// ────────────────────────────────────────────────────────────────────────────
// Settings
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get listing payment settings from PlatformSetting.
 * Falls back to defaults if not yet seeded.
 */
export async function getListingPaymentSettings(): Promise<MarketplaceListingPaymentSettings> {
  const setting = await prisma.platformSetting.findUnique({
    where: { namespace: LISTING_PAYMENT_NAMESPACE },
  });

  if (!setting) {
    return DEFAULT_SETTINGS;
  }

  const data = setting.data as Partial<MarketplaceListingPaymentSettings>;
  return {
    enabled: data.enabled ?? DEFAULT_SETTINGS.enabled,
    listingFeeCents: data.listingFeeCents ?? DEFAULT_SETTINGS.listingFeeCents,
    listingDurationDays: data.listingDurationDays ?? DEFAULT_SETTINGS.listingDurationDays,
    foundingFreeUntil: data.foundingFreeUntil ?? DEFAULT_SETTINGS.foundingFreeUntil,
    foundingWindowEnd: data.foundingWindowEnd ?? DEFAULT_SETTINGS.foundingWindowEnd,
    stripePriceId: data.stripePriceId ?? DEFAULT_SETTINGS.stripePriceId,
    stripeProductId: data.stripeProductId ?? DEFAULT_SETTINGS.stripeProductId,
    featuredUpgradeEnabled: data.featuredUpgradeEnabled ?? DEFAULT_SETTINGS.featuredUpgradeEnabled,
    featuredUpgradeFeeCents: data.featuredUpgradeFeeCents ?? DEFAULT_SETTINGS.featuredUpgradeFeeCents,
    featuredStripePriceId: data.featuredStripePriceId ?? DEFAULT_SETTINGS.featuredStripePriceId,
  };
}

/**
 * Update listing payment settings (admin use).
 */
export async function updateListingPaymentSettings(
  updates: Partial<MarketplaceListingPaymentSettings>
): Promise<MarketplaceListingPaymentSettings> {
  const current = await getListingPaymentSettings();
  const newSettings: MarketplaceListingPaymentSettings = { ...current, ...updates };

  await prisma.platformSetting.upsert({
    where: { namespace: LISTING_PAYMENT_NAMESPACE },
    create: {
      namespace: LISTING_PAYMENT_NAMESPACE,
      data: newSettings as unknown as Prisma.InputJsonValue,
    },
    update: {
      data: newSettings as unknown as Prisma.InputJsonValue,
    },
  });

  return newSettings;
}

// ────────────────────────────────────────────────────────────────────────────
// Payment Requirement Check
// ────────────────────────────────────────────────────────────────────────────

/**
 * Check whether a listing requires payment to be published.
 *
 * Returns `{ required: false }` when:
 *  - Payments are not enabled (EA mode)
 *  - The provider is a founding provider within the free period
 *  - The listing already has an active Stripe subscription
 */
export async function requiresPayment(
  listingId: number,
  providerId?: number | null,
  tenantId?: number | null
): Promise<PaymentRequirement> {
  const settings = await getListingPaymentSettings();

  // EA mode — no payments required
  if (!settings.enabled) {
    return { required: false, reason: "payments_not_enabled" };
  }

  // Check founding provider free period
  const now = new Date();
  if (settings.foundingFreeUntil) {
    const freeUntil = new Date(settings.foundingFreeUntil);
    if (now < freeUntil) {
      const isFounder = await isFoundingProvider(providerId, tenantId);
      if (isFounder) {
        return { required: false, reason: "founding_provider_free_period" };
      }
    }
  }

  // Check if listing already has an active subscription
  const listing = await prisma.mktListingBreederService.findUnique({
    where: { id: listingId },
    select: { stripeSubscriptionStatus: true } as any,
  }) as any;
  if (listing?.stripeSubscriptionStatus === "active") {
    return { required: false, reason: "subscription_active" };
  }

  return { required: true, reason: "payment_required" };
}

// ────────────────────────────────────────────────────────────────────────────
// Founding Provider
// ────────────────────────────────────────────────────────────────────────────

/**
 * Check if a provider/tenant is a founding provider.
 * A founding provider is one who has at least one listing marked as founding.
 */
export async function isFoundingProvider(
  providerId?: number | null,
  tenantId?: number | null
): Promise<boolean> {
  // Must have at least one qualifying filter
  if (!providerId && !tenantId) return false;

  const where: Record<string, unknown> = { isFounding: true };
  if (providerId) where.providerId = providerId;
  if (tenantId) where.tenantId = tenantId;

  const firstListing = await prisma.mktListingBreederService.findFirst({
    where: where as any,
    select: { id: true },
  });
  return !!firstListing;
}

/**
 * Determine if a listing being published now should be marked as founding.
 * True when payments are disabled (EA mode) or within the founding window.
 */
export async function shouldMarkAsFounding(): Promise<boolean> {
  const settings = await getListingPaymentSettings();

  if (!settings.enabled) return true;

  if (settings.foundingWindowEnd) {
    return new Date() < new Date(settings.foundingWindowEnd);
  }

  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Stripe Customer Resolution
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get or create a Stripe customer for a listing owner.
 * Checks marketplace user (for providers) or billing account (for tenants).
 */
async function getOrCreateListingCustomer(
  providerId: number | null,
  tenantId: number | null,
  customerEmail: string
): Promise<string> {
  // Provider path — check MarketplaceUser.stripeCustomerId
  if (providerId) {
    const provider = await prisma.marketplaceProvider.findUnique({
      where: { id: providerId },
      include: { user: { select: { id: true, stripeCustomerId: true, email: true } } },
    });

    if (provider?.user?.stripeCustomerId) {
      return provider.user.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await getStripe().customers.create({
      email: customerEmail || provider?.user?.email || "",
      metadata: {
        type: "marketplace_provider",
        providerId: String(providerId),
      },
    });

    // Store on marketplace user
    if (provider?.user) {
      await prisma.marketplaceUser.update({
        where: { id: provider.user.id },
        data: { stripeCustomerId: customer.id },
      });
    }

    return customer.id;
  }

  // Tenant path — check BillingAccount.stripeCustomerId
  if (tenantId) {
    const billing = await prisma.billingAccount.findUnique({
      where: { tenantId },
      select: { stripeCustomerId: true },
    });

    if (billing?.stripeCustomerId) {
      return billing.stripeCustomerId;
    }

    // Fall back to tenant-level customer creation
    const { getOrCreateStripeCustomer } = await import("./stripe-service.js");
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        organizations: {
          take: 1,
          select: { party: { select: { email: true } } },
        },
      } as any,
    }) as any;

    const email = customerEmail || tenant?.organizations?.[0]?.party?.email || "";
    return getOrCreateStripeCustomer(tenantId, email, tenant?.name || "");
  }

  throw new Error("Either providerId or tenantId is required");
}

// ────────────────────────────────────────────────────────────────────────────
// Checkout
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout session for a listing subscription.
 * Returns the checkout URL for the user to be redirected to.
 */
export async function createListingCheckoutSession(
  listingId: number,
  providerId: number | null,
  tenantId: number | null,
  customerEmail: string,
  returnUrl: string
): Promise<string> {
  const settings = await getListingPaymentSettings();

  if (!settings.stripePriceId) {
    throw new Error("Stripe Price ID not configured for listing payments");
  }

  const customerId = await getOrCreateListingCustomer(providerId, tenantId, customerEmail);

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: settings.stripePriceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: {
        type: "service_listing_subscription",
        listingId: String(listingId),
        providerId: providerId ? String(providerId) : "",
        tenantId: tenantId ? String(tenantId) : "",
      },
    },
    metadata: {
      type: "service_listing_subscription",
      listingId: String(listingId),
      providerId: providerId ? String(providerId) : "",
      tenantId: tenantId ? String(tenantId) : "",
    },
    success_url: `${returnUrl}?payment=success&listing=${listingId}`,
    cancel_url: `${returnUrl}?payment=cancelled&listing=${listingId}`,
  });

  if (!session.url) {
    throw new Error("Failed to create Stripe checkout session URL");
  }

  return session.url;
}

// ────────────────────────────────────────────────────────────────────────────
// Email Helper
// ────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the owner email for a listing (provider user email or tenant org email).
 * Returns null if no email can be found (email sending is best-effort).
 */
async function resolveOwnerEmail(
  listingId: number
): Promise<{ email: string; name: string; title: string } | null> {
  const listing = await prisma.mktListingBreederService.findUnique({
    where: { id: listingId },
    select: {
      title: true,
      providerId: true,
      tenantId: true,
      provider: {
        select: {
          businessName: true,
          user: { select: { email: true, firstName: true } },
        },
      },
    } as any,
  }) as any;

  if (!listing) return null;

  // Provider path
  if (listing.providerId && listing.provider?.user?.email) {
    return {
      email: listing.provider.user.email,
      name: listing.provider.user.firstName || listing.provider.businessName || "there",
      title: listing.title,
    };
  }

  // Tenant path
  if (listing.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: listing.tenantId },
      select: {
        name: true,
        organizations: {
          take: 1,
          select: { party: { select: { email: true } } },
        },
      } as any,
    }) as any;
    const email = tenant?.organizations?.[0]?.party?.email;
    if (email) {
      return { email, name: tenant.name || "there", title: listing.title };
    }
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Webhook Handlers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Handle a listing subscription being activated after successful checkout.
 * Sets the listing to LIVE with subscription details.
 */
export async function handleListingSubscriptionActivated(
  subscriptionId: string,
  metadata: Record<string, string>
): Promise<void> {
  const listingId = parseInt(metadata.listingId, 10);
  if (!listingId) return;

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const settings = await getListingPaymentSettings();

  await prisma.mktListingBreederService.update({
    where: { id: listingId },
    data: {
      status: "LIVE",
      publishedAt: new Date(),
      paidAt: new Date(),
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionStatus: subscription.status,
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      expiresAt: new Date((subscription as any).current_period_end * 1000),
    } as any,
  });

  // Send activation email (best-effort — don't throw on failure)
  try {
    const owner = await resolveOwnerEmail(listingId);
    if (owner) {
      await sendListingActivatedEmail({
        email: owner.email,
        recipientName: owner.name,
        listingTitle: owner.title,
        listingId,
        feeCents: settings.listingFeeCents,
      });
    }
  } catch (err: any) {
    console.error(`[listing-payment] Activation email failed for listing ${listingId}:`, err.message);
  }
}

/**
 * Handle a listing subscription being renewed (invoice paid).
 * Extends the current period end and expiry date.
 */
export async function handleListingSubscriptionRenewed(
  subscriptionId: string
): Promise<void> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const nextPeriodEnd = new Date((subscription as any).current_period_end * 1000);

  await prisma.mktListingBreederService.updateMany({
    where: { stripeSubscriptionId: subscriptionId } as any,
    data: {
      stripeSubscriptionStatus: subscription.status,
      currentPeriodEnd: nextPeriodEnd,
      expiresAt: nextPeriodEnd,
    } as any,
  });

  // Send renewal email (best-effort)
  try {
    const listing = await prisma.mktListingBreederService.findFirst({
      where: { stripeSubscriptionId: subscriptionId } as any,
      select: { id: true, listingFeeCents: true } as any,
    }) as any;
    if (listing) {
      const settings = await getListingPaymentSettings();
      const owner = await resolveOwnerEmail(listing.id);
      if (owner) {
        await sendListingRenewedEmail({
          email: owner.email,
          recipientName: owner.name,
          listingTitle: owner.title,
          listingId: listing.id,
          feeCents: listing.listingFeeCents ?? settings.listingFeeCents,
          nextRenewalDate: nextPeriodEnd,
        });
      }
    }
  } catch (err: any) {
    console.error(`[listing-payment] Renewal email failed for sub ${subscriptionId}:`, err.message);
  }
}

/**
 * Handle a listing subscription ending (canceled or payment failed).
 * Updates the subscription status but does NOT immediately pause the listing.
 * The cron job handles pausing when expiresAt is reached.
 */
export async function handleListingSubscriptionEnded(
  subscriptionId: string,
  newStatus: string
): Promise<void> {
  await prisma.mktListingBreederService.updateMany({
    where: { stripeSubscriptionId: subscriptionId } as any,
    data: {
      stripeSubscriptionStatus: newStatus,
    } as any,
  });

  // Send payment-failed email when subscription goes past_due (best-effort)
  if (newStatus === "past_due") {
    try {
      const listing = await prisma.mktListingBreederService.findFirst({
        where: { stripeSubscriptionId: subscriptionId } as any,
        select: { id: true } as any,
      }) as any;
      if (listing) {
        const owner = await resolveOwnerEmail(listing.id);
        if (owner) {
          await sendListingPaymentFailedEmail({
            email: owner.email,
            recipientName: owner.name,
            listingTitle: owner.title,
            listingId: listing.id,
          });
        }
      }
    } catch (err: any) {
      console.error(`[listing-payment] Payment-failed email error for sub ${subscriptionId}:`, err.message);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Subscription Management
// ────────────────────────────────────────────────────────────────────────────

/**
 * Cancel a listing subscription at the end of the current period.
 * The listing stays LIVE until expiresAt is reached.
 */
export async function cancelListingSubscription(
  listingId: number,
  providerId?: number | null,
  tenantId?: number | null
): Promise<{ expiresAt: Date | null }> {
  const where: Record<string, unknown> = { id: listingId };
  if (providerId) where.providerId = providerId;
  if (tenantId) where.tenantId = tenantId;

  const listing = await prisma.mktListingBreederService.findFirst({
    where: where as any,
    select: {
      id: true,
      stripeSubscriptionId: true,
      currentPeriodEnd: true,
      listingFeeCents: true,
    } as any,
  }) as any;

  if (!listing?.stripeSubscriptionId) {
    throw new Error("No active subscription for this listing");
  }

  // Cancel at period end — listing stays LIVE until then
  await getStripe().subscriptions.update(listing.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await prisma.mktListingBreederService.update({
    where: { id: listingId },
    data: { stripeSubscriptionStatus: "canceling" } as any,
  });

  const expiresAt: Date | null = listing.currentPeriodEnd ?? null;

  // Send cancellation email (best-effort)
  try {
    if (expiresAt) {
      const settings = await getListingPaymentSettings();
      const owner = await resolveOwnerEmail(listingId);
      if (owner) {
        await sendListingCanceledEmail({
          email: owner.email,
          recipientName: owner.name,
          listingTitle: owner.title,
          listingId,
          expiresAt,
          feeCents: listing.listingFeeCents ?? settings.listingFeeCents,
        });
      }
    }
  } catch (err: any) {
    console.error(`[listing-payment] Canceled email failed for listing ${listingId}:`, err.message);
  }

  return { expiresAt };
}

/**
 * Get the payment/subscription status for a listing.
 * Used by the frontend to display payment state.
 */
export async function getListingPaymentStatus(
  listingId: number
): Promise<{
  status: "free" | "active" | "canceling" | "past_due" | "expired" | "founding_free";
  currentPeriodEnd: Date | null;
  listingFeeCents: number;
  isFoundingProvider: boolean;
  foundingFreeUntil: string | null;
}> {
  const settings = await getListingPaymentSettings();

  const listing = await prisma.mktListingBreederService.findUnique({
    where: { id: listingId },
    select: {
      stripeSubscriptionStatus: true,
      currentPeriodEnd: true,
      listingFeeCents: true,
      isFounding: true,
      providerId: true,
      tenantId: true,
    } as any,
  }) as any;

  if (!listing) {
    throw new Error("Listing not found");
  }

  const isFounder = listing.isFounding || await isFoundingProvider(listing.providerId, listing.tenantId);

  // Payments not enabled — everything is free
  if (!settings.enabled) {
    return {
      status: "free",
      currentPeriodEnd: null,
      listingFeeCents: settings.listingFeeCents,
      isFoundingProvider: isFounder,
      foundingFreeUntil: settings.foundingFreeUntil,
    };
  }

  // Founding provider in free period
  if (isFounder && settings.foundingFreeUntil) {
    const freeUntil = new Date(settings.foundingFreeUntil);
    if (new Date() < freeUntil) {
      return {
        status: "founding_free",
        currentPeriodEnd: null,
        listingFeeCents: settings.listingFeeCents,
        isFoundingProvider: true,
        foundingFreeUntil: settings.foundingFreeUntil,
      };
    }
  }

  // Map Stripe subscription status
  const subStatus = listing.stripeSubscriptionStatus as string | null;
  let status: "free" | "active" | "canceling" | "past_due" | "expired" | "founding_free";

  switch (subStatus) {
    case "active":
      status = "active";
      break;
    case "canceling":
      status = "canceling";
      break;
    case "past_due":
      status = "past_due";
      break;
    case "canceled":
      status = "expired";
      break;
    default:
      status = "expired";
  }

  return {
    status,
    currentPeriodEnd: listing.currentPeriodEnd ?? null,
    listingFeeCents: listing.listingFeeCents ?? settings.listingFeeCents,
    isFoundingProvider: isFounder,
    foundingFreeUntil: settings.foundingFreeUntil,
  };
}
