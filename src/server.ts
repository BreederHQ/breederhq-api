// src/server.ts
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

// ---------- Env ----------
const PORT = parseInt(process.env.PORT || "3000", 10);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Allow *.vercel.app previews
const VERCEL_PREVIEW_RE = /\.vercel\.app$/i;

// Dev helpers for CORS
const IS_DEV = (process.env.BHQ_ENV || process.env.NODE_ENV) === "dev";
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

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
    if (!origin) return cb(null, true); // curl / server-to-server

    const allowed =
      ALLOWED_ORIGINS.includes(origin) ||
      VERCEL_PREVIEW_RE.test(origin) ||
      (IS_DEV && LOCALHOST_RE.test(origin));

    if (allowed) return cb(null, true);
    return cb(new Error("CORS: origin not allowed"), false);
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],   // 👈 preflight
  allowedHeaders: ["authorization","content-type"],            // 👈 allow token
});

if (ADMIN_TOKEN) {
  app.addHook("onRequest", async (req, reply) => {
    if (req.method === "OPTIONS") return; // 👈 let preflight through
    if (req.url === "/healthz" || req.url === "/__diag") return;

    if (req.url.startsWith("/api/v1/")) {
      const token = extractToken(req);
      if (!token || token !== ADMIN_TOKEN) {
        return reply.code(401).send({ error: "unauthorized" });
      }
    }
  });
}

// ---------- Health & Diagnostics ----------
app.get("/healthz", async () => ({ ok: true }));
app.get("/", async () => ({ ok: true }));
app.get("/__diag", async () => ({
  ok: true,
  time: new Date().toISOString(),
  env: {
    BHQ_ENV: process.env.BHQ_ENV || "unknown",
    NODE_ENV: process.env.NODE_ENV || "unknown",
    ALLOWED_ORIGINS,
    IS_DEV,
  },
}));

// ---------- Auth helpers ----------
function extractToken(req: FastifyRequest): string | null {
  const h = req.headers["authorization"];
  if (typeof h === "string" && h.toLowerCase().startsWith("bearer ")) {
    return h.slice(7).trim();
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

// Auth check endpoint
app.get("/auth/ping", { preHandler: requireAdmin }, async () => ({ ok: true }));

// Protect all /api/v1/* routes if ADMIN_TOKEN is configured
if (ADMIN_TOKEN) {
  app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/api/v1/")) {
      const token = extractToken(req);
      if (!token || token !== ADMIN_TOKEN) {
        return reply.code(401).send({ error: "unauthorized" });
      }
    }
  });
}

// ---------- Routes (static imports) ----------
import contactsRoutes from "./routes/contacts.js";
import animalsRoutes from "./routes/animals.js";
import breedingRoutes from "./routes/breeding.js";
import offspringRoutes from "./routes/offspring.js";

app.register(contactsRoutes);
app.register(animalsRoutes);
app.register(breedingRoutes);

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

// Always start when this file is run directly (ESM-safe for Render)
start();

// ---------- Shutdown ----------
process.on("SIGTERM", async () => {
  app.log.info("SIGTERM received, closing");
  await app.close();
  process.exit(0);
});
process.on("SIGINT", async () => {
  app.log.info("SIGINT received, closing");
  await app.close();
  process.exit(0);
});
