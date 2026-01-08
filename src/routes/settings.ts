// src/routes/settings.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";

export default async function settingsRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // POST /api/v1/settings/genetics-disclaimer - Save genetics disclaimer acceptance
  app.post<{ Body: { accepted: boolean; timestamp: string } }>(
    "/settings/genetics-disclaimer",
    async (req, reply) => {
      const actorId = getActorId(req);
      if (!actorId) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const { accepted } = req.body || {};
      
      if (!accepted) {
        return reply.code(400).send({ error: "acceptance_required" });
      }

      try {
        // Get IP and user agent for audit trail
        const ipAddress = req.headers['x-forwarded-for'] || req.ip || null;
        const userAgent = req.headers['user-agent'] || null;

        // Create the acceptance record
        await prisma.geneticsDisclaimerAcceptance.create({
          data: {
            userId: actorId,
            acceptedAt: new Date(),
            ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
            userAgent: userAgent,
          },
        });

        return reply.send({ ok: true });
      } catch (err: any) {
        console.error("Failed to save genetics disclaimer acceptance:", err);
        return reply.code(500).send({ error: "internal_server_error" });
      }
    }
  );

  // GET /api/v1/settings/genetics-disclaimer - Check if user has accepted disclaimer
  app.get("/settings/genetics-disclaimer", async (req, reply) => {
    const actorId = getActorId(req);
    if (!actorId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    try {
      const acceptance = await prisma.geneticsDisclaimerAcceptance.findFirst({
        where: { userId: actorId },
        orderBy: { acceptedAt: "desc" },
        select: {
          acceptedAt: true,
        },
      });

      return reply.send({
        accepted: !!acceptance,
        acceptedAt: acceptance?.acceptedAt?.toISOString() || null,
      });
    } catch (err: any) {
      console.error("Failed to check genetics disclaimer acceptance:", err);
      return reply.code(500).send({ error: "internal_server_error" });
    }
  });
}
