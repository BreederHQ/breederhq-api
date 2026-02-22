// src/routes/international-waitlist.ts
// International waitlist endpoint — captures email + country from users in
// regions where BreederHQ is not yet available. No authentication required.
//
// Endpoints:
//   POST /api/v1/marketplace/international-waitlist  — join the waitlist
//
// Security:
//   - Public endpoint (no auth required — user can't register yet)
//   - Rate-limited: 5 requests/minute per IP
//   - Country "US" is rejected (use /marketplace/auth/register instead)
//   - Upserts on email+country to prevent duplicates

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import prisma from "../prisma.js";

// ISO 3166-1 alpha-2 codes (2 uppercase letters) or "OTHER" for unlisted countries
const COUNTRY_CODE_RE = /^([A-Z]{2}|OTHER)$/;

export default async function internationalWaitlistRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.post("/", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const {
      email = "",
      country = "",
      countryName = "",
      firstName = "",
      lastName = "",
      source = "registration_gate",
    } = (req.body || {}) as {
      email?: string;
      country?: string;
      countryName?: string;
      firstName?: string;
      lastName?: string;
      source?: string;
    };

    const e = String(email).trim().toLowerCase();
    const c = String(country).trim().toUpperCase();
    const cn = String(countryName || "").trim().slice(0, 100);
    const fn = String(firstName || "").trim().slice(0, 100);
    const ln = String(lastName || "").trim().slice(0, 100);
    const src = String(source || "registration_gate").trim().slice(0, 50);

    // Validate email
    if (!e || !e.includes("@")) {
      return reply.code(400).send({ error: "email_required", message: "A valid email address is required." });
    }

    // Validate country code format
    if (!c || !COUNTRY_CODE_RE.test(c)) {
      return reply.code(400).send({ error: "country_required", message: "A valid country code is required." });
    }

    // Reject US registrations — they should use the main registration flow
    if (c === "US") {
      return reply.code(400).send({
        error: "country_already_supported",
        message: "The United States is supported. Please register at /marketplace/auth/register.",
      });
    }

    // Upsert: update existing entry's name/source if they sign up again
    await prisma.$queryRaw`
      INSERT INTO marketplace.international_waitlist
        (email, first_name, last_name, country, country_name, source, updated_at)
      VALUES
        (${e}, ${fn || null}, ${ln || null}, ${c}, ${cn || null}, ${src}, NOW())
      ON CONFLICT (email, country)
      DO UPDATE SET
        first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), marketplace.international_waitlist.first_name),
        last_name  = COALESCE(NULLIF(EXCLUDED.last_name, ''),  marketplace.international_waitlist.last_name),
        country_name = COALESCE(NULLIF(EXCLUDED.country_name, ''), marketplace.international_waitlist.country_name),
        updated_at = NOW()
    `;

    return reply.code(200).send({ ok: true });
  });
}
