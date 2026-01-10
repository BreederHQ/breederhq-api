// src/routes/messaging-hub.ts
// MessagingHub routes - Send emails to any address with optional party linking
//
// GET  /api/v1/parties/lookup-by-email?emails=a@b.com,c@d.com  - Lookup parties by email
// POST /api/v1/emails/send                                      - Send email (with or without partyId)
// GET  /api/v1/emails/unlinked                                  - List unlinked emails
// GET  /api/v1/emails/unlinked/:id                              - Get single unlinked email
// POST /api/v1/emails/unlinked/:id/link                         - Link unlinked email to party
// POST /api/v1/emails/unlinked/:id/unlink                       - Unlink email from party

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { sendEmail as sendViaResend } from "../services/email-service.js";

// ───────────────────────── Helpers ─────────────────────────

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function trimToNull(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "50", 10) || 50));
  const offset = parseInt(q?.offset ?? "0", 10) || 0;
  const skip = offset > 0 ? offset : (page - 1) * limit;
  return { page, limit, skip };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function makePreview(text: string | null | undefined, maxLen = 200): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) + "..." : clean;
}

// Log activity for a party
async function logActivity(
  tenantId: number,
  partyId: number,
  kind: string,
  title: string,
  detail?: string | null,
  metadata?: any,
  actorId?: number | null
) {
  try {
    await prisma.partyActivity.create({
      data: {
        tenantId,
        partyId,
        kind: kind as any,
        title,
        detail,
        metadata,
        actorId,
      },
    });
  } catch (err) {
    console.error("Failed to log party activity:", err);
  }
}

// ───────────────────────── Routes ─────────────────────────

const messagingHubRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────
  // EMAIL LOOKUP BY ADDRESS
  // ─────────────────────────────────────────────────────────

  // GET /parties/lookup-by-email?emails=a@b.com,c@d.com
  app.get("/parties/lookup-by-email", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const q = req.query as any;
      const emailsParam = trimToNull(q.emails);
      if (!emailsParam) {
        return reply.send({ matches: [], unmatched: [] });
      }

      // Parse comma-separated emails
      const emails = emailsParam
        .split(",")
        .map((e: string) => e.trim().toLowerCase())
        .filter((e: string) => e && isValidEmail(e));

      if (emails.length === 0) {
        return reply.send({ matches: [], unmatched: [] });
      }

      // Look up parties by email (both contacts and organizations)
      const parties = await prisma.party.findMany({
        where: {
          tenantId,
          email: { in: emails, mode: "insensitive" },
          archived: false,
        },
        select: {
          id: true,
          type: true,
          name: true,
          email: true,
        },
      });

      // Build matches and unmatched lists
      const matchedEmails = new Set<string>();
      const matches = parties.map((p) => {
        const email = (p.email || "").toLowerCase();
        matchedEmails.add(email);
        return {
          email,
          partyId: p.id,
          partyKind: p.type as "CONTACT" | "ORGANIZATION",
          partyName: p.name,
        };
      });

      const unmatched = emails.filter((e: string) => !matchedEmails.has(e));

      return reply.send({ matches, unmatched });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to lookup parties by email");
      return reply.code(500).send({ error: "lookup_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // SEND EMAIL (LINKED OR UNLINKED)
  // ─────────────────────────────────────────────────────────

  // POST /emails/send
  app.post("/emails/send", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = req.body as any;
      const toAddresses: string[] = Array.isArray(body.toAddresses)
        ? body.toAddresses.map((e: string) => e.trim().toLowerCase()).filter(isValidEmail)
        : [];

      if (toAddresses.length === 0) {
        return reply.code(400).send({ error: "to_addresses_required" });
      }

      const subject = trimToNull(body.subject);
      if (!subject) {
        return reply.code(400).send({ error: "subject_required" });
      }

      const bodyText = trimToNull(body.bodyText);
      const bodyHtml = trimToNull(body.bodyHtml);
      if (!bodyText && !bodyHtml) {
        return reply.code(400).send({ error: "body_required" });
      }

      const partyId = toNum(body.partyId);
      const category = body.category === "marketing" ? "marketing" : "transactional";
      const templateKey = trimToNull(body.templateKey);
      const bundleId = toNum(body.bundleId);
      const createdBy = toNum(body.createdBy) || toNum((req as any).userId);

      // Get tenant's sender email (would come from settings in real implementation)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { primaryEmail: true, name: true },
      });
      const fromAddress = tenant?.primaryEmail || `noreply@breederhq.com`;

      // Send the email via Resend for each recipient
      const sendResults: Array<{ to: string; ok: boolean; error?: string }> = [];
      for (const toAddress of toAddresses) {
        try {
          const result = await sendViaResend({
            tenantId,
            to: toAddress,
            subject,
            html: bodyHtml || undefined,
            text: bodyText || undefined,
            templateKey: templateKey || undefined,
            category,
          });
          sendResults.push({ to: toAddress, ok: result.ok, error: result.error });
        } catch (err: any) {
          sendResults.push({ to: toAddress, ok: false, error: err.message });
        }
      }

      // Check if at least one email was sent successfully
      const anySuccess = sendResults.some((r) => r.ok);
      const allFailed = sendResults.every((r) => !r.ok);

      if (allFailed) {
        return reply.code(500).send({
          ok: false,
          error: "all_emails_failed",
          details: sendResults,
        });
      }

      if (partyId) {
        // Linked email - store in PartyEmail
        const partyExists = await prisma.party.findFirst({
          where: { id: partyId, tenantId },
          select: { id: true },
        });

        if (!partyExists) {
          return reply.code(404).send({ error: "party_not_found" });
        }

        const email = await prisma.partyEmail.create({
          data: {
            tenantId,
            partyId,
            subject,
            body: bodyText || bodyHtml || "",
            toEmail: toAddresses[0],
            status: "sent",
            sentAt: new Date(),
            createdBy,
          },
        });

        await logActivity(tenantId, partyId, "EMAIL_SENT", `Email sent: ${subject}`, null, {
          emailId: email.id,
        });

        return reply.code(201).send({
          ok: true,
          isLinked: true,
          email,
        });
      } else {
        // Unlinked email - store in UnlinkedEmail
        const unlinkedEmail = await prisma.unlinkedEmail.create({
          data: {
            tenantId,
            toAddresses,
            fromAddress,
            subject,
            bodyText,
            bodyHtml,
            bodyPreview: makePreview(bodyText || bodyHtml),
            status: "sent",
            direction: "outbound",
            sentAt: new Date(),
            category,
            templateKey,
            metadata: bundleId ? { bundleId } : undefined,
            createdBy,
          },
        });

        return reply.code(201).send({
          ok: true,
          isLinked: false,
          unlinkedEmail,
        });
      }
    } catch (err) {
      req.log?.error?.({ err }, "Failed to send email");
      return reply.code(500).send({ error: "send_email_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // UNLINKED EMAILS CRUD
  // ─────────────────────────────────────────────────────────

  // GET /emails/unlinked
  app.get("/emails/unlinked", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { limit, skip } = parsePaging(req.query);
      const q = req.query as any;
      const linkedStatus = trimToNull(q.linkedStatus) || "all"; // linked, unlinked, all

      const where: any = { tenantId };
      if (linkedStatus === "linked") {
        where.linkedPartyId = { not: null };
      } else if (linkedStatus === "unlinked") {
        where.linkedPartyId = null;
      }

      const [items, total] = await Promise.all([
        prisma.unlinkedEmail.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip,
          include: {
            linkedParty: {
              select: { id: true, name: true, type: true },
            },
          },
        }),
        prisma.unlinkedEmail.count({ where }),
      ]);

      // Transform to include linked party info
      const unlinkedEmails = items.map((e) => ({
        ...e,
        linkedPartyName: e.linkedParty?.name || null,
        linkedPartyKind: e.linkedParty?.type || null,
        linkedParty: undefined, // Don't expose the full relation
      }));

      return reply.send({ items: unlinkedEmails, total });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to list unlinked emails");
      return reply.code(500).send({ error: "list_unlinked_failed" });
    }
  });

  // GET /emails/unlinked/:id
  app.get("/emails/unlinked/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = toNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const email = await prisma.unlinkedEmail.findFirst({
        where: { id, tenantId },
        include: {
          linkedParty: {
            select: { id: true, name: true, type: true },
          },
        },
      });

      if (!email) {
        return reply.code(404).send({ error: "not_found" });
      }

      const unlinkedEmail = {
        ...email,
        linkedPartyName: email.linkedParty?.name || null,
        linkedPartyKind: email.linkedParty?.type || null,
        linkedParty: undefined,
      };

      return reply.send({ unlinkedEmail });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get unlinked email");
      return reply.code(500).send({ error: "get_unlinked_failed" });
    }
  });

  // POST /emails/unlinked/:id/link
  app.post("/emails/unlinked/:id/link", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = toNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const body = req.body as any;
      const partyId = toNum(body.partyId);
      if (!partyId) return reply.code(400).send({ error: "party_id_required" });

      // Verify party exists
      const party = await prisma.party.findFirst({
        where: { id: partyId, tenantId },
        select: { id: true, name: true, type: true },
      });

      if (!party) {
        return reply.code(404).send({ error: "party_not_found" });
      }

      // Update the unlinked email
      const email = await prisma.unlinkedEmail.update({
        where: { id, tenantId },
        data: {
          linkedPartyId: partyId,
          linkedAt: new Date(),
        },
      });

      // Log activity on the party
      await logActivity(
        tenantId,
        partyId,
        "EMAIL_LINKED",
        `Email linked: ${email.subject}`,
        null,
        { unlinkedEmailId: email.id }
      );

      return reply.send({
        ok: true,
        unlinkedEmail: {
          ...email,
          linkedPartyName: party.name,
          linkedPartyKind: party.type,
        },
      });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return reply.code(404).send({ error: "not_found" });
      }
      req.log?.error?.({ err }, "Failed to link unlinked email");
      return reply.code(500).send({ error: "link_email_failed" });
    }
  });

  // POST /emails/unlinked/:id/unlink
  app.post("/emails/unlinked/:id/unlink", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = toNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "invalid_id" });

      const email = await prisma.unlinkedEmail.update({
        where: { id, tenantId },
        data: {
          linkedPartyId: null,
          linkedAt: null,
        },
      });

      return reply.send({
        ok: true,
        unlinkedEmail: {
          ...email,
          linkedPartyName: null,
          linkedPartyKind: null,
        },
      });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return reply.code(404).send({ error: "not_found" });
      }
      req.log?.error?.({ err }, "Failed to unlink email");
      return reply.code(500).send({ error: "unlink_email_failed" });
    }
  });
};

export default messagingHubRoutes;
