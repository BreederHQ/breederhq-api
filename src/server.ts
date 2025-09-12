// src/server.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT ?? 6001);
const HOST = "0.0.0.0";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Build allowlist from env (comma-separated)
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// --- CORS (must be registered BEFORE routes) ---
await app.register(cors, {
  origin: (origin, cb) => {
    // allow curl/server-to-server (no Origin)
    if (!origin) return cb(null, true);

    // exact allowlist from env
    if (allowedOrigins.includes(origin)) return cb(null, true);

    // optional: allow Vercel preview URLs for Contacts (comment out if not desired)
    if (/^https:\/\/breederhq-contacts-.*\.vercel\.app$/.test(origin)) return cb(null, true);

    cb(new Error("Not allowed by CORS"), false);
  },
  // allow common verbs + preflight
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  // allow our custom header used by admin routes
  allowedHeaders: ["Content-Type", "x-admin-token", "X-Admin-Token"],
  credentials: true
});
// ------------------------------------------------

// Health endpoints
app.get("/health", async () => ({ ok: true }));
app.get("/healthz", async () => ({ ok: true }));

// Simple admin header guard
function requireAdmin(req: any, reply: any) {
  const token = (req.headers["x-admin-token"] ??
    req.headers["X-Admin-Token"]) as string | undefined;

  if (!ADMIN_TOKEN) {
    req.log.warn("ADMIN_TOKEN is not set; rejecting admin route");
    return reply.code(500).send({ error: "server_not_configured" });
  }
  if (!token || token !== ADMIN_TOKEN) {
    return reply.code(401).send({ error: "unauthorized" });
  }
}

// Contacts routes (adjust to your Prisma schema as needed)
app.get("/api/v1/contacts", { preHandler: requireAdmin }, async () => {
  const contacts = await prisma.contact.findMany(); // assumes model Contact exists
  return contacts; // [] if none
});

// (optional) example create route
app.post("/api/v1/contacts", { preHandler: requireAdmin }, async (req: any, reply) => {
  try {
    const body = req.body as {
      firstName?: string;
      lastName?: string;
      email?: string | null;
      [k: string]: unknown;
    };
    // TODO: add zod validation when ready
    const created = await prisma.contact.create({ data: body as any });
    return reply.code(201).send(created);
  } catch (err) {
    req.log.error(err);
    return reply.code(400).send({ error: "bad_request" });
  }
});

// Graceful shutdown
const shutdown = async () => {
  app.log.info("Shutting down…");
  await prisma.$disconnect().catch(() => {});
  await app.close().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start server
try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`API running on http://${HOST}:${PORT}`);
  if (allowedOrigins.length === 0) {
    app.log.warn("ALLOWED_ORIGINS is empty; browser requests with Origin will be blocked.");
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
