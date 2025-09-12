import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT ?? 6001);
const HOST = "0.0.0.0";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Build allowlist from env (comma-separated)
const allowedOriginsFromEnv = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Allow prod Contacts + preview URLs
const originAllowlist: (string | RegExp)[] = [
  ...allowedOriginsFromEnv,
  /^https:\/\/breederhq-contacts-.*\.vercel\.app$/ // previews (keep if useful)
];

// CORS (must be registered before any routes)
await app.register(cors, {
  hook: "onRequest",                  // handle preflight as early as possible
  origin: originAllowlist.length ? originAllowlist : true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["content-type", "x-admin-token"],
  credentials: true,
  strictPreflight: false,             // don’t be picky about preflight headers
  optionsSuccessStatus: 204
});

// --------------------------------------

// Health
app.get("/health", async () => ({ ok: true }));
app.get("/healthz", async () => ({ ok: true }));

// Admin guard
function requireAdmin(req: any, reply: any) {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!ADMIN_TOKEN) return reply.code(500).send({ error: "server_not_configured" });
  if (!token || token !== ADMIN_TOKEN) return reply.code(401).send({ error: "unauthorized" });
}

// Contacts
app.get("/api/v1/contacts", { preHandler: requireAdmin }, async () => {
  return prisma.contact.findMany();
});

app.post("/api/v1/contacts", { preHandler: requireAdmin }, async (req: any, reply) => {
  const body = req.body as Record<string, unknown>;
  const created = await prisma.contact.create({ data: body as any });
  return reply.code(201).send(created);
});

// Start
await app.listen({ port: PORT, host: HOST });
