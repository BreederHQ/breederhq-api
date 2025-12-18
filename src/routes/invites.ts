// src/routes/invites.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "../prisma.js";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
function randomToken(len = 24) {
  return crypto.randomBytes(len).toString("base64url");
}
async function requireAdminToken(req: FastifyRequest, reply: FastifyReply) {
  const hdr = req.headers["authorization"] || req.headers["x-admin-token"];
  const got = typeof hdr === "string" && hdr.startsWith("Bearer ") ? hdr.slice(7) : (hdr as string | undefined);
  if (ADMIN_TOKEN && got === ADMIN_TOKEN) return;
  return reply.code(403).send({ message: "Forbidden" });
}

export default async function invitesRoutes(app: FastifyInstance) {
  // Create invite (admin-only)
  app.post("/api/v1/account/invites", { preHandler: [requireAdminToken] }, async (req, reply) => {
    const body = z.object({
      email: z.string().email(),
      organizationId: z.number().int().optional(),
      role: z.enum(["ADMIN", "STAFF", "MEMBER", "VIEWER"]).optional(),
      ttlMinutes: z.number().min(5).max(60 * 24 * 14).default(60 * 24 * 7),
    }).parse(req.body);

    const token = randomToken(24);
    const expiresAt = new Date(Date.now() + body.ttlMinutes * 60_000);

    const invite = await prisma.invite.create({
      data: {
        email: body.email.toLowerCase(),
        organizationId: body.organizationId ?? null,
        role: body.role ?? "STAFF",
        token,
        expiresAt,
      },
      select: { id: true, token: true, expiresAt: true },
    });

    const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:6170";
    const link = `${WEB_ORIGIN}/invite?token=${encodeURIComponent(invite.token)}`;

    return reply.code(201).send({ id: invite.id, token: invite.token, link, expiresAt: invite.expiresAt });
  });

  // Prefill lookup
  app.get("/api/v1/account/invites/:token", async (req, reply) => {
    const { token } = z.object({ token: z.string() }).parse(req.params);
    const inv = await prisma.invite.findUnique({
      where: { token },
      select: { email: true, organizationId: true, expiresAt: true, consumedAt: true },
    });
    if (!inv || inv.consumedAt || inv.expiresAt < new Date()) {
      return reply.code(404).send({ message: "Invite not found or expired." });
    }
    return reply.send({ email: inv.email, organizationId: inv.organizationId });
  });
}
