import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { validateShareCode } from "../services/share-codes.js";
import prisma from "../prisma.js";

// ─────────────────────────────────────────────────────────────────────────────
// Public Share Code Preview Route
// GET /api/v1/public/share-codes/:code/preview
//
// Returns non-sensitive animal preview data for a share code.
// No authentication required — used by the marketing site landing page.
// ─────────────────────────────────────────────────────────────────────────────

// Simple in-memory rate limiter (10 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// Periodic cleanup of expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60_000);

const publicSharePreviewRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
) => {
  app.get("/share-codes/:code/preview", async (req, reply) => {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip;

    if (!checkRateLimit(ip)) {
      return reply
        .code(429)
        .header("Retry-After", "60")
        .send({ valid: false, error: "rate_limit_exceeded" });
    }

    const { code } = req.params as { code: string };

    if (!code || typeof code !== "string" || code.length < 5) {
      return reply.code(400).send({ valid: false, error: "invalid_code" });
    }

    const result = await validateShareCode(code);

    if (!result.valid || !result.shareCode) {
      const statusCode = result.error === "code_not_found" ? 404 : 410;
      return reply
        .code(statusCode)
        .send({ valid: false, error: result.error });
    }

    const sc = result.shareCode;

    // Fetch animal basic info (non-sensitive fields only)
    const animals = await prisma.animal.findMany({
      where: { id: { in: sc.animalIds } },
      select: {
        name: true,
        species: true,
        breed: true,
        sex: true,
        birthDate: true,
        photoUrl: true,
      },
    });

    // Fetch tenant name (breeder name)
    const tenant = await prisma.tenant.findUnique({
      where: { id: sc.tenantId },
      select: {
        name: true,
        networkVisibility: true,
      },
    });

    // Respect network visibility — anonymous breeders show masked name
    const breederName =
      tenant?.networkVisibility === "ANONYMOUS"
        ? "A breeder"
        : tenant?.networkVisibility === "HIDDEN"
          ? "A breeder"
          : tenant?.name || "A breeder";

    return reply
      .header("Cache-Control", "public, max-age=300")
      .send({
        valid: true,
        animals: animals.map((a) => ({
          name: a.name,
          species: a.species,
          breed: a.breed,
          sex: a.sex,
          photoUrl: a.photoUrl || null,
          birthDate: a.birthDate
            ? a.birthDate.toISOString().split("T")[0]
            : null,
        })),
        breederName,
        animalCount: animals.length,
        accessTier: sc.defaultAccessTier,
        expiresAt: sc.expiresAt ? sc.expiresAt.toISOString() : null,
      });
  });
};

export default publicSharePreviewRoutes;
