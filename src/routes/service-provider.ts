// src/routes/service-provider.ts
// API endpoints for Service Provider portal (non-breeder service providers)
// Handles account management, profile, listings, and Stripe integration

import type { FastifyInstance } from "fastify";
import type { ListingType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma from "../prisma.js";
import Stripe from "stripe";

// ============================================================================
// Types
// ============================================================================

// Service types available to service providers
const PROVIDER_SERVICE_TYPES: ListingType[] = [
  "TRAINING",
  "VETERINARY",
  "PHOTOGRAPHY",
  "GROOMING",
  "TRANSPORT",
  "BOARDING",
  "PRODUCT",
  "OTHER_SERVICE",
];

interface ProfileInput {
  businessName: string;
  email: string;
  phone?: string;
  website?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface ServiceListingInput {
  listingType: ListingType;
  title: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  city?: string;
  state?: string;
  priceCents?: number;
  priceType?: "fixed" | "starting_at" | "contact";
  images?: string[];
  videoUrl?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Helpers
// ============================================================================

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
}

function isValidServiceType(type: string): boolean {
  return PROVIDER_SERVICE_TYPES.includes(type as ListingType);
}

function generateSlug(title: string, id: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `svc-${base}-${id}`;
}

// ============================================================================
// Routes
// ============================================================================

export default async function serviceProviderRoutes(app: FastifyInstance) {
  // --------------------------------------------------------------------------
  // GET /provider/profile - Get current user's service provider profile
  // --------------------------------------------------------------------------
  app.get("/provider/profile", async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const profile = await prisma.serviceProviderProfile.findUnique({
      where: { userId },
      include: {
        listings: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!profile) {
      return reply.code(404).send({ error: "profile_not_found" });
    }

    return reply.send({
      id: profile.id,
      businessName: profile.businessName,
      email: profile.email,
      phone: profile.phone,
      website: profile.website,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      plan: profile.plan,
      stripeCustomerId: profile.stripeCustomerId,
      stripeSubscriptionId: profile.stripeSubscriptionId,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      listingsCount: profile.listings.length,
      activeListingsCount: profile.listings.filter((l) => l.status === "ACTIVE").length,
    });
  });

  // --------------------------------------------------------------------------
  // POST /provider/profile - Create service provider profile
  // --------------------------------------------------------------------------
  app.post<{
    Body: ProfileInput;
  }>("/provider/profile", async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    // Check if profile already exists
    const existing = await prisma.serviceProviderProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      return reply.code(409).send({ error: "profile_already_exists" });
    }

    const { businessName, email, phone, website, city, state, country } = req.body;

    if (!businessName || !email) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["businessName", "email"],
      });
    }

    const profile = await prisma.serviceProviderProfile.create({
      data: {
        userId,
        businessName: businessName.trim(),
        email: email.trim(),
        phone: phone?.trim() || null,
        website: website?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        country: country?.trim() || "US",
        plan: "FREE",
      },
    });

    return reply.code(201).send({
      id: profile.id,
      businessName: profile.businessName,
      email: profile.email,
      phone: profile.phone,
      website: profile.website,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      plan: profile.plan,
      createdAt: profile.createdAt.toISOString(),
    });
  });

  // --------------------------------------------------------------------------
  // PUT /provider/profile - Update service provider profile
  // --------------------------------------------------------------------------
  app.put<{
    Body: Partial<ProfileInput>;
  }>("/provider/profile", async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const profile = await prisma.serviceProviderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return reply.code(404).send({ error: "profile_not_found" });
    }

    const { businessName, email, phone, website, city, state, country } = req.body;

    const updated = await prisma.serviceProviderProfile.update({
      where: { id: profile.id },
      data: {
        ...(businessName !== undefined && { businessName: businessName.trim() }),
        ...(email !== undefined && { email: email.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(website !== undefined && { website: website?.trim() || null }),
        ...(city !== undefined && { city: city?.trim() || null }),
        ...(state !== undefined && { state: state?.trim() || null }),
        ...(country !== undefined && { country: country?.trim() || "US" }),
      },
    });

    return reply.send({
      id: updated.id,
      businessName: updated.businessName,
      email: updated.email,
      phone: updated.phone,
      website: updated.website,
      city: updated.city,
      state: updated.state,
      country: updated.country,
      plan: updated.plan,
      updatedAt: updated.updatedAt.toISOString(),
    });
  });

  // --------------------------------------------------------------------------
  // GET /provider/listings - List service provider's listings
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: { status?: string };
  }>("/provider/listings", async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const profile = await prisma.serviceProviderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return reply.code(404).send({ error: "profile_not_found" });
    }

    const { status } = req.query;

    const where: any = {
      serviceProviderId: profile.id,
      listingType: { in: PROVIDER_SERVICE_TYPES },
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    const listings = await prisma.marketplaceListing.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return reply.send({
      items: listings.map((l) => ({
        id: l.id,
        listingType: l.listingType,
        title: l.title,
        description: l.description,
        city: l.city,
        state: l.state,
        priceCents: l.priceCents,
        priceType: l.priceType,
        status: l.status,
        slug: l.slug,
        viewCount: l.viewCount,
        inquiryCount: l.inquiryCount,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      })),
      total: listings.length,
    });
  });

  // --------------------------------------------------------------------------
  // POST /provider/listings - Create a new listing
  // --------------------------------------------------------------------------
  app.post<{
    Body: ServiceListingInput;
  }>("/provider/listings", async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const profile = await prisma.serviceProviderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return reply.code(404).send({ error: "profile_not_found" });
    }

    const {
      listingType,
      title,
      description,
      contactName,
      contactEmail,
      contactPhone,
      city,
      state,
      priceCents,
      priceType,
      images,
      videoUrl,
      metadata,
    } = req.body;

    if (!listingType || !title) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["listingType", "title"],
      });
    }

    if (!isValidServiceType(listingType)) {
      return reply.code(400).send({
        error: "invalid_listing_type",
        allowed: PROVIDER_SERVICE_TYPES,
      });
    }

    // Check listing limits based on plan
    const activeListings = await prisma.marketplaceListing.count({
      where: {
        serviceProviderId: profile.id,
        status: { in: ["DRAFT", "ACTIVE"] },
      },
    });

    const maxListings = profile.plan === "FREE" ? 1 : profile.plan === "PREMIUM" ? 5 : 20;
    if (activeListings >= maxListings) {
      return reply.code(403).send({
        error: "listing_limit_reached",
        limit: maxListings,
        plan: profile.plan,
      });
    }

    const listing = await prisma.marketplaceListing.create({
      data: {
        serviceProviderId: profile.id,
        listingType,
        title: title.trim(),
        description: description?.trim() || null,
        contactName: contactName?.trim() || profile.businessName,
        contactEmail: contactEmail?.trim() || profile.email,
        contactPhone: contactPhone?.trim() || profile.phone,
        city: city?.trim() || profile.city,
        state: state?.trim() || profile.state,
        country: profile.country,
        priceCents: priceCents ?? null,
        priceType: priceType || null,
        images: images ? (images as Prisma.InputJsonValue) : Prisma.JsonNull,
        videoUrl: videoUrl?.trim() || null,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        status: "DRAFT",
        tier: profile.plan,
      },
    });

    // Generate and set slug
    const slug = generateSlug(title, listing.id);
    const updated = await prisma.marketplaceListing.update({
      where: { id: listing.id },
      data: { slug },
    });

    return reply.code(201).send({
      id: updated.id,
      listingType: updated.listingType,
      title: updated.title,
      slug: updated.slug,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
    });
  });

  // --------------------------------------------------------------------------
  // PUT /provider/listings/:id - Update a listing
  // --------------------------------------------------------------------------
  app.put<{
    Params: { id: string };
    Body: Partial<ServiceListingInput>;
  }>("/provider/listings/:id", async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const profile = await prisma.serviceProviderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return reply.code(404).send({ error: "profile_not_found" });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.marketplaceListing.findFirst({
      where: { id, serviceProviderId: profile.id },
    });

    if (!existing) {
      return reply.code(404).send({ error: "listing_not_found" });
    }

    const {
      listingType,
      title,
      description,
      contactName,
      contactEmail,
      contactPhone,
      city,
      state,
      priceCents,
      priceType,
      images,
      videoUrl,
      metadata,
    } = req.body;

    if (listingType && !isValidServiceType(listingType)) {
      return reply.code(400).send({
        error: "invalid_listing_type",
        allowed: PROVIDER_SERVICE_TYPES,
      });
    }

    const updateData: Prisma.MarketplaceListingUpdateInput = {};
    if (listingType) updateData.listingType = listingType;
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (contactName !== undefined) updateData.contactName = contactName?.trim() || null;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail?.trim() || null;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone?.trim() || null;
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (state !== undefined) updateData.state = state?.trim() || null;
    if (priceCents !== undefined) updateData.priceCents = priceCents ?? null;
    if (priceType !== undefined) updateData.priceType = priceType || null;
    if (images !== undefined) updateData.images = images ? (images as Prisma.InputJsonValue) : Prisma.JsonNull;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl?.trim() || null;
    if (metadata !== undefined) updateData.metadata = metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull;

    const listing = await prisma.marketplaceListing.update({
      where: { id },
      data: updateData,
    });

    return reply.send({
      id: listing.id,
      listingType: listing.listingType,
      title: listing.title,
      status: listing.status,
      updatedAt: listing.updatedAt.toISOString(),
    });
  });

  // --------------------------------------------------------------------------
  // POST /provider/listings/:id/publish - Publish a listing
  // --------------------------------------------------------------------------
  app.post<{
    Params: { id: string };
  }>("/provider/listings/:id/publish", async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const profile = await prisma.serviceProviderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return reply.code(404).send({ error: "profile_not_found" });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.marketplaceListing.findFirst({
      where: { id, serviceProviderId: profile.id },
    });

    if (!existing) {
      return reply.code(404).send({ error: "listing_not_found" });
    }

    if (!existing.title) {
      return reply.code(400).send({ error: "title_required_to_publish" });
    }

    const listing = await prisma.marketplaceListing.update({
      where: { id },
      data: {
        status: "ACTIVE",
        publishedAt: new Date(),
      },
    });

    return reply.send({
      id: listing.id,
      status: listing.status,
      publishedAt: listing.publishedAt?.toISOString(),
    });
  });

  // --------------------------------------------------------------------------
  // POST /provider/listings/:id/unpublish - Unpublish a listing
  // --------------------------------------------------------------------------
  app.post<{
    Params: { id: string };
  }>("/provider/listings/:id/unpublish", async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const profile = await prisma.serviceProviderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return reply.code(404).send({ error: "profile_not_found" });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.marketplaceListing.findFirst({
      where: { id, serviceProviderId: profile.id },
    });

    if (!existing) {
      return reply.code(404).send({ error: "listing_not_found" });
    }

    const listing = await prisma.marketplaceListing.update({
      where: { id },
      data: { status: "PAUSED" },
    });

    return reply.send({
      id: listing.id,
      status: listing.status,
    });
  });

  // --------------------------------------------------------------------------
  // DELETE /provider/listings/:id - Delete a listing
  // --------------------------------------------------------------------------
  app.delete<{
    Params: { id: string };
  }>("/provider/listings/:id", async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const profile = await prisma.serviceProviderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return reply.code(404).send({ error: "profile_not_found" });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.marketplaceListing.findFirst({
      where: { id, serviceProviderId: profile.id },
    });

    if (!existing) {
      return reply.code(404).send({ error: "listing_not_found" });
    }

    await prisma.marketplaceListing.delete({
      where: { id },
    });

    return reply.code(204).send();
  });

  // --------------------------------------------------------------------------
  // GET /provider/dashboard - Dashboard stats for service provider
  // --------------------------------------------------------------------------
  app.get("/provider/dashboard", async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const profile = await prisma.serviceProviderProfile.findUnique({
      where: { userId },
      include: {
        listings: true,
      },
    });

    if (!profile) {
      return reply.code(404).send({ error: "profile_not_found" });
    }

    const totalListings = profile.listings.length;
    const activeListings = profile.listings.filter((l) => l.status === "ACTIVE").length;
    const totalViews = profile.listings.reduce((sum, l) => sum + l.viewCount, 0);
    const totalInquiries = profile.listings.reduce((sum, l) => sum + l.inquiryCount, 0);

    return reply.send({
      profile: {
        id: profile.id,
        businessName: profile.businessName,
        plan: profile.plan,
        hasStripeSubscription: !!profile.stripeSubscriptionId,
      },
      stats: {
        totalListings,
        activeListings,
        draftListings: totalListings - activeListings,
        totalViews,
        totalInquiries,
      },
      limits: {
        maxListings: profile.plan === "FREE" ? 1 : profile.plan === "PREMIUM" ? 5 : 20,
        currentListings: totalListings,
      },
    });
  });

  // --------------------------------------------------------------------------
  // POST /provider/billing/checkout - Create Stripe checkout session
  // --------------------------------------------------------------------------
  app.post<{
    Body: { plan: "PREMIUM" | "BUSINESS"; successUrl: string; cancelUrl: string };
  }>("/provider/billing/checkout", async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const profile = await prisma.serviceProviderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return reply.code(404).send({ error: "profile_not_found" });
    }

    const { plan, successUrl, cancelUrl } = req.body;

    if (!plan || !successUrl || !cancelUrl) {
      return reply.code(400).send({ error: "missing_required_fields" });
    }

    // Get price ID based on plan (these should be configured in env)
    const priceId = plan === "PREMIUM"
      ? process.env.STRIPE_PROVIDER_PREMIUM_PRICE_ID
      : process.env.STRIPE_PROVIDER_BUSINESS_PRICE_ID;

    if (!priceId) {
      return reply.code(500).send({ error: "stripe_not_configured" });
    }

    const stripe = getStripe();

    // Get or create Stripe customer
    let customerId = profile.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        name: profile.businessName,
        metadata: {
          serviceProviderId: String(profile.id),
          userId,
        },
      });
      customerId = customer.id;

      await prisma.serviceProviderProfile.update({
        where: { id: profile.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        serviceProviderId: String(profile.id),
        plan,
      },
    });

    return reply.send({ checkoutUrl: session.url });
  });

  // --------------------------------------------------------------------------
  // POST /provider/billing/portal - Create Stripe customer portal session
  // --------------------------------------------------------------------------
  app.post<{
    Body: { returnUrl: string };
  }>("/provider/billing/portal", async (req, reply) => {
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const profile = await prisma.serviceProviderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return reply.code(404).send({ error: "profile_not_found" });
    }

    if (!profile.stripeCustomerId) {
      return reply.code(400).send({ error: "no_stripe_customer" });
    }

    const { returnUrl } = req.body;

    if (!returnUrl) {
      return reply.code(400).send({ error: "returnUrl_required" });
    }

    const stripe = getStripe();

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: returnUrl,
    });

    return reply.send({ portalUrl: session.url });
  });
}
