import Fastify from "fastify";
import cors from "@fastify/cors";
import contactsRoutes from "./routes/contacts.js";

const app = Fastify({ logger: true });

// CORS so Vite apps on 6003/6004/6005 can call this API
await app.register(cors, {
  origin: [
    "http://localhost:6003", // contacts app
    "http://localhost:6004", // animals app
    "http://localhost:6005", // breeding app
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-admin-token"],
});

// Log the admin token once so you can verify it matches your client
console.log("ADMIN_TOKEN (server):", JSON.stringify(process.env.ADMIN_TOKEN));

// Health
app.get("/healthz", async () => ({ ok: true }));
app.get("/health", async (_, reply) => reply.redirect(308, "/healthz"));

// Versioned API
app.register(contactsRoutes, { prefix: "/api/v1" });

// Backward compatibility: keep old /contacts working for now
app.all("/contacts", async (req, reply) => {
  const url = "/api/v1/contacts";
  if (req.method === "GET") return reply.redirect(308, url);
  return reply.redirect(308, url);
});

// Print mounted routes once everything is ready
app.ready().then(() => app.printRoutes());

const port = Number(process.env.PORT ?? 6001); // use 6001 for new dev
app.listen({ port, host: "0.0.0.0" })
  .then(() => console.log(`API listening on :${port}`))
  .catch(err => {
    app.log.error(err);
    process.exit(1);
  });
