// src/routes/breeding-analytics.ts
// Breeding Discovery Analytics API

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /breeding-analytics/listings - Listing performance metrics
  app.get("/breeding-analytics/listings", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    try {
      // Get all listings with their conversion metrics
      const listings = await prisma.breedingListing.findMany({
        where: { tenantId },
        select: {
          id: true,
          listingNumber: true,
          headline: true,
          viewCount: true,
          inquiryCount: true,
          bookingCount: true,
          status: true,
          createdAt: true,
          publishedAt: true,
          animal: {
            select: {
              id: true,
              name: true,
              species: true,
              breed: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const summary = {
        totalViews: listings.reduce((sum, l) => sum + l.viewCount, 0),
        totalInquiries: listings.reduce((sum, l) => sum + l.inquiryCount, 0),
        totalBookings: listings.reduce((sum, l) => sum + l.bookingCount, 0),
        inquiryRate: 0,
        conversionRate: 0,
      };

      if (summary.totalViews > 0) {
        summary.inquiryRate = (summary.totalInquiries / summary.totalViews) * 100;
      }

      if (summary.totalInquiries > 0) {
        summary.conversionRate = (summary.totalBookings / summary.totalInquiries) * 100;
      }

      const byListing = listings.map((listing) => ({
        listingId: listing.id,
        listingNumber: listing.listingNumber,
        headline: listing.headline,
        animal: listing.animal,
        views: listing.viewCount,
        inquiries: listing.inquiryCount,
        bookings: listing.bookingCount,
        inquiryRate: listing.viewCount > 0 ? (listing.inquiryCount / listing.viewCount) * 100 : 0,
        conversionRate: listing.inquiryCount > 0 ? (listing.bookingCount / listing.inquiryCount) * 100 : 0,
        status: listing.status,
        publishedAt: listing.publishedAt?.toISOString(),
      }));

      return reply.send({
        summary,
        byListing,
      });
    } catch (err) {
      console.error("Failed to get listing analytics:", err);
      return reply.code(500).send({ error: "analytics_failed" });
    }
  });

  // GET /breeding-analytics/conversion-funnel/:listingId - Full conversion funnel for a listing
  app.get("/breeding-analytics/conversion-funnel/:listingId", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const listingId = Number((req.params as any).listingId);

    try {
      // Get listing
      const listing = await prisma.breedingListing.findFirst({
        where: { id: listingId, tenantId },
        select: {
          id: true,
          listingNumber: true,
          headline: true,
          viewCount: true,
          animal: {
            select: {
              id: true,
              name: true,
              species: true,
              breed: true,
            },
          },
        },
      });

      if (!listing) {
        return reply.code(404).send({ error: "listing_not_found" });
      }

      // Get inquiries
      const inquiries = await prisma.breedingInquiry.findMany({
        where: { listingId, tenantId },
        select: {
          id: true,
          inquirerName: true,
          inquirerEmail: true,
          status: true,
          convertedToBookingId: true,
          createdAt: true,
          convertedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Get bookings created from this listing
      const bookings = await prisma.breedingBooking.findMany({
        where: { sourceListingId: listingId, offeringTenantId: tenantId },
        select: {
          id: true,
          bookingNumber: true,
          status: true,
          sourceInquiryId: true,
          breedingPlanId: true,
          createdAt: true,
          seekingPartyId: true,
          seekingParty: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Get breeding plans from these bookings
      const planIds = bookings.filter((b) => b.breedingPlanId).map((b) => b.breedingPlanId!);
      const plans = await prisma.breedingPlan.findMany({
        where: { id: { in: planIds } },
        select: {
          id: true,
          name: true,
          code: true,
          damId: true,
          sireId: true,
          createdAt: true,
        },
      });

      // Get offspring from these plans
      const offspringFromPlans = await prisma.animal.findMany({
        where: {
          OR: [
            { damId: listing.animal?.id },
            { sireId: listing.animal?.id },
          ],
        },
        select: {
          id: true,
          name: true,
          sex: true,
          birthDate: true,
          damId: true,
          sireId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        listing: {
          id: listing.id,
          listingNumber: listing.listingNumber,
          headline: listing.headline,
          views: listing.viewCount,
          animal: listing.animal,
        },
        inquiries: {
          total: inquiries.length,
          converted: inquiries.filter((i) => i.convertedToBookingId).length,
          items: inquiries.map((i) => ({
            id: i.id,
            inquirerName: i.inquirerName,
            inquirerEmail: i.inquirerEmail,
            status: i.status,
            convertedToBookingId: i.convertedToBookingId,
            createdAt: i.createdAt.toISOString(),
            convertedAt: i.convertedAt?.toISOString(),
          })),
        },
        bookings: {
          total: bookings.length,
          withBreedingPlan: bookings.filter((b) => b.breedingPlanId).length,
          items: bookings.map((b) => ({
            id: b.id,
            bookingNumber: b.bookingNumber,
            status: b.status,
            sourceInquiryId: b.sourceInquiryId,
            breedingPlanId: b.breedingPlanId,
            party: b.seekingParty?.name || b.seekingParty?.email || 'Unknown',
            createdAt: b.createdAt.toISOString(),
          })),
        },
        breedingPlans: {
          total: plans.length,
          items: plans.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            damId: p.damId,
            sireId: p.sireId,
            createdAt: p.createdAt.toISOString(),
          })),
        },
        offspring: {
          total: offspringFromPlans.length,
          items: offspringFromPlans.map((o) => ({
            id: o.id,
            name: o.name,
            sex: o.sex,
            birthDate: o.birthDate?.toISOString(),
            fromDam: o.damId === listing.animal?.id,
            fromSire: o.sireId === listing.animal?.id,
            createdAt: o.createdAt.toISOString(),
          })),
        },
      });
    } catch (err) {
      console.error("Failed to get conversion funnel:", err);
      return reply.code(500).send({ error: "funnel_failed" });
    }
  });

  // GET /breeding-analytics/inquiry-sources - Inquiry attribution (UTM tracking)
  app.get("/breeding-analytics/inquiry-sources", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    try {
      // Get all inquiries with UTM data
      const inquiries = await prisma.breedingInquiry.findMany({
        where: { tenantId },
        select: {
          id: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          referrerUrl: true,
          status: true,
          convertedToBookingId: true,
        },
      });

      // Group by source
      const bySource = new Map<string, { count: number; converted: number }>();
      inquiries.forEach((inquiry) => {
        const source = inquiry.utmSource || "direct";
        const existing = bySource.get(source) || { count: 0, converted: 0 };
        existing.count++;
        if (inquiry.convertedToBookingId) {
          existing.converted++;
        }
        bySource.set(source, existing);
      });

      // Group by medium
      const byMedium = new Map<string, { count: number; converted: number }>();
      inquiries.forEach((inquiry) => {
        const medium = inquiry.utmMedium || "none";
        const existing = byMedium.get(medium) || { count: 0, converted: 0 };
        existing.count++;
        if (inquiry.convertedToBookingId) {
          existing.converted++;
        }
        byMedium.set(medium, existing);
      });

      // Group by campaign
      const byCampaign = new Map<string, { count: number; converted: number }>();
      inquiries.forEach((inquiry) => {
        if (inquiry.utmCampaign) {
          const existing = byCampaign.get(inquiry.utmCampaign) || { count: 0, converted: 0 };
          existing.count++;
          if (inquiry.convertedToBookingId) {
            existing.converted++;
          }
          byCampaign.set(inquiry.utmCampaign, existing);
        }
      });

      return reply.send({
        bySource: Array.from(bySource.entries()).map(([source, data]) => ({
          source,
          count: data.count,
          converted: data.converted,
          conversionRate: (data.converted / data.count) * 100,
        })),
        byMedium: Array.from(byMedium.entries()).map(([medium, data]) => ({
          medium,
          count: data.count,
          converted: data.converted,
          conversionRate: (data.converted / data.count) * 100,
        })),
        byCampaign: Array.from(byCampaign.entries()).map(([campaign, data]) => ({
          campaign,
          count: data.count,
          converted: data.converted,
          conversionRate: (data.converted / data.count) * 100,
        })),
      });
    } catch (err) {
      console.error("Failed to get inquiry sources:", err);
      return reply.code(500).send({ error: "sources_failed" });
    }
  });

  // GET /breeding-analytics/offspring-from-marketplace - Offspring tracking for marketplace-sourced breedings
  app.get("/breeding-analytics/offspring-from-marketplace", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    try {
      // Get all animals with offspring
      const animalsWithOffspring = await prisma.animal.findMany({
        where: {
          tenantId,
          OR: [
            { childrenAsDam: { some: {} } },
            { childrenAsSire: { some: {} } },
          ],
        },
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          sex: true,
          childrenAsDam: {
            select: {
              id: true,
              name: true,
              sex: true,
              birthDate: true,
              createdAt: true,
            },
          },
          childrenAsSire: {
            select: {
              id: true,
              name: true,
              sex: true,
              birthDate: true,
              createdAt: true,
            },
          },
          breedingBookingsOffering: {
            where: { sourceListingId: { not: null } },
            select: {
              id: true,
              bookingNumber: true,
              breedingPlanId: true,
              sourceListingId: true,
              sourceListing: {
                select: {
                  listingNumber: true,
                  headline: true,
                },
              },
            },
          },
        },
      });

      const results = animalsWithOffspring.map((animal) => {
        const totalOffspring = animal.childrenAsDam.length + animal.childrenAsSire.length;
        const marketplaceBookings = animal.breedingBookingsOffering.length;

        return {
          animalId: animal.id,
          animalName: animal.name,
          species: animal.species,
          breed: animal.breed,
          sex: animal.sex,
          totalOffspring,
          fromMarketplace: marketplaceBookings,
          marketplaceListings: animal.breedingBookingsOffering.map((b) => ({
            bookingId: b.id,
            bookingNumber: b.bookingNumber,
            listingNumber: b.sourceListing?.listingNumber,
            listingHeadline: b.sourceListing?.headline,
            breedingPlanId: b.breedingPlanId,
          })),
          offspring: [
            ...animal.childrenAsDam.map((o) => ({ ...o, role: "dam" })),
            ...animal.childrenAsSire.map((o) => ({ ...o, role: "sire" })),
          ],
        };
      });

      return reply.send({
        animals: results,
        summary: {
          totalAnimals: results.length,
          totalOffspring: results.reduce((sum, a) => sum + a.totalOffspring, 0),
          totalMarketplaceBookings: results.reduce((sum, a) => sum + a.fromMarketplace, 0),
        },
      });
    } catch (err) {
      console.error("Failed to get offspring analytics:", err);
      return reply.code(500).send({ error: "offspring_failed" });
    }
  });
};

export default routes;
