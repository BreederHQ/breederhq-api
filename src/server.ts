// src/server.ts
import Fastify from "fastify";
import cors from "@fastify/cors";

const PORT = Number(process.env.PORT ?? 6001);
const HOST = process.env.HOST ?? "0.0.0.0";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";
const allowedFromEnv = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",").map(s => s.trim()).filter(Boolean);

const app = Fastify({ logger: true });

// CORS early + preflight for x-admin-token
await app.register(cors, {
  hook: "onRequest",
  origin: allowedFromEnv.length ? allowedFromEnv : true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["content-type","x-admin-token"],
  credentials: true,
  strictPreflight: false,
  optionsSuccessStatus: 204
});

// Health
app.get("/health", async () => ({ ok: true }));
app.get("/healthz", async () => ({ ok: true }));
app.get("/__diag", async () => ({
  tag: "bhq-diag-v1",
  commit: process.env.RENDER_GIT_COMMIT ?? null,
  time: new Date().toISOString()
}));


// Admin guard
function requireAdmin(req: any, reply: any) {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!ADMIN_TOKEN) return reply.code(500).send({ error: "server_not_configured" });
  if (!token || token !== ADMIN_TOKEN) return reply.code(401).send({ error: "unauthorized" });
}

// ✅ DIAGNOSTIC: return immediately (no Prisma/DB)
app.get("/api/v1/contacts", { preHandler: requireAdmin }, async (req) => {
  req.log.info("contacts route hit (diagnostic)");
  return []; // proves request flows after admin check
});

process.on("SIGINT", async () => { await app.close().catch(()=>{}); process.exit(0); });
process.on("SIGTERM", async () => { await app.close().catch(()=>{}); process.exit(0); });

await app.listen({ port: PORT, host: HOST });
app.log.info(`API running on http://${HOST}:${PORT}`);
if (allowedFromEnv.length === 0) app.log.warn("ALLOWED_ORIGINS is empty; browser Origins will be blocked.");
