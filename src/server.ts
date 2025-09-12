// src/server.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";

// -------- env / config --------
const PORT = Number(process.env.PORT ?? 6001);
const HOST = process.env.HOST ?? "0.0.0.0";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

// Build CORS allowlist from env (comma-separated)
const allowedFromEnv = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Allow prod Contacts + Vercel preview URLs (optional)
const originAllowlist: (string | RegExp)[] = [
  ...allowedFromEnv,
  /^https:\/\/breederhq-contacts-.*\.vercel\.app$/ // remove if not desired
];

// -------- app / db --------
const app = Fastify({ logger: true });

// Set to ["query","warn","error"] temporarily if you need verbose Prisma logs
const prisma = new PrismaClient({ log: ["warn", "error"] });

// Warn if runtime DB URL isn't pooled/pgbouncer
(function warnIfDbNotPooled() {
  const url = process.env.DATABASE_URL || "";
  try {
    const u = new URL(url);
    const looksPooled = u.hostname.includes("pooler");
    const pgbouncer = u.searchParams.get("pgbouncer") === "true";
    if (!looksPooled || !pgbouncer) {
      app.log.warn(
        "DATABASE_URL may not be using Neon pooled/PgBouncer. " +
        "Use pooled host + pgbouncer=true in production runtime."
      );
    }
  } catch {
    if (!url) app.log.warn("DATABASE_URL is not set.");
  }
})();

// -------- CORS (must be before routes) --------
await app.register(cors, {
  hook: "onRequest",
  origin: originAllowlist.length ? originAllowlist : true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["content-type", "x-admin-token"],
  credentials: true,
  strictPreflight: false,
  optionsSuccessStatus: 204
});

// -------- health / db probes --------
app.get("/health", async () => ({ ok: true }));
app.get("/healthz", async () => ({ ok: true }));

app.get("/db/ping", async (req, reply) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return reply.code(200).send({ ok: true });
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ ok: false });
  }
});

// Raw count bypasses model mapping (handy for debugging table/perm issues)
app.get("/db/contacts-count", async (req, reply) => {
  try {
    const rows = await prisma.$queryRawUnsafe<{ count: string }[]>(
      'SELECT COUNT(*)::text AS count FROM "Contact";'
    );
    return reply.code(200).send({ count: rows?.[0]?.count ?? "0" });
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ ok: false, error: "count_failed" });
  }
});

// -------- admin guard --------
function requireAdmin(req: any, reply: any) {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!ADMIN_TOKEN) {
    req.log.warn("ADMIN_TOKEN not set");
    return reply.code(500).send({ error: "server_not_configured" });
  }
  if (!token || token !== ADMIN_TOKEN) {
    return reply.code(401).send({ error: "unauthorized" });
  }
}

// -------- helpers --------
function withTimeout<T>(p: Promise<T>, ms = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`query_timeout_${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); },
           e => { clearTimeout(t); reject(e); });
  });
}

// -------- contacts routes --------
// Prefer model query; if it stalls/fails, fall back to raw SQL.
// Also set per-transaction statement_timeout to prevent backend hangs.
app.get("/api/v1/contacts", { preHandler: requireAdmin }, async (req, reply) => {
  try {
    const data = await withTimeout(
      prisma.$transaction([
        prisma.$executeRawUnsafe("SET LOCAL statement_timeout = 10000"),
        prisma.contact.findMany({ take: 200 })
      ]).then(([, rows]) => rows),
      12_000
    );
    return data;
  } catch (e) {
    req.log.warn({ err: e }, "findMany failed/stalled; using raw fallback");
    try {
      const raw = await withTimeout(
        prisma.$transaction([
          prisma.$executeRawUnsafe("SET LOCAL statement_timeout = 10000"),
          prisma.$queryRawUnsafe('SELECT * FROM "Contact" ORDER BY 1 DESC LIMIT 200')
        ]).then(([, rows]) => rows as unknown[]),
        12_000
      );
      return raw;
    } catch (e2) {
      req.log.error({ err: e2 }, "raw fallback failed");
      return reply.code(504).send({ error: "db_timeout" });
    }
  }
});

app.post("/api/v1/contacts", { preHandler: requireAdmin }, async (req: any, reply) => {
  try {
    const body = req.body as Record<string, unknown>;
    const created = await withTimeout(
      prisma.$transaction([
        prisma.$executeRawUnsafe("SET LOCAL statement_timeout = 10000"),
        prisma.contact.create({ data: body as any })
      ]).then(([, row]) => row),
      12_000
    );
    return reply.code(201).send(created);
  } catch (err) {
    req.log.error({ err }, "create contact failed");
    return reply.code(400).send({ error: "bad_request" });
  }
});

// -------- graceful shutdown --------
const shutdown = async () => {
  app.log.info("Shutting down…");
  try { await prisma.$disconnect(); } catch {}
  try { await app.close(); } catch {}
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// -------- start (fail fast if DB unreachable) --------
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

await connectPrismaOrExit();
await app.listen({ port: PORT, host: HOST });
app.log.info(`API running on http://${HOST}:${PORT}`);
if (allowedFromEnv.length === 0) {
  app.log.warn("ALLOWED_ORIGINS is empty; browser requests with Origin will be blocked.");
}
