// src/server.ts
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------- Env ----------
const PORT = parseInt(process.env.PORT || "3000", 10);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Allow all *.vercel.app previews in addition to explicit allowlist
const VERCEL_PREVIEW_RE = /\.vercel\.app$/i;

// ---------- App ----------
const app: FastifyInstance = Fastify({
  logger: true,
  trustProxy: true,
});

// ---------- Security ----------
await app.register(helmet, {
  contentSecurityPolicy: false,
});

// ---------- CORS ----------
await app.register(cors, {
  origin: (origin, cb) => {
    // No origin in server-to-server or curl: allow
    if (!origin) return cb(null, true);

    const allowed =
      ALLOWED_ORIGINS.includes(origin) || VERCEL_PREVIEW_RE.test(origin);

    if (allowed) return cb(null, true);
    return cb(new Error("CORS: origin not allowed"), false);
  },
  credentials: true,
});

// ---------- Health & Diagnostics ----------
app.get("/healthz", async () => ({ ok: true }));
app.get("/__diag", async () => ({
  ok: true,
  time: new Date().toISOString(),
  env: {
    BHQ_ENV: process.env.BHQ_ENV || "unknown",
    NODE_ENV: process.env.NODE_ENV || "unknown",
  },
}));

// ---------- Auth helpers ----------
function extractToken(req: FastifyRequest): string | null {
  const header = req.headers["authorization"];
  if (header && typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  const x = req.headers["x-admin-token"];
  if (typeof x === "string" && x.trim()) return x.trim();
  return null;
}

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const token = extractToken(req);
  if (!token || token !== ADMIN_TOKEN) {
    return reply.code(401).send({ error: "unauthorized" });
  }
}

// Uptime check that requires Bearer/x-admin-token
app.get("/auth/ping", { preHandler: requireAdmin }, async () => ({ ok: true }));

// ---------- Route registration utility ----------
async function safeRegisterRoute(
  modulePath: string,
  label: string
): Promise<void> {
  try {
    const mod = await import(modulePath);
    const plugin = mod.default ?? mod;
    if (typeof plugin !== "function") {
      app.log.warn(`${label} route not a function, skipping`);
      return;
    }
    await app.register(plugin);
    app.log.info(`Registered ${label} routes`);
  } catch (err: any) {
    app.log.warn(
      { err: String(err?.message || err) },
      `Could not register ${label} routes (ok to skip if not ready)`
    );
  }
}

// ---------- Global auth for API routes ----------
// Require token for all /api/v1/* routes
app.addHook("onRequest", async (req, reply) => {
  if (req.url.startsWith("/api/v1/")) {
    const token = extractToken(req);
    if (!token || token !== ADMIN_TOKEN) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  }
});

// ---------- Register feature modules ----------
// Contacts (existing, required)
// Keep your current contacts implementation in src/routes/contacts.ts
await safeRegisterRoute("./routes/contacts", "contacts");

// Animals (new, optional until file exists)
await safeRegisterRoute("./routes/animals", "animals");

// Breeding (new, optional until file exists)
await safeRegisterRoute("./routes/breeding", "breeding");

// ---------- Start ----------
export async function start() {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`API listening on :${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Only start if run directly
if (require.main === module) {
  start();
}

// ---------- Graceful shutdown ----------
process.on("SIGTERM", async () => {
  app.log.info("SIGTERM received, closing");
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});
process.on("SIGINT", async () => {
  app.log.info("SIGINT received, closing");
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});
