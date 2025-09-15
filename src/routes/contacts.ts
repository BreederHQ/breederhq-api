// src/routes/contacts.ts
import prisma from "../prisma.js";
import type { FastifyPluginCallback } from "fastify";
import prisma from "../prisma.js";



const contactsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // GET /api/v1/contacts
  app.get("/contacts", async (_req, reply) => {
    const contacts = await prisma.contact.findMany({ orderBy: { createdAt: "desc" } });
    reply.send(contacts);
  });

  // POST /api/v1/contacts
  app.post("/contacts", async (req, reply) => {
    const token = req.headers["x-admin-token"];
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const { firstName, lastName, email, phone } = (req.body as any) ?? {};
    if (!firstName || !lastName || !email) {
      return reply.code(400).send({ error: "firstName, lastName, and email are required" });
    }
    const created = await prisma.contact.create({ data: { firstName, lastName, email, phone } });
    reply.code(201).send(created);
  });

  done();
};

export default contactsRoutes;

