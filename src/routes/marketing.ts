// src/routes/marketing.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { sendEmail } from "../services/email-service.js";

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /marketing/email/send - Send outbound email via Resend
  app.post("/marketing/email/send", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

    const { to, subject, html, text, templateKey, metadata } = req.body as any;

    if (!to || !subject) {
      return reply.code(400).send({ error: "missing_required_fields", required: ["to", "subject"] });
    }

    if (!html && !text) {
      return reply.code(400).send({ error: "missing_email_body", required: "html or text" });
    }

    try {
      const result = await sendEmail({
        tenantId,
        to,
        subject,
        html,
        text,
        templateKey,
        metadata,
      });

      if (!result.ok) {
        return reply.code(400).send({ error: result.error });
      }

      return reply.send({
        ok: true,
        messageId: result.providerMessageId,
      });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });
};

export default routes;
