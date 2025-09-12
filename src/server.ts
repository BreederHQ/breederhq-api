// src/server.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";

// ----- config/env -----
const PORT = Number(process.env.PORT ?? 6001);
const HOST = "0.0.0.0";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

const allowedOriginsFromEnv = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Allow prod Contacts + (optional) preview URLs on Vercel
const originAllowlist: (string | RegExp)[] = [
  ...allowedOriginsFromEnv,
  /^https:\/\/breederhq-contacts-.*\.vercel\.app$/ // remove if you don't want previews
];

// ----- app & db -----
const app = Fastify({ logger: true });
// before:
// const prisma = new PrismaClient({ log: ["warn", "error"] });

// after (TEMPORARY for debug; we’ll turn "query" off later):
const prisma = new PrismaClient({ log: ["query", "warn", "error"] });

function warnIfDbNotPooled() {
  const urlStr = process.env.DATABASE_URL;
  if (!urlStr) {
    app.log.warn("DATABASE_URL is not set.");
    return;
  }
  try {
    const u = new URL(urlStr);
    const looksPooled = u.hostname.includes("pooler");
    const pgbouncer = u.searchParams.get("pgbouncer") === "true";
    if (!looksPooled || !pgbouncer) {
      app.log.warn(
        "DATABASE_URL may not be using Neon pooled/PgBouncer. " +
          "Runtime should use the pooled host and include pgbouncer=true. " +
          "Migrations should use the direct (non-pooled) URL."
      );
    }
  } catch {
    app.log.warn("DATABASE_URL is not a valid URL.");
  }
}
warnIfDbNotPooled();

// ----- CORS (must be registered BEFORE routes) -----
await app.register(cors, {
  hook: "onRequest", // handle preflight as early as possible
  origin: originAllowlist.length ? originAllowlist : true, // allow all if empty (dev)
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["content-type", "x-admin-token"],
  credentials: true,
  strictPreflight: false,
  optionsSuccessStatus: 204
});

// ----- health -----
app.get("/health", async () => ({ ok: true }));
app.get("/healthz", async () => ({ ok: true }));

// quick DB ping
app.get("/db/ping", async (req, reply) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return reply.code(200).send({ ok: true });
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ ok: false });
  }
});

// ----- admin guard -----
function requireAdmin(req: any, reply: any) {
  const token = (req.headers["x-admin-token"] as string | undefined) ?? "";
  if (!ADMIN_TOKEN) {
    req.log.warn("ADMIN_TOKEN is not set; rejecting admin route");
    return reply.code(500).send({ error: "server_not_configured" });
  }
  if (!token || token !== ADMIN_TOKEN) {
    return reply.code(401).send({ error: "unauthorized" });
  }
}

// ----- contacts routes (adjust model name if needed) -----
app.get("/api/v1/contacts", { preHandler: requireAdmin }, async () => {
  // assumes a Prisma model named `Contact`
  return prisma.contact.findMany();
});

app.post("/api/v1/contacts", { preHandler: requireAdmin }, async (req: any, reply) => {
  try {
    const body = req.body as Record<string, unknown>;
    // TODO: add zod validation for body
    const created = await prisma.contact.create({ data: body as any });
    return reply.code(201).send(created);
  } catch (err) {
    req.log.error(err);
    return reply.code(400).send({ error: "bad_request" });
  }
});

// ----- graceful shutdown -----
const shutdown = async () => {
  app.log.info("Shutting down…");
  try { await prisma.$disconnect(); } catch {}
  try { await app.close(); } catch {}
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ----- start (fail fast if DB is unreachable) -----
async function connectPrismaOrExit() {
  const timer = setTimeout(() => {
    app.log.error("Prisma connect timed out");
    process.exit(1);
  }, 10_000);
  try {
    await prisma.$connect();
    app.log.info("Prisma connected");
  } catch (e) {
    app.log.error({ err: e }, "Prisma connect failed");
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

try {
  await connectPrismaOrExit();
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`API running on http://${HOST}:${PORT}`);
  if (allowedOriginsFromEnv.length === 0) {
    app.log.warn("ALLOWED_ORIGINS is empty; browser requests with Origin will be blocked.");
  }
} catch (err) {
  app.log.error({ err }, "Failed to start server");
  process.exit(1);
}
