// src/routes/party-crm.ts
// Party CRM routes: Notes, Events, Milestones, Emails, Activity
//
// All routes are prefixed with /api/v1/parties/:partyId/...
// GET  /api/v1/parties/:partyId/notes           - List notes for a party
// POST /api/v1/parties/:partyId/notes           - Create a note
// PATCH /api/v1/parties/:partyId/notes/:noteId  - Update a note
// DELETE /api/v1/parties/:partyId/notes/:noteId - Delete a note
//
// GET  /api/v1/parties/:partyId/events          - List events for a party
// POST /api/v1/parties/:partyId/events          - Create an event
// PATCH /api/v1/parties/:partyId/events/:eventId - Update an event
// DELETE /api/v1/parties/:partyId/events/:eventId - Delete an event
// POST /api/v1/parties/:partyId/events/:eventId/complete - Mark event complete
//
// GET  /api/v1/parties/:partyId/milestones      - List milestones for a party
// POST /api/v1/parties/:partyId/milestones      - Create a milestone
// PATCH /api/v1/parties/:partyId/milestones/:milestoneId - Update a milestone
// DELETE /api/v1/parties/:partyId/milestones/:milestoneId - Delete a milestone
//
// GET  /api/v1/parties/:partyId/emails          - List sent emails for a party
// POST /api/v1/parties/:partyId/emails          - Send an email to a party
//
// GET  /api/v1/parties/:partyId/activity        - Get activity feed for a party

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { sendEmail, buildFromAddress } from "../services/email-service.js";

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
  const skip = (page - 1) * limit;
  return { page, limit, skip };
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
    // Don't fail the main operation if activity logging fails
    console.error("Failed to log party activity:", err);
  }
}

// ───────────────────────── Routes ─────────────────────────

const partyCrmRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────
  // NOTES
  // ─────────────────────────────────────────────────────────

  // GET /parties/:partyId/notes
  app.get("/parties/:partyId/notes", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "invalid_party_id" });

      const notes = await prisma.partyNote.findMany({
        where: { tenantId, partyId },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      });

      return reply.send({ notes });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get party notes");
      return reply.code(500).send({ error: "get_notes_failed" });
    }
  });

  // POST /parties/:partyId/notes
  app.post("/parties/:partyId/notes", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "invalid_party_id" });

      const body = req.body as any;
      const content = trimToNull(body.content);
      if (!content) return reply.code(400).send({ error: "content_required" });

      const note = await prisma.partyNote.create({
        data: {
          tenantId,
          partyId,
          content,
          pinned: body.pinned === true,
          createdBy: toNum(body.createdBy),
        },
      });

      await logActivity(tenantId, partyId, "NOTE_ADDED", "Note added", content.slice(0, 100));

      return reply.code(201).send({ ok: true, note });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to create party note");
      return reply.code(500).send({ error: "create_note_failed" });
    }
  });

  // PATCH /parties/:partyId/notes/:noteId
  app.patch("/parties/:partyId/notes/:noteId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      const noteId = toNum((req.params as any).noteId);
      if (!partyId || !noteId) return reply.code(400).send({ error: "invalid_ids" });

      const body = req.body as any;
      const updates: any = {};

      if (body.content !== undefined) {
        const content = trimToNull(body.content);
        if (!content) return reply.code(400).send({ error: "content_required" });
        updates.content = content;
      }
      if (body.pinned !== undefined) {
        updates.pinned = body.pinned === true;
      }

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: "no_updates" });
      }

      const note = await prisma.partyNote.update({
        where: { id: noteId, tenantId, partyId },
        data: updates,
      });

      await logActivity(tenantId, partyId, "NOTE_UPDATED", "Note updated");

      return reply.send({ ok: true, note });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return reply.code(404).send({ error: "note_not_found" });
      }
      req.log?.error?.({ err }, "Failed to update party note");
      return reply.code(500).send({ error: "update_note_failed" });
    }
  });

  // DELETE /parties/:partyId/notes/:noteId
  app.delete("/parties/:partyId/notes/:noteId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      const noteId = toNum((req.params as any).noteId);
      if (!partyId || !noteId) return reply.code(400).send({ error: "invalid_ids" });

      await prisma.partyNote.delete({
        where: { id: noteId, tenantId, partyId },
      });

      return reply.send({ ok: true });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return reply.code(404).send({ error: "note_not_found" });
      }
      req.log?.error?.({ err }, "Failed to delete party note");
      return reply.code(500).send({ error: "delete_note_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // EVENTS
  // ─────────────────────────────────────────────────────────

  // GET /parties/:partyId/events
  app.get("/parties/:partyId/events", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "invalid_party_id" });

      const q = req.query as any;
      const status = trimToNull(q.status); // SCHEDULED, COMPLETED, CANCELLED

      const where: any = { tenantId, partyId };
      if (status) where.status = status;

      const events = await prisma.partyEvent.findMany({
        where,
        orderBy: { scheduledAt: "asc" },
      });

      return reply.send({ events });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get party events");
      return reply.code(500).send({ error: "get_events_failed" });
    }
  });

  // POST /parties/:partyId/events
  app.post("/parties/:partyId/events", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "invalid_party_id" });

      const body = req.body as any;
      const title = trimToNull(body.title);
      if (!title) return reply.code(400).send({ error: "title_required" });

      const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
      if (!scheduledAt || isNaN(scheduledAt.getTime())) {
        return reply.code(400).send({ error: "valid_scheduled_at_required" });
      }

      const validKinds = ["FOLLOW_UP", "MEETING", "CALL", "VISIT", "CUSTOM"];
      const kind = validKinds.includes(body.kind) ? body.kind : "FOLLOW_UP";

      const event = await prisma.partyEvent.create({
        data: {
          tenantId,
          partyId,
          kind,
          title,
          notes: trimToNull(body.notes),
          scheduledAt,
          status: "SCHEDULED",
          createdBy: toNum(body.createdBy),
        },
      });

      await logActivity(tenantId, partyId, "EVENT_CREATED", `Event scheduled: ${title}`, null, {
        eventId: event.id,
      });

      return reply.code(201).send({ ok: true, event });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to create party event");
      return reply.code(500).send({ error: "create_event_failed" });
    }
  });

  // PATCH /parties/:partyId/events/:eventId
  app.patch("/parties/:partyId/events/:eventId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      const eventId = toNum((req.params as any).eventId);
      if (!partyId || !eventId) return reply.code(400).send({ error: "invalid_ids" });

      const body = req.body as any;
      const updates: any = {};

      if (body.title !== undefined) {
        const title = trimToNull(body.title);
        if (!title) return reply.code(400).send({ error: "title_required" });
        updates.title = title;
      }
      if (body.notes !== undefined) {
        updates.notes = trimToNull(body.notes);
      }
      if (body.scheduledAt !== undefined) {
        const scheduledAt = new Date(body.scheduledAt);
        if (isNaN(scheduledAt.getTime())) {
          return reply.code(400).send({ error: "invalid_scheduled_at" });
        }
        updates.scheduledAt = scheduledAt;
      }
      if (body.kind !== undefined) {
        const validKinds = ["FOLLOW_UP", "MEETING", "CALL", "VISIT", "CUSTOM"];
        if (validKinds.includes(body.kind)) {
          updates.kind = body.kind;
        }
      }
      if (body.status !== undefined) {
        const validStatuses = ["SCHEDULED", "COMPLETED", "CANCELLED"];
        if (validStatuses.includes(body.status)) {
          updates.status = body.status;
          if (body.status === "COMPLETED") {
            updates.completedAt = new Date();
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: "no_updates" });
      }

      const event = await prisma.partyEvent.update({
        where: { id: eventId, tenantId, partyId },
        data: updates,
      });

      return reply.send({ ok: true, event });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return reply.code(404).send({ error: "event_not_found" });
      }
      req.log?.error?.({ err }, "Failed to update party event");
      return reply.code(500).send({ error: "update_event_failed" });
    }
  });

  // DELETE /parties/:partyId/events/:eventId
  app.delete("/parties/:partyId/events/:eventId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      const eventId = toNum((req.params as any).eventId);
      if (!partyId || !eventId) return reply.code(400).send({ error: "invalid_ids" });

      await prisma.partyEvent.delete({
        where: { id: eventId, tenantId, partyId },
      });

      return reply.send({ ok: true });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return reply.code(404).send({ error: "event_not_found" });
      }
      req.log?.error?.({ err }, "Failed to delete party event");
      return reply.code(500).send({ error: "delete_event_failed" });
    }
  });

  // POST /parties/:partyId/events/:eventId/complete
  app.post("/parties/:partyId/events/:eventId/complete", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      const eventId = toNum((req.params as any).eventId);
      if (!partyId || !eventId) return reply.code(400).send({ error: "invalid_ids" });

      const event = await prisma.partyEvent.update({
        where: { id: eventId, tenantId, partyId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      await logActivity(tenantId, partyId, "EVENT_COMPLETED", `Event completed: ${event.title}`, null, {
        eventId: event.id,
      });

      return reply.send({ ok: true, event });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return reply.code(404).send({ error: "event_not_found" });
      }
      req.log?.error?.({ err }, "Failed to complete party event");
      return reply.code(500).send({ error: "complete_event_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // MILESTONES
  // ─────────────────────────────────────────────────────────

  // GET /parties/:partyId/milestones
  app.get("/parties/:partyId/milestones", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "invalid_party_id" });

      const milestones = await prisma.partyMilestone.findMany({
        where: { tenantId, partyId },
        orderBy: { date: "asc" },
      });

      return reply.send({ milestones });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get party milestones");
      return reply.code(500).send({ error: "get_milestones_failed" });
    }
  });

  // POST /parties/:partyId/milestones
  app.post("/parties/:partyId/milestones", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "invalid_party_id" });

      const body = req.body as any;
      const label = trimToNull(body.label);
      if (!label) return reply.code(400).send({ error: "label_required" });

      const date = body.date ? new Date(body.date) : null;
      if (!date || isNaN(date.getTime())) {
        return reply.code(400).send({ error: "valid_date_required" });
      }

      const validKinds = ["BIRTHDAY", "CUSTOMER_ANNIVERSARY", "PLACEMENT_ANNIVERSARY", "CUSTOM"];
      const kind = validKinds.includes(body.kind) ? body.kind : "CUSTOM";

      const milestone = await prisma.partyMilestone.create({
        data: {
          tenantId,
          partyId,
          kind,
          label,
          date,
          annual: body.annual !== false, // default true
          notes: trimToNull(body.notes),
          createdBy: toNum(body.createdBy),
        },
      });

      return reply.code(201).send({ ok: true, milestone });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to create party milestone");
      return reply.code(500).send({ error: "create_milestone_failed" });
    }
  });

  // PATCH /parties/:partyId/milestones/:milestoneId
  app.patch("/parties/:partyId/milestones/:milestoneId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      const milestoneId = toNum((req.params as any).milestoneId);
      if (!partyId || !milestoneId) return reply.code(400).send({ error: "invalid_ids" });

      const body = req.body as any;
      const updates: any = {};

      if (body.label !== undefined) {
        const label = trimToNull(body.label);
        if (!label) return reply.code(400).send({ error: "label_required" });
        updates.label = label;
      }
      if (body.date !== undefined) {
        const date = new Date(body.date);
        if (isNaN(date.getTime())) {
          return reply.code(400).send({ error: "invalid_date" });
        }
        updates.date = date;
      }
      if (body.kind !== undefined) {
        const validKinds = ["BIRTHDAY", "CUSTOMER_ANNIVERSARY", "PLACEMENT_ANNIVERSARY", "CUSTOM"];
        if (validKinds.includes(body.kind)) {
          updates.kind = body.kind;
        }
      }
      if (body.annual !== undefined) {
        updates.annual = body.annual === true;
      }
      if (body.notes !== undefined) {
        updates.notes = trimToNull(body.notes);
      }

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: "no_updates" });
      }

      const milestone = await prisma.partyMilestone.update({
        where: { id: milestoneId, tenantId, partyId },
        data: updates,
      });

      return reply.send({ ok: true, milestone });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return reply.code(404).send({ error: "milestone_not_found" });
      }
      req.log?.error?.({ err }, "Failed to update party milestone");
      return reply.code(500).send({ error: "update_milestone_failed" });
    }
  });

  // DELETE /parties/:partyId/milestones/:milestoneId
  app.delete("/parties/:partyId/milestones/:milestoneId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      const milestoneId = toNum((req.params as any).milestoneId);
      if (!partyId || !milestoneId) return reply.code(400).send({ error: "invalid_ids" });

      await prisma.partyMilestone.delete({
        where: { id: milestoneId, tenantId, partyId },
      });

      return reply.send({ ok: true });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return reply.code(404).send({ error: "milestone_not_found" });
      }
      req.log?.error?.({ err }, "Failed to delete party milestone");
      return reply.code(500).send({ error: "delete_milestone_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // EMAILS
  // ─────────────────────────────────────────────────────────

  // GET /parties/:partyId/emails
  app.get("/parties/:partyId/emails", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "invalid_party_id" });

      const { limit, skip } = parsePaging(req.query);

      const emails = await prisma.partyEmail.findMany({
        where: { tenantId, partyId },
        orderBy: { sentAt: "desc" },
        take: limit,
        skip,
      });

      return reply.send({ emails });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get party emails");
      return reply.code(500).send({ error: "get_emails_failed" });
    }
  });

  // POST /parties/:partyId/emails
  // Note: This creates a record; actual email sending would be done by a service
  app.post("/parties/:partyId/emails", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "invalid_party_id" });

      const body = req.body as any;
      const subject = trimToNull(body.subject);
      const emailBody = trimToNull(body.body);
      const toEmail = trimToNull(body.toEmail);

      if (!subject) return reply.code(400).send({ error: "subject_required" });
      if (!emailBody) return reply.code(400).send({ error: "body_required" });
      if (!toEmail) return reply.code(400).send({ error: "to_email_required" });

      // B-07 FIX: Get tenant org for from address
      const tenantOrg = await prisma.organization.findFirst({
        where: { tenantId },
        include: { party: { select: { email: true, name: true } } },
      });

      if (!tenantOrg?.party?.email) {
        return reply.code(400).send({ error: "org_email_not_configured" });
      }

      const fromAddress = buildFromAddress(
        tenantOrg.party.name || "BreederHQ",
        "messages"
      );

      // B-07 FIX: Actually send the email via email service
      const result = await sendEmail({
        tenantId,
        to: toEmail,
        subject,
        html: `<p>${emailBody.replace(/\n/g, "<br>")}</p>`,
        text: emailBody,
        from: fromAddress,
        replyTo: tenantOrg.party.email,
        category: "transactional",
        metadata: {
          type: "party_crm_email",
          partyId,
        },
      });

      if (!result.ok) {
        req.log?.error?.({ err: result.error, partyId }, "Failed to send party email");
        // Record failed email
        await prisma.partyEmail.create({
          data: {
            tenantId,
            partyId,
            subject,
            body: emailBody,
            toEmail,
            status: "failed",
            createdBy: toNum(body.createdBy),
          },
        });
        return reply.code(500).send({
          error: "send_failed",
          message: result.error || "Failed to send email",
        });
      }

      // Record successful email
      const email = await prisma.partyEmail.create({
        data: {
          tenantId,
          partyId,
          subject,
          body: emailBody,
          toEmail,
          status: "sent",
          createdBy: toNum(body.createdBy),
        },
      });

      await logActivity(tenantId, partyId, "EMAIL_SENT", `Email sent: ${subject}`, null, {
        emailId: email.id,
        messageId: result.providerMessageId,
      });

      return reply.code(201).send({
        ok: true,
        email,
        messageId: result.providerMessageId,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to send party email");
      return reply.code(500).send({ error: "send_email_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // ACTIVITY FEED
  // ─────────────────────────────────────────────────────────

  // GET /parties/:partyId/activity
  app.get("/parties/:partyId/activity", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "invalid_party_id" });

      const { limit, skip } = parsePaging(req.query);

      const activity = await prisma.partyActivity.findMany({
        where: { tenantId, partyId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      });

      return reply.send({ activity });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get party activity");
      return reply.code(500).send({ error: "get_activity_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // PROFILE CHANGE REQUESTS (Breeder-facing)
  // ─────────────────────────────────────────────────────────

  // GET /parties/:partyId/change-requests
  // Get pending change requests for a contact
  app.get("/parties/:partyId/change-requests", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "invalid_party_id" });

      // Get contact for this party
      const contact = await prisma.contact.findFirst({
        where: { tenantId, partyId },
        select: { id: true },
      });

      if (!contact) {
        return reply.code(404).send({ error: "contact_not_found" });
      }

      const requests = await prisma.contactChangeRequest.findMany({
        where: {
          tenantId,
          contactId: contact.id,
        },
        orderBy: { requestedAt: "desc" },
      });

      return reply.send({
        requests: requests.map((r) => ({
          id: r.id,
          fieldName: r.fieldName,
          oldValue: r.oldValue,
          newValue: r.newValue,
          status: r.status,
          requestedAt: r.requestedAt.toISOString(),
          resolvedAt: r.resolvedAt?.toISOString() || null,
          resolvedBy: r.resolvedBy,
          resolutionNote: r.resolutionNote,
        })),
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get change requests");
      return reply.code(500).send({ error: "get_requests_failed" });
    }
  });

  // POST /parties/:partyId/change-requests/:requestId/approve
  // Approve a name change request
  app.post("/parties/:partyId/change-requests/:requestId/approve", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const partyId = toNum((req.params as any).partyId);
      if (!partyId) return reply.code(400).send({ error: "invalid_party_id" });

      const requestId = toNum((req.params as any).requestId);
      if (!requestId) return reply.code(400).send({ error: "invalid_request_id" });

      const userId = (req as any).userId || null;

      // Get contact for this party
      const contact = await prisma.contact.findFirst({
        where: { tenantId, partyId },
        select: { id: true },
      });

      if (!contact) {
        return reply.code(404).send({ error: "contact_not_found" });
      }

      // Get the change request
      const changeRequest = await prisma.contactChangeRequest.findFirst({
        where: {
          id: requestId,
          tenantId,
          contactId: contact.id,
          status: "PENDING",
        },
      });

      if (!changeRequest) {
        return reply.code(404).send({ error: "request_not_found" });
      }

      // Map field name to Contact model field
      const fieldMap: Record<string, string> = {
        firstName: "first_name",
        lastName: "last_name",
        nickname: "nickname",
      };

      const dbField = fieldMap[changeRequest.fieldName];
      if (!dbField) {
        return reply.code(400).send({ error: "invalid_field" });
      }

      // Update contact and mark request as approved
      await prisma.$transaction([
        prisma.contact.update({
          where: { id: contact.id },
          data: { [dbField]: changeRequest.newValue },
        }),
        prisma.contactChangeRequest.update({
          where: { id: requestId },
          data: {
            status: "APPROVED",
            resolvedAt: new Date(),
            resolvedBy: userId,
          },
        }),
      ]);

      // Log activity
      await logActivity(
        tenantId,
        partyId,
        "NAME_CHANGE_APPROVED",
        `Name change approved: ${changeRequest.fieldName}`,
        `Changed ${changeRequest.fieldName} from "${changeRequest.oldValue || "(empty)"}" to "${changeRequest.newValue}"`,
        { fieldName: changeRequest.fieldName, oldValue: changeRequest.oldValue, newValue: changeRequest.newValue, requestId }
      );

      return reply.send({ ok: true });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to approve change request");
      return reply.code(500).send({ error: "approve_failed" });
    }
  });

  // POST /parties/:partyId/change-requests/:requestId/reject
  // Reject a name change request
  app.post<{ Params: { partyId: string; requestId: string }; Body: { reason?: string } }>(
    "/parties/:partyId/change-requests/:requestId/reject",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

        const partyId = toNum(req.params.partyId);
        if (!partyId) return reply.code(400).send({ error: "invalid_party_id" });

        const requestId = toNum(req.params.requestId);
        if (!requestId) return reply.code(400).send({ error: "invalid_request_id" });

        const { reason } = req.body || {};
        const userId = (req as any).userId || null;

        // Get contact for this party
        const contact = await prisma.contact.findFirst({
          where: { tenantId, partyId },
          select: { id: true },
        });

        if (!contact) {
          return reply.code(404).send({ error: "contact_not_found" });
        }

        // Get the change request
        const changeRequest = await prisma.contactChangeRequest.findFirst({
          where: {
            id: requestId,
            tenantId,
            contactId: contact.id,
            status: "PENDING",
          },
        });

        if (!changeRequest) {
          return reply.code(404).send({ error: "request_not_found" });
        }

        // Mark request as rejected
        await prisma.contactChangeRequest.update({
          where: { id: requestId },
          data: {
            status: "REJECTED",
            resolvedAt: new Date(),
            resolvedBy: userId,
            resolutionNote: reason || null,
          },
        });

        // Log activity
        await logActivity(
          tenantId,
          partyId,
          "NAME_CHANGE_REJECTED",
          `Name change rejected: ${changeRequest.fieldName}`,
          reason || `Rejected request to change ${changeRequest.fieldName}`,
          { fieldName: changeRequest.fieldName, requestId, reason }
        );

        return reply.send({ ok: true });
      } catch (err) {
        req.log?.error?.({ err }, "Failed to reject change request");
        return reply.code(500).send({ error: "reject_failed" });
      }
    }
  );

  // GET /dashboard/pending-change-requests
  // Get count and list of pending change requests across all contacts (for notification badge)
  app.get("/dashboard/pending-change-requests", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const pendingRequests = await prisma.contactChangeRequest.findMany({
        where: {
          tenantId,
          status: "PENDING",
        },
        include: {
          contact: {
            select: {
              id: true,
              display_name: true,
              partyId: true,
            },
          },
        },
        orderBy: { requestedAt: "desc" },
      });

      return reply.send({
        count: pendingRequests.length,
        requests: pendingRequests.map((r) => ({
          id: r.id,
          contactId: r.contact.id,
          contactName: r.contact.display_name,
          partyId: r.contact.partyId,
          fieldName: r.fieldName,
          oldValue: r.oldValue,
          newValue: r.newValue,
          requestedAt: r.requestedAt.toISOString(),
        })),
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get pending change requests");
      return reply.code(500).send({ error: "get_pending_failed" });
    }
  });
};

export default partyCrmRoutes;
