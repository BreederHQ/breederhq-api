// src/services/listing-boost-service.ts
/**
 * Listing Boost Service
 *
 * Business logic for marketplace listing boosts and featured promotions.
 * Handles checkout creation, activation, cancellation, expiration, and analytics.
 */

import prisma from "../prisma.js";
import { getStripe } from "./stripe-service.js";
import type {
  BoostTier,
  BoostStatus,
  ListingBoostTarget,
  ListingBoost,
} from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

export const BOOST_CONFIG = {
  BOOST: { amountCents: 499, durationDays: 7, weight: 1.5 },
  FEATURED: { amountCents: 1999, durationDays: 30, weight: 3.0 },
} as const;

const FEATURED_PAGE_TYPES: Record<string, ListingBoostTarget[]> = {
  all: [
    "INDIVIDUAL_ANIMAL",
    "ANIMAL_PROGRAM",
    "BREEDING_PROGRAM",
    "BREEDER",
    "BREEDER_SERVICE",
    "BREEDING_LISTING",
    "PROVIDER_SERVICE",
  ],
  animals: ["INDIVIDUAL_ANIMAL", "ANIMAL_PROGRAM"],
  breeders: ["BREEDER", "BREEDING_PROGRAM"],
  services: ["BREEDER_SERVICE", "BREEDING_LISTING", "PROVIDER_SERVICE"],
};

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * Monetization fields populated on public listing DTOs.
 * Mirrors the MonetizationFields interface in commerce-shared/src/api/types.ts.
 */
export interface MonetizationFields {
  boosted?: boolean;
  boostCategory?: "animals" | "breeders" | "services";
  boostWeight?: number;
  boostExpiresAt?: string;
  featured?: boolean;
  featuredWeight?: number;
  isSponsored?: boolean;
  sponsorshipType?:
    | "boosted"
    | "featured"
    | "sponsored-card"
    | "sponsored-content";
  sponsorDisclosureText?: string;
}

export interface CreateBoostCheckoutParams {
  tenantId?: number;
  providerId?: number;
  listingType: ListingBoostTarget;
  listingId: number;
  tier: BoostTier;
  autoRenew?: boolean;
  successUrl: string;
  cancelUrl: string;
}

export interface BoostExpirationResult {
  expiredCount: number;
  warningsSent: number;
  expiryEmailsSent: number;
  autoRenewalsCreated: number;
  errors: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Checkout
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout session for boosting a listing.
 * Creates a PENDING ListingBoost record before redirect.
 */
export async function createBoostCheckout(
  params: CreateBoostCheckoutParams
): Promise<string> {
  const {
    tenantId,
    providerId,
    listingType,
    listingId,
    tier,
    autoRenew = false,
    successUrl,
    cancelUrl,
  } = params;

  if (!tenantId && !providerId) {
    throw new Error("Either tenantId or providerId is required");
  }

  // Check for existing active boost on this listing (FR-21).
  // NOTE: Intentionally NOT scoped to tenantId/providerId — business rule is
  // that a listing can only have ONE active/pending boost globally, regardless
  // of owner. Two different owners should not be able to boost the same listing
  // concurrently (the listing identity is the uniqueness key, not the payer).
  const existingBoost = await prisma.listingBoost.findFirst({
    where: {
      listingType,
      listingId,
      status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
    },
  });

  if (existingBoost) {
    throw new Error("This listing already has an active boost");
  }

  const config = BOOST_CONFIG[tier];

  // Create PENDING boost record (FR-18)
  const boost = await prisma.listingBoost.create({
    data: {
      tenantId: tenantId ?? null,
      providerId: providerId ?? null,
      listingType,
      listingId,
      tier,
      weight: config.weight,
      durationDays: config.durationDays,
      status: "PENDING",
      autoRenew,
      amountCents: config.amountCents,
      currency: "USD",
    },
  });

  // Resolve Stripe customer ID (if available)
  let stripeCustomerId: string | undefined;

  if (tenantId) {
    const billing = await prisma.billingAccount.findUnique({
      where: { tenantId },
      select: { stripeCustomerId: true },
    });
    stripeCustomerId = billing?.stripeCustomerId ?? undefined;
  } else if (providerId) {
    const provider = await prisma.marketplaceProvider.findUnique({
      where: { id: providerId },
      include: { user: { select: { stripeCustomerId: true } } },
    });
    stripeCustomerId = provider?.user?.stripeCustomerId ?? undefined;
  }

  // Build Stripe Checkout Session (FR-15: one-time payment)
  const sessionParams: Record<string, unknown> = {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name:
              tier === "BOOST"
                ? "Listing Boost (7 days)"
                : "Featured Listing (30 days)",
            description:
              tier === "BOOST"
                ? "Increase listing visibility with higher search ranking"
                : "Premium placement in Featured carousels + highest search ranking",
          },
          unit_amount: config.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: "listing_boost",
      boostId: boost.id.toString(),
      listingType,
      listingId: listingId.toString(),
      tier,
    },
  };

  if (stripeCustomerId) {
    sessionParams.customer = stripeCustomerId;
  }

  const session = await getStripe().checkout.sessions.create(
    sessionParams as any
  );

  // Store Stripe session ID on boost record
  await prisma.listingBoost.update({
    where: { id: boost.id },
    data: { stripeSessionId: session.id },
  });

  if (!session.url) {
    throw new Error("Failed to create Stripe checkout session URL");
  }

  return session.url;
}

// ────────────────────────────────────────────────────────────────────────────
// Activation (called by webhook)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Activate a boost after Stripe payment confirmation (FR-19).
 * Sets status to ACTIVE, records startsAt and expiresAt.
 */
export async function activateBoost(
  boostId: number,
  stripePaymentId: string
): Promise<void> {
  const boost = await prisma.listingBoost.findUnique({
    where: { id: boostId },
  });

  if (!boost) {
    throw new Error(`Boost not found: ${boostId}`);
  }

  // Idempotent — skip if already active
  if (boost.status === "ACTIVE") return;

  if (boost.status !== "PENDING") {
    throw new Error(`Cannot activate boost with status: ${boost.status}`);
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + boost.durationDays);

  await prisma.listingBoost.update({
    where: { id: boostId },
    data: {
      status: "ACTIVE",
      startsAt: now,
      expiresAt,
      stripePaymentId,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Cancel
// ────────────────────────────────────────────────────────────────────────────

/**
 * Cancel a boost (seller-initiated, no refund). FR-28.
 */
export async function cancelBoost(
  boostId: number,
  ownerId: { tenantId?: number; providerId?: number }
): Promise<void> {
  const boost = await prisma.listingBoost.findUnique({
    where: { id: boostId },
  });

  if (!boost) {
    throw new Error("Boost not found");
  }

  // Ownership check
  if (ownerId.tenantId && boost.tenantId !== ownerId.tenantId) {
    throw new Error("Not authorized to cancel this boost");
  }
  if (ownerId.providerId && boost.providerId !== ownerId.providerId) {
    throw new Error("Not authorized to cancel this boost");
  }

  if (!["ACTIVE", "PAUSED"].includes(boost.status)) {
    throw new Error(`Cannot cancel boost with status: ${boost.status}`);
  }

  await prisma.listingBoost.update({
    where: { id: boostId },
    data: { status: "CANCELED" },
  });
}

/**
 * Admin cancel — no ownership check. FR-49.
 */
export async function adminCancelBoost(boostId: number): Promise<void> {
  const boost = await prisma.listingBoost.findUnique({
    where: { id: boostId },
  });

  if (!boost) {
    throw new Error("Boost not found");
  }

  if (!["ACTIVE", "PAUSED", "PENDING"].includes(boost.status)) {
    throw new Error(`Cannot cancel boost with status: ${boost.status}`);
  }

  await prisma.listingBoost.update({
    where: { id: boostId },
    data: { status: "CANCELED" },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Pause / Resume (listing lifecycle)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Pause a boost when the listing is paused/closed. BR-4.
 */
export async function pauseBoost(
  listingType: ListingBoostTarget,
  listingId: number
): Promise<void> {
  await prisma.listingBoost.updateMany({
    where: {
      listingType,
      listingId,
      status: "ACTIVE",
    },
    data: { status: "PAUSED" },
  });
}

/**
 * Resume a boost when the listing is re-published. BR-4.
 * Only resumes if within the original boost window.
 */
export async function resumeBoost(
  listingType: ListingBoostTarget,
  listingId: number
): Promise<void> {
  const now = new Date();

  await prisma.listingBoost.updateMany({
    where: {
      listingType,
      listingId,
      status: "PAUSED",
      expiresAt: { gt: now }, // Only resume if still within boost window
    },
    data: { status: "ACTIVE" },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Toggle Auto-Renew
// ────────────────────────────────────────────────────────────────────────────

export async function toggleAutoRenew(
  boostId: number,
  enabled: boolean,
  ownerId: { tenantId?: number; providerId?: number }
): Promise<void> {
  const boost = await prisma.listingBoost.findUnique({
    where: { id: boostId },
  });

  if (!boost) {
    throw new Error("Boost not found");
  }

  // Ownership check
  if (ownerId.tenantId && boost.tenantId !== ownerId.tenantId) {
    throw new Error("Not authorized");
  }
  if (ownerId.providerId && boost.providerId !== ownerId.providerId) {
    throw new Error("Not authorized");
  }

  await prisma.listingBoost.update({
    where: { id: boostId },
    data: { autoRenew: enabled },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Query: List Boosts for Owner
// ────────────────────────────────────────────────────────────────────────────

export async function getBoostsForOwner(
  ownerId: { tenantId?: number; providerId?: number },
  page: number = 1,
  limit: number = 25
) {
  const where: Record<string, unknown> = {};
  if (ownerId.tenantId) where.tenantId = ownerId.tenantId;
  if (ownerId.providerId) where.providerId = ownerId.providerId;

  const [items, total] = await Promise.all([
    prisma.listingBoost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.listingBoost.count({ where }),
  ]);

  return { items, total, page, limit };
}

// ────────────────────────────────────────────────────────────────────────────
// Query: Single Boost
// ────────────────────────────────────────────────────────────────────────────

/**
 * Low-level getter — returns any boost by ID without ownership filtering.
 *
 * IMPORTANT: This function does NOT enforce tenant/provider ownership.
 * Callers from non-admin routes MUST verify that the returned boost belongs
 * to the requesting user (check boost.tenantId or boost.providerId) before
 * exposing data. Admin routes (prefixed /admin/) may use it without scoping.
 *
 * Ownership-checked alternatives: cancelBoost() and toggleAutoRenew() both
 * accept an ownerId param and verify ownership internally.
 */
export async function getBoostById(
  boostId: number
): Promise<ListingBoost | null> {
  return prisma.listingBoost.findUnique({
    where: { id: boostId },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Query: Featured Listings (public carousel endpoint)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get active featured listings for carousel display.
 * Randomizes order on each call for fair exposure (FR-33).
 */
export async function getFeaturedListings(
  page: string = "all"
): Promise<ListingBoost[]> {
  const listingTypes =
    FEATURED_PAGE_TYPES[page] ?? FEATURED_PAGE_TYPES.all;

  const boosts = await prisma.listingBoost.findMany({
    where: {
      tier: "FEATURED",
      status: "ACTIVE",
      listingType: { in: listingTypes },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fisher–Yates shuffle for randomized carousel order (FR-33)
  for (let i = boosts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [boosts[i], boosts[j]] = [boosts[j], boosts[i]];
  }

  return boosts;
}

// ────────────────────────────────────────────────────────────────────────────
// Admin: All Boosts
// ────────────────────────────────────────────────────────────────────────────

export async function getAllBoosts(params: {
  status?: BoostStatus;
  page?: number;
  limit?: number;
}) {
  const { status, page = 1, limit = 25 } = params;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.listingBoost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.listingBoost.count({ where }),
  ]);

  return { items, total, page, limit };
}

// ────────────────────────────────────────────────────────────────────────────
// Admin: Stats
// ────────────────────────────────────────────────────────────────────────────

export async function getBoostStats() {
  const [
    activeBoosts,
    totalRevenue,
    tierBreakdown,
    statusBreakdown,
    analyticsAgg,
  ] = await Promise.all([
    prisma.listingBoost.count({ where: { status: "ACTIVE" } }),
    prisma.listingBoost.aggregate({
      where: { status: { in: ["ACTIVE", "EXPIRED", "CANCELED"] } },
      _sum: { amountCents: true },
    }),
    prisma.listingBoost.groupBy({
      by: ["tier"],
      where: { status: { in: ["ACTIVE", "EXPIRED", "CANCELED"] } },
      _count: true,
      _sum: { amountCents: true },
    }),
    prisma.listingBoost.groupBy({
      by: ["status"],
      _count: true,
    }),
    // FR-50: Analytics aggregation for admin dashboard
    prisma.listingBoost.aggregate({
      where: { status: { in: ["ACTIVE", "EXPIRED", "CANCELED"] } },
      _sum: { impressions: true, clicks: true, inquiries: true },
    }),
  ]);

  return {
    activeBoosts,
    totalRevenueCents: totalRevenue._sum.amountCents ?? 0,
    tierBreakdown: tierBreakdown.map((t) => ({
      tier: t.tier,
      count: t._count,
      revenueCents: t._sum.amountCents ?? 0,
    })),
    statusBreakdown: statusBreakdown.map((s) => ({
      status: s.status,
      count: s._count,
    })),
    analytics: {
      totalImpressions: analyticsAgg._sum.impressions ?? 0,
      totalClicks: analyticsAgg._sum.clicks ?? 0,
      totalInquiries: analyticsAgg._sum.inquiries ?? 0,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Expiration Processing (Cron Job)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Process boost expirations. Called hourly by cron job.
 * MUST be idempotent (safe to run multiple times).
 *
 * Steps:
 * 1. Expire ACTIVE boosts past their expiresAt
 * 2. Expire PAUSED boosts past their expiresAt
 * 3. Send expiry-day emails for newly expired boosts (FR-24)
 * 4. Send 3-day warning emails (skip if already sent) (FR-23)
 * 5. Process auto-renewals for expired boosts with autoRenew=true (FR-25)
 *
 * Idempotency:
 *  - Steps 1-2: updateMany only touches ACTIVE/PAUSED → once EXPIRED, won't match again
 *  - Step 3: expiredNotifiedAt=null guard prevents duplicate expiry emails
 *  - Step 4: expiryNotifiedAt=null guard prevents duplicate warning emails
 *  - Step 5: autoRenew set to false after processing prevents re-processing
 */
export async function processBoostExpirations(): Promise<BoostExpirationResult> {
  const result: BoostExpirationResult = {
    expiredCount: 0,
    warningsSent: 0,
    expiryEmailsSent: 0,
    autoRenewalsCreated: 0,
    errors: 0,
  };

  const now = new Date();

  try {
    // 1. Expire ACTIVE boosts past their expiresAt (FR-22)
    const expiredActive = await prisma.listingBoost.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });
    result.expiredCount += expiredActive.count;

    // 2. Expire PAUSED boosts past their expiresAt (BR-4)
    const expiredPaused = await prisma.listingBoost.updateMany({
      where: {
        status: "PAUSED",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });
    result.expiredCount += expiredPaused.count;

    // 3. Send expiry-day emails for expired boosts (FR-24, BR-9)
    //    Only targets non-autoRenew boosts — auto-renew boosts get a renewal email instead (step 5).
    //    Idempotent: expiredNotifiedAt=null guard ensures at most one email per boost.
    const expiredNeedingNotification = await prisma.listingBoost.findMany({
      where: {
        status: "EXPIRED",
        expiredNotifiedAt: null,
        autoRenew: false,
      },
    });

    for (const boost of expiredNeedingNotification) {
      try {
        await sendBoostExpiredNotification(boost);
        await prisma.listingBoost.update({
          where: { id: boost.id },
          data: { expiredNotifiedAt: now },
        });
        result.expiryEmailsSent++;
      } catch (err: any) {
        console.error(
          `[listing-boost-expiration] Expiry email failed for boost ${boost.id}:`,
          err.message
        );
        result.errors++;
      }
    }

    // 4. Send 3-day warning emails (FR-23, BR-9)
    //    Idempotent: expiryNotifiedAt=null guard ensures at most one warning per boost.
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const boostsNearingExpiry = await prisma.listingBoost.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: threeDaysFromNow, gt: now },
        expiryNotifiedAt: null,
      },
    });

    for (const boost of boostsNearingExpiry) {
      try {
        await sendBoostExpiryWarning(boost);
        await prisma.listingBoost.update({
          where: { id: boost.id },
          data: { expiryNotifiedAt: now },
        });
        result.warningsSent++;
      } catch (err: any) {
        console.error(
          `[listing-boost-expiration] Warning email failed for boost ${boost.id}:`,
          err.message
        );
        result.errors++;
      }
    }

    // 5. Process auto-renewals for expired boosts with autoRenew=true (FR-25, BR-8)
    //    Creates new PENDING boost + Stripe Checkout session, sends payment link email.
    //    Idempotent: autoRenew set to false after processing + expiredNotifiedAt set.
    const autoRenewBoosts = await prisma.listingBoost.findMany({
      where: {
        status: "EXPIRED",
        autoRenew: true,
      },
    });

    for (const boost of autoRenewBoosts) {
      try {
        await processAutoRenewal(boost);
        // Disable autoRenew + mark as notified to prevent re-processing and
        // prevent the expiry email (step 3) from also firing on next run
        await prisma.listingBoost.update({
          where: { id: boost.id },
          data: { autoRenew: false, expiredNotifiedAt: now },
        });
        result.autoRenewalsCreated++;
      } catch (err: any) {
        console.error(
          `[listing-boost-expiration] Auto-renewal failed for boost ${boost.id}:`,
          err.message
        );
        result.errors++;
      }
    }
  } catch (err: any) {
    console.error(
      `[listing-boost-expiration] Fatal error:`,
      err.message
    );
    result.errors++;
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Search Ranking — boost-aware sort + 15% cap + MonetizationFields
// ────────────────────────────────────────────────────────────────────────────

/**
 * Boost category mapping (per Featured Carousel Page-Type in spec §14).
 */
const BOOST_CATEGORY_MAP: Record<
  ListingBoostTarget,
  "animals" | "breeders" | "services"
> = {
  INDIVIDUAL_ANIMAL: "animals",
  ANIMAL_PROGRAM: "animals",
  BREEDING_PROGRAM: "breeders",
  BREEDER: "breeders",
  BREEDER_SERVICE: "services",
  BREEDING_LISTING: "services",
  PROVIDER_SERVICE: "services",
};

/**
 * Apply boost ranking to a page of listings.
 *
 * Implements the Search Ranking Algorithm (spec §14):
 *  1. Fetch active boosts for the listing type(s) being queried
 *  2. Sort: Featured (3.0×) → Boosted (1.5×) → Organic (1.0×); recency within each group (FR-38)
 *  3. Enforce 15 % cap: move excess boosted listings to organic position (FR-39, BR-6)
 *  4. Populate MonetizationFields on each item
 *  5. Track impressions asynchronously (non-blocking, FR-44)
 *
 * Does NOT mutate the input array — returns a new array.
 */
export async function applyBoostRanking<T extends { id: number }>(
  items: T[],
  listingTypes: ListingBoostTarget | ListingBoostTarget[]
): Promise<(T & MonetizationFields)[]> {
  if (items.length === 0) return [];

  const types = Array.isArray(listingTypes) ? listingTypes : [listingTypes];
  const listingIds = items.map((item) => item.id);

  // 1. Fetch active boosts for all items in this batch (single query)
  const activeBoosts = await prisma.listingBoost.findMany({
    where: {
      listingType: { in: types },
      listingId: { in: listingIds },
      status: "ACTIVE",
    },
    select: {
      id: true,
      listingId: true,
      tier: true,
      weight: true,
      expiresAt: true,
      listingType: true,
    },
  });

  // Short-circuit: no boosts → return items as-is (no re-sort needed)
  if (activeBoosts.length === 0) {
    return items as (T & MonetizationFields)[];
  }

  // 2. Build lookup map: listingId → boost info
  const boostMap = new Map<number, (typeof activeBoosts)[0]>();
  for (const boost of activeBoosts) {
    boostMap.set(boost.listingId, boost);
  }

  // 3. 15 % cap (FR-39 / Business Rule #6)
  const maxPromoted = Math.ceil(items.length * 0.15);

  // 4. Partition: featured → boosted → organic  (preserving original order within each group = recency, FR-38)
  const featured: T[] = [];
  const boosted: T[] = [];
  const organic: T[] = [];

  for (const item of items) {
    const boost = boostMap.get(item.id);
    if (boost?.tier === "FEATURED") {
      featured.push(item);
    } else if (boost?.tier === "BOOST") {
      boosted.push(item);
    } else {
      organic.push(item);
    }
  }

  // 5. Cap: featured always takes priority, then boosted; excess demoted to organic tail
  const allPromoted = [...featured, ...boosted];
  const inSlot = allPromoted.slice(0, maxPromoted);
  const demoted = allPromoted.slice(maxPromoted);
  const sorted = [...inSlot, ...organic, ...demoted];

  // Set of listing IDs that made the promoted cut
  const promotedIds = new Set(inSlot.map((i) => i.id));

  // 6. Populate MonetizationFields
  const result: (T & MonetizationFields)[] = sorted.map((item) => {
    const boost = boostMap.get(item.id);
    const isPromoted = boost !== undefined && promotedIds.has(item.id);

    if (isPromoted && boost) {
      const category = BOOST_CATEGORY_MAP[boost.listingType];
      return {
        ...item,
        boosted: boost.tier === "BOOST" ? true : undefined,
        boostCategory: category,
        boostWeight: boost.weight,
        boostExpiresAt: boost.expiresAt?.toISOString(),
        featured: boost.tier === "FEATURED" ? true : undefined,
        featuredWeight:
          boost.tier === "FEATURED" ? boost.weight : undefined,
        isSponsored: true,
        sponsorshipType: (boost.tier === "FEATURED"
          ? "featured"
          : "boosted") as "featured" | "boosted",
        sponsorDisclosureText:
          boost.tier === "FEATURED" ? "Featured" : "Promoted",
      };
    }

    return { ...item } as T & MonetizationFields;
  });

  // 7. Async impression tracking (non-blocking) — FR-44 / NFR: must not block response
  const impressionBoostIds = activeBoosts
    .filter((b) => promotedIds.has(b.listingId))
    .map((b) => b.id);

  if (impressionBoostIds.length > 0) {
    trackBoostImpressions(impressionBoostIds).catch(() => {
      // Silently swallow — impression tracking is best-effort
    });
  }

  return result;
}

/**
 * Increment impression counts for boosted listings (batch update).
 * Called fire-and-forget; failures are non-critical.
 */
async function trackBoostImpressions(boostIds: number[]): Promise<void> {
  if (boostIds.length === 0) return;
  await prisma.listingBoost.updateMany({
    where: { id: { in: boostIds } },
    data: { impressions: { increment: 1 } },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Analytics: Click Tracking (FR-45)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Track a click on a boosted listing.
 * Returns true if the listing had an active boost and the click was recorded.
 */
export async function trackBoostClick(
  listingType: ListingBoostTarget,
  listingId: number
): Promise<boolean> {
  const result = await prisma.listingBoost.updateMany({
    where: {
      listingType,
      listingId,
      status: "ACTIVE",
    },
    data: { clicks: { increment: 1 } },
  });
  return result.count > 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Analytics: Inquiry Tracking (FR-46)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Track an inquiry against active boosts for a listing.
 * Called after successful inquiry creation.
 * Returns true if the listing had an active boost and the inquiry was counted.
 */
export async function trackBoostInquiry(
  listingType: ListingBoostTarget,
  listingId: number
): Promise<boolean> {
  const result = await prisma.listingBoost.updateMany({
    where: {
      listingType,
      listingId,
      status: "ACTIVE",
    },
    data: { inquiries: { increment: 1 } },
  });
  return result.count > 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Private Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the owner's email address from tenantId or providerId.
 */
async function resolveOwnerEmail(boost: ListingBoost): Promise<string | null> {
  if (boost.tenantId) {
    const org = await prisma.organization.findFirst({
      where: { tenantId: boost.tenantId },
      select: { party: { select: { email: true } } },
    });
    return org?.party?.email ?? null;
  }

  if (boost.providerId) {
    const provider = await prisma.marketplaceProvider.findUnique({
      where: { id: boost.providerId },
      include: { user: { select: { email: true } } },
    });
    return provider?.user?.email ?? null;
  }

  return null;
}

/**
 * Send a 3-day expiry warning email (FR-23).
 */
async function sendBoostExpiryWarning(boost: ListingBoost): Promise<void> {
  const email = await resolveOwnerEmail(boost);
  if (!email) {
    console.warn(
      `[listing-boost-expiration] No email found for boost ${boost.id}`
    );
    return;
  }

  const { sendEmail } = await import("./email-service.js");
  const tierLabel = boost.tier === "FEATURED" ? "Featured" : "Boost";
  const expiresDate = boost.expiresAt
    ? boost.expiresAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "soon";

  const platformUrl =
    process.env.PLATFORM_URL || "https://app.breederhq.com";

  await sendEmail({
    tenantId: boost.tenantId ?? null,
    to: email,
    subject: `Your ${tierLabel} listing boost expires ${expiresDate}`,
    html: `
      <h2>Boost Expiring Soon</h2>
      <p>Your <strong>${tierLabel}</strong> boost is expiring on <strong>${expiresDate}</strong>.</p>
      <p>If you'd like to continue boosting your listing, you can purchase a new boost from your dashboard.</p>
      <p style="margin-top: 16px;">
        <a href="${platformUrl}/marketplace/boosts"
           style="display: inline-block; padding: 10px 20px; background-color: #f97316; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
          Manage Boosts
        </a>
      </p>
      <p style="margin-top: 24px; color: #666; font-size: 12px;">
        This is an automated notification from BreederHQ.
      </p>
    `,
    text: `Your ${tierLabel} boost is expiring on ${expiresDate}. Visit your dashboard to renew: ${platformUrl}/marketplace/boosts`,
    templateKey: "boost_expiry_warning",
    category: "transactional",
    metadata: { boostId: boost.id, tier: boost.tier },
  });
}

/**
 * Send an expiry-day notification email (FR-24).
 * Tells the seller their boost has expired and links to dashboard for re-purchase.
 */
async function sendBoostExpiredNotification(boost: ListingBoost): Promise<void> {
  const email = await resolveOwnerEmail(boost);
  if (!email) {
    console.warn(
      `[listing-boost-expiration] No email found for boost ${boost.id}`
    );
    return;
  }

  const { sendEmail } = await import("./email-service.js");
  const tierLabel = boost.tier === "FEATURED" ? "Featured" : "Boost";
  const expiredDate = boost.expiresAt
    ? boost.expiresAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "today";

  const platformUrl =
    process.env.PLATFORM_URL || "https://app.breederhq.com";

  await sendEmail({
    tenantId: boost.tenantId ?? null,
    to: email,
    subject: `Your ${tierLabel} listing boost has expired`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Boost Expired</h2>
        <p>Your <strong>${tierLabel}</strong> listing boost expired on <strong>${expiredDate}</strong>.</p>
        <p>Your listing has returned to its organic ranking position in marketplace search results.</p>
        <p>Want to keep your listing visible? You can purchase a new boost from your dashboard at any time.</p>
        <p style="margin-top: 16px;">
          <a href="${platformUrl}/marketplace/boosts"
             style="display: inline-block; padding: 10px 20px; background-color: #f97316; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Reboost Listing
          </a>
        </p>
        <p style="margin-top: 24px; color: #666; font-size: 12px;">
          This is an automated notification from BreederHQ.
        </p>
      </div>
    `,
    text: `Your ${tierLabel} boost expired on ${expiredDate}. Your listing has returned to organic ranking. Reboost at: ${platformUrl}/marketplace/boosts`,
    templateKey: "boost_expired",
    category: "transactional",
    metadata: { boostId: boost.id, tier: boost.tier },
  });
}

/**
 * Process auto-renewal: create new PENDING boost + send payment link email.
 * Does NOT auto-charge — sends a Stripe Checkout link (v1 requirement, BR-8).
 */
async function processAutoRenewal(boost: ListingBoost): Promise<void> {
  const config = BOOST_CONFIG[boost.tier as keyof typeof BOOST_CONFIG];
  const platformUrl =
    process.env.PLATFORM_URL || "https://app.breederhq.com";

  // Create new PENDING boost record
  const newBoost = await prisma.listingBoost.create({
    data: {
      tenantId: boost.tenantId,
      providerId: boost.providerId,
      listingType: boost.listingType,
      listingId: boost.listingId,
      tier: boost.tier,
      weight: config.weight,
      durationDays: config.durationDays,
      status: "PENDING",
      autoRenew: true,
      amountCents: config.amountCents,
      currency: "USD",
    },
  });

  // Create Stripe Checkout Session for the renewal
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name:
              boost.tier === "BOOST"
                ? "Listing Boost Renewal (7 days)"
                : "Featured Listing Renewal (30 days)",
          },
          unit_amount: config.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${platformUrl}/marketplace/boosts?renewed=true`,
    cancel_url: `${platformUrl}/marketplace/boosts`,
    metadata: {
      type: "listing_boost",
      boostId: newBoost.id.toString(),
      listingType: boost.listingType,
      listingId: boost.listingId.toString(),
      tier: boost.tier,
    },
  } as any);

  // Store session ID on new boost
  await prisma.listingBoost.update({
    where: { id: newBoost.id },
    data: { stripeSessionId: session.id },
  });

  // Send payment link email
  const email = await resolveOwnerEmail(boost);
  if (email && session.url) {
    const { sendEmail } = await import("./email-service.js");
    const tierLabel = boost.tier === "FEATURED" ? "Featured" : "Boost";

    await sendEmail({
      tenantId: boost.tenantId ?? null,
      to: email,
      subject: `Renew your ${tierLabel} listing boost`,
      html: `
        <h2>Boost Auto-Renewal</h2>
        <p>Your <strong>${tierLabel}</strong> boost has expired and you opted in to auto-renewal.</p>
        <p>Click the button below to complete payment and renew your boost:</p>
        <p style="margin-top: 16px;">
          <a href="${session.url}"
             style="display: inline-block; padding: 10px 20px; background-color: #f97316; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Renew Boost — $${(config.amountCents / 100).toFixed(2)}
          </a>
        </p>
        <p style="margin-top: 12px; color: #888; font-size: 13px;">
          This link will expire in 24 hours. To disable auto-renewal, visit your boost management page.
        </p>
        <p style="margin-top: 24px; color: #666; font-size: 12px;">
          This is an automated notification from BreederHQ.
        </p>
      `,
      text: `Your ${tierLabel} boost has expired. Renew at: ${session.url}`,
      templateKey: "boost_auto_renewal",
      category: "transactional",
      metadata: { boostId: newBoost.id, tier: boost.tier },
    });
  }
}
