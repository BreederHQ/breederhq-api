// src/server.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";

/* ---------- ENV / CONFIG ---------- */
const PORT = Number(process.env.PORT ?? 6001);
const HOST = process.env.HOST ?? "0.0.0.0";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";
const allowedFromEnv = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

function warnIfDbNotPooled(log: ReturnType<typeof Fastify>["log"]) {
  const url = process.env.DATABASE_URL || "";
  try {
    const u = new URL(url);
    const looksPooled = u.hostname.includes("pooler");
    const pgbouncer = u.searchParams.get("pgbouncer") === "true";
    if (!looksPooled || !pgbouncer) {
      log.warn(
        "DATABASE_URL may not be Neon pooled. Use pooled host and add pgbouncer=true."
      );
    }
  } catch {
    if (!url) log.warn("DATABASE_URL is not set.");
  }
}

/* ---------- APP / DB ---------- */
const app = Fastify({ logger: true });
warnIfDbNotPooled(app.log);

// keep logs quiet in prod; switch to ["query","warn","error"] if you need to debug
const prisma = new PrismaClient({ log: ["warn", "error"] });

/* ---------- CORS (before routes) ---------- */
const originAllowlist: (string | RegExp)[] = [
  ...allowedFromEnv,
  // Vercel preview URLs for Contacts (optional)
  /^https:\/\/breederhq-contacts-.*\.vercel\.app$/,
];

await app.register(cors, {
  hook: "onRequest",
  origin: originAllowlist.length ? originAllowlist : true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["content-type", "x-admin-token"],
  credentials: true,
  strictPreflight: false,
  optionsSuccessStatus: 204,
});

/* ---------- HEALTH & DIAG ---------- */
app.get("/health", async () => ({ ok: true }));
app.get("/healthz", async () => ({ ok: true }));
app.get("/__diag", async () => ({
  tag: "bhq-api-v1",
  commit: process.env.RENDER_GIT_COMMIT ?? null,
  time: new Date().toISOString(),
}));

/* ---------- ADMIN GUARD & AUTH PING ---------- */
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

// proves header passes without touching DB
app.get("/auth/ping", { preHandler: requireAdmin }, async () => ({ ok: true }));

/* ---------- DB PROBES ---------- */
app.get("/db/ping", async (req, reply) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return reply.code(200).send({ ok: true });
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ ok: false });
  }
});

app.get("/db/contacts-count", async (req, reply) => {
  try {
    const rows = await prisma.$queryRawUnsafe<{ count: string }[]>(
      'SELECT COUNT(*)::text AS count FROM "Contact";'
    );
    return reply.code(200).send({ count: Number(rows?.[0]?.count ?? "0") });
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ ok: false, error: "count_failed" });
  }
});

/* ---------- HELPERS ---------- */
function withTimeout<T>(p: Promise<T>, ms = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`query_timeout_${ms}ms`)), ms);
    p.then(
      v => {
        clearTimeout(t);
        resolve(v);
      },
      e => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}
const safeIdent = (s: string) => s.replace(/[^A-Za-z0-9_]/g, "");

/* ---------- CONTACTS (raw-first, timeboxed) ---------- */
// GET /api/v1/contacts?limit=50&cursor=<id>&fields=id,firstName,lastName,email
app.get("/api/v1/contacts", { preHandler: requireAdmin }, async (req, reply) => {
  const q = req.query as { limit?: string; cursor?: string; fields?: string };
  const limit = Math.min(Math.max(Number(q?.limit ?? 50), 1), 200);
  const cursorId: string | undefined =
    q?.cursor && String(q.cursor).length ? String(q.cursor) : undefined;

  const fields = (q?.fields ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  // RAW SQL path first (fast, no ORM quirks)
  try {
    const cols = fields.length ? fields.map(f => `"${safeIdent(f)}"`).join(",") : "*";
    const where = cursorId ? `WHERE "id" < $1` : "";
    const params = cursorId ? [cursorId] : [];

    const rows = await withTimeout(
      prisma.$transaction([
        prisma.$executeRawUnsafe("SET LOCAL statement_timeout = 10000"),
        prisma.$queryRawUnsafe(
          `SELECT ${cols} FROM "Contact" ${where} ORDER BY "id" DESC LIMIT ${limit};`,
          ...params
        ),
      ]).then(([, r]) => r as unknown[]),
      12_000
    );

    const nextCursor =
      rows.length ? String((rows[rows.length - 1] as any).id ?? "") : null;

    return reply.send({ data: rows, nextCursor });
  } catch (e) {
    // Fallback to Prisma model (still timeboxed)
    req.log.warn({ err: e }, "raw list failed; trying Prisma model");

    try {
      const select =
        fields.length > 0
          ? (Object.fromEntries(fields.map(f => [f, true])) as any)
          : undefined;

      const data = await withTimeout(
        prisma.$transaction([
          prisma.$executeRawUnsafe("SET LOCAL statement_timeout = 10000"),
          prisma.contact.findMany({
            take: limit,
            ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
            orderBy: { id: "desc" },
            ...(select ? { select } : {}),
          }),
        ]).then(([, rows]) => rows),
        12_000
      );

      const nextCursor =
        Array.isArray(data) && data.length
          ? String((data[data.length - 1] as any).id ?? "")
          : null;

      return reply.send({ data, nextCursor });
    } catch (e2) {
      req.log.error({ err: e2 }, "contacts list failed (raw and model)");
      return reply.code(504).send({ error: "db_timeout" });
    }
  }
});

// POST /api/v1/contacts  { firstName, lastName, email? }
app.post("/api/v1/contacts", { preHandler: requireAdmin }, async (req: any, reply) => {
  const b = req.body as { firstName?: string; lastName?: string; email?: string | null };

  if (!b?.firstName || !b?.lastName) {
    return reply
      .code(400)
      .send({ error: "validation_error", details: "firstName and lastName are required" });
  }

  // RAW insert first (fast), fallback to Prisma
  try {
    const rows = await withTimeout(
      prisma.$transaction([
        prisma.$executeRawUnsafe("SET LOCAL statement_timeout = 10000"),
        prisma.$queryRawUnsafe(
          'INSERT INTO "Contact" ("firstName","lastName","email") VALUES ($1,$2,$3) RETURNING *',
          b.firstName,
          b.lastName,
          b.email ?? null
        ),
      ]).then(([, r]) => r as any[]),
      12_000
    );
    return reply.code(201).send(rows[0]);
  } catch (e) {
    req.log.warn({ err: e }, "raw create failed; trying Prisma model");
    try {
      const created = await withTimeout(
        prisma.$transaction([
          prisma.$executeRawUnsafe("SET LOCAL statement_timeout = 10000"),
          prisma.contact.create({
            data: {
              firstName: b.firstName,
              lastName: b.lastName,
              email: b.email ?? null,
            } as any,
          }),
        ]).then(([, row]) => row),
        12_000
      );
      return reply.code(201).send(created);
    } catch (e2) {
      req.log.error({ err: e2 }, "create failed (raw and model)");
      return reply.code(400).send({ error: "bad_request" });
    }
  }
});

/* ---------- SHUTDOWN ---------- */
const shutdown = async () => {
  app.log.info("Shutting down…");
  try { await prisma.$disconnect(); } catch {}
  try { await app.close(); } catch {}
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/* ---------- STARTUP ---------- */
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
  app.log.warn("ALLOWED_ORIGINS is empty; browser Origins will be blocked.");
}
