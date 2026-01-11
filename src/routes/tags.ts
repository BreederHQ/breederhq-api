// src/routes/tags.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { TagModule } from "@prisma/client";
import prisma from "../prisma.js";
import { createTagAssignment, getTagsForContact, getTagsForOrganization } from "../services/tag-service.js";

// All valid TagModule values from Prisma schema
const VALID_MODULES = Object.values(TagModule);

/* ───────────────────────── helpers ───────────────────────── */

function parseIntOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(200, Math.max(1, Number(q?.limit ?? 50) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function errorReply(err: unknown) {
  const any = err as any;
  const code = any?.code;
  if (code === "P2002") {
    return { status: 409, payload: { error: "conflict", detail: "Unique constraint violation" } };
  }
  if (code === "P2025") {
    return { status: 404, payload: { error: "not_found" } };
  }
  return { status: 500, payload: { error: "internal_error", detail: any?.message || "Unexpected error" } };
}

function tagDTO(t: any) {
  return {
    id: t.id,
    name: t.name,
    module: t.module as TagModule,
    color: t.color ?? null,
    isArchived: t.isArchived ?? false,
    archivedAt: t.archivedAt ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/* ───────────────────────── routes ───────────────────────── */

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /tags?module=CONTACT&q=&page=&limit=&includeArchived=
  app.get("/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { module = "", q = "", includeArchived = "" } = (req.query || {}) as {
        module?: string;
        q?: string;
        page?: string;
        limit?: string;
        includeArchived?: string;
      };
      const { page, limit, skip } = parsePaging(req.query);

      // Validate module if provided
      if (module && !VALID_MODULES.includes(module as TagModule)) {
        return reply.code(400).send({
          error: "invalid_module",
          detail: `Module must be one of: ${VALID_MODULES.join(", ")}`,
        });
      }

      const where: any = { tenantId };
      if (module) where.module = module;
      if (q) where.name = { contains: q, mode: "insensitive" };
      // Filter out archived tags by default unless includeArchived=true
      if (includeArchived !== "true") {
        where.isArchived = false;
      }

      const [itemsRaw, total] = await prisma.$transaction([
        prisma.tag.findMany({
          where,
          orderBy: [{ name: "asc" }],
          skip,
          take: limit,
          select: { id: true, name: true, module: true, color: true, isArchived: true, archivedAt: true, createdAt: true, updatedAt: true },
        }),
        prisma.tag.count({ where }),
      ]);

      const items = itemsRaw.map(tagDTO);
      reply.send({ items, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /tags/stats → usage counts for all tags (read-only)
  // Accepts includeArchived=true to include archived tags
  app.get("/tags/stats", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { includeArchived = "" } = (req.query || {}) as { includeArchived?: string };

      // Build where clause - exclude archived by default
      const where: any = { tenantId };
      if (includeArchived !== "true") {
        where.isArchived = false;
      }

      // Get tags for tenant (filtered by archive status)
      const tags = await prisma.tag.findMany({
        where,
        select: { id: true },
      });

      // Get assignment counts grouped by tagId
      const counts = await prisma.tagAssignment.groupBy({
        by: ["tagId"],
        where: { tag: where },
        _count: { id: true },
      });

      // Build lookup map
      const countMap = new Map<number, number>();
      for (const row of counts) {
        countMap.set(row.tagId, row._count.id);
      }

      // Build response with 0 counts for tags with no assignments
      const stats = tags.map((tag) => ({
        tagId: tag.id,
        usageCount: countMap.get(tag.id) ?? 0,
      }));

      reply.send({ items: stats });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /contacts/:id/tags  → list tags assigned to a contact
  // Step 6B: Party-only reads via taggedPartyId
  app.get("/contacts/:id/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const contactId = Number(id);
      if (!Number.isInteger(contactId) || contactId <= 0) {
        return reply.code(400).send({ error: "invalid_contact_id" });
      }

      // Use Party-only read service
      const items = await getTagsForContact(contactId, tenantId);

      // Check if contact exists (if items is empty, could be no tags or no contact)
      if (items.length === 0) {
        const contact = await prisma.contact.findFirst({
          where: { id: contactId, tenantId },
          select: { id: true },
        });
        if (!contact) return reply.code(404).send({ error: "contact_not_found" });
      }

      return reply.send({ items, total: items.length });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /organizations/:id/tags  → list tags assigned to an organization
  // Step 6B: Party-only reads via taggedPartyId
  app.get("/organizations/:id/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const organizationId = Number(id);
      if (!Number.isInteger(organizationId) || organizationId <= 0) {
        return reply.code(400).send({ error: "invalid_organization_id" });
      }

      // Use Party-only read service
      const items = await getTagsForOrganization(organizationId, tenantId);

      // Check if organization exists (if items is empty, could be no tags or no organization)
      if (items.length === 0) {
        const org = await prisma.organization.findFirst({
          where: { id: organizationId, tenantId },
          select: { id: true },
        });
        if (!org) return reply.code(404).send({ error: "organization_not_found" });
      }

      return reply.send({ items, total: items.length });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });


  // POST /tags  body: { name, module, color? }
  app.post("/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = (req.body || {}) as { name?: string; module?: string; color?: string | null };
      const name = String(body.name || "").trim();
      const module = body.module;

      if (!name) return reply.code(400).send({ error: "name_required" });
      if (!module || !VALID_MODULES.includes(module as TagModule)) {
        return reply.code(400).send({
          error: "module_invalid",
          detail: `Module must be one of: ${VALID_MODULES.join(", ")}`,
        });
      }

      const created = await prisma.tag.create({
        data: { tenantId, name, module: module as TagModule, color: body.color ?? null },
        select: { id: true, name: true, module: true, color: true, isArchived: true, archivedAt: true, createdAt: true, updatedAt: true },
      });
      return reply.code(201).send(tagDTO(created));
    } catch (e: any) {
      if (e?.code === "P2002") {
        return reply
          .code(409)
          .send({ error: "duplicate_tag", detail: "name_must_be_unique_within_tenant_and_module" });
      }
      const { status, payload } = errorReply(e);
      reply.status(status).send(payload);
    }
  });

  // GET /tags/:id
  app.get("/tags/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const tag = await prisma.tag.findFirst({
        where: { id: Number(id), tenantId },
        select: { id: true, name: true, module: true, color: true, isArchived: true, archivedAt: true, createdAt: true, updatedAt: true },
      });
      if (!tag) return reply.code(404).send({ error: "not_found" });
      reply.send(tagDTO(tag));
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // PATCH /tags/:id   body: { name?, color?, isArchived? }
  // Module is immutable after creation to keep assignment semantics consistent.
  app.patch("/tags/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const existing = await prisma.tag.findFirst({
        where: { id: Number(id), tenantId },
        select: { id: true, module: true, isArchived: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const body = (req.body || {}) as { name?: string; color?: string | null; isArchived?: boolean };
      const data: any = {};
      if (body.name !== undefined) {
        const n = String(body.name || "").trim();
        if (!n) return reply.code(400).send({ error: "name_required" });
        data.name = n;
      }
      if (body.color !== undefined) data.color = body.color;

      // Handle archive state toggle
      if (body.isArchived !== undefined) {
        data.isArchived = Boolean(body.isArchived);
        if (data.isArchived && !existing.isArchived) {
          // Archiving: set archivedAt timestamp
          data.archivedAt = new Date();
        } else if (!data.isArchived && existing.isArchived) {
          // Unarchiving: clear archivedAt
          data.archivedAt = null;
        }
      }

      const updated = await prisma.tag.update({
        where: { id: existing.id },
        data,
        select: { id: true, name: true, module: true, color: true, isArchived: true, archivedAt: true, createdAt: true, updatedAt: true },
      });
      reply.send(tagDTO(updated));
    } catch (e: any) {
      if (e?.code === "P2002") {
        return reply
          .code(409)
          .send({ error: "duplicate_tag", detail: "name_must_be_unique_within_tenant_and_module" });
      }
      const { status, payload } = errorReply(e);
      reply.status(status).send(payload);
    }
  });

  // DELETE /tags/:id
  // Only allows deletion if tag has no assignments (safe delete)
  app.delete("/tags/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const tag = await prisma.tag.findFirst({ where: { id: Number(id), tenantId }, select: { id: true } });
      if (!tag) return reply.code(404).send({ error: "not_found" });

      // Check for existing assignments - reject if tag is in use
      const assignmentCount = await prisma.tagAssignment.count({ where: { tagId: tag.id } });
      if (assignmentCount > 0) {
        return reply.code(409).send({
          error: "tag_in_use",
          detail: `Cannot delete tag: it has ${assignmentCount} assignment${assignmentCount === 1 ? "" : "s"}`,
          usageCount: assignmentCount,
        });
      }

      await prisma.tag.delete({ where: { id: tag.id } });
      reply.code(204).send();
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /tags/:id/assign   body: { contactId? | organizationId? | animalId? | messageThreadId? | draftId? | breedingPlanId? | offspringGroupId? | offspringId? }
  // Exactly one target; target must be in the same tenant; tag.module must match target type.
  // Step 6B: Party-only writes - resolves contactId/organizationId to taggedPartyId
  app.post("/tags/:id/assign", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const tag = await prisma.tag.findFirst({
        where: { id: Number(id), tenantId },
        select: { id: true, module: true, isArchived: true },
      });
      if (!tag) return reply.code(404).send({ error: "not_found" });

      // Block assignment of archived tags
      if (tag.isArchived) {
        return reply.code(409).send({ error: "tag_archived", detail: "Cannot assign archived tag" });
      }

      const body = (req.body || {}) as { contactId?: number; organizationId?: number; animalId?: number; messageThreadId?: number; draftId?: number; breedingPlanId?: number; offspringGroupId?: number; offspringId?: number };
      const targets = ["contactId", "organizationId", "animalId", "messageThreadId", "draftId", "breedingPlanId", "offspringGroupId", "offspringId"].filter((k) => (body as any)[k] != null);
      if (targets.length !== 1) return reply.code(400).send({ error: "one_target_required" });

      try {
        if (body.organizationId != null) {
          if (tag.module !== "ORGANIZATION") return reply.code(400).send({ error: "module_mismatch" });
          const orgId = parseIntOrNull(body.organizationId);
          if (!orgId) return reply.code(400).send({ error: "organizationId_invalid" });
          const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true, tenantId: true },
          });
          if (!org) return reply.code(404).send({ error: "organization_not_found" });
          if (org.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });

          // Dual-write: use service to set both organizationId and taggedPartyId
          await createTagAssignment({ tagId: tag.id, organizationId: org.id });
        } else if (body.contactId != null) {
          if (tag.module !== "CONTACT") return reply.code(400).send({ error: "module_mismatch" });
          const contactId = parseIntOrNull(body.contactId);
          if (!contactId) return reply.code(400).send({ error: "contactId_invalid" });
          const c = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { id: true, tenantId: true },
          });
          if (!c) return reply.code(404).send({ error: "contact_not_found" });
          if (c.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });

          // Dual-write: use service to set both contactId and taggedPartyId
          await createTagAssignment({ tagId: tag.id, contactId: c.id });
        } else if (body.messageThreadId != null) {
          if (tag.module !== "MESSAGE_THREAD") return reply.code(400).send({ error: "module_mismatch" });
          const threadId = parseIntOrNull(body.messageThreadId);
          if (!threadId) return reply.code(400).send({ error: "messageThreadId_invalid" });
          const thread = await prisma.messageThread.findUnique({
            where: { id: threadId },
            select: { id: true, tenantId: true },
          });
          if (!thread) return reply.code(404).send({ error: "thread_not_found" });
          if (thread.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });

          await prisma.tagAssignment.create({
            data: { tagId: tag.id, messageThreadId: thread.id },
          });
        } else if (body.draftId != null) {
          if (tag.module !== "DRAFT") return reply.code(400).send({ error: "module_mismatch" });
          const draftId = parseIntOrNull(body.draftId);
          if (!draftId) return reply.code(400).send({ error: "draftId_invalid" });
          const draft = await prisma.draft.findUnique({
            where: { id: draftId },
            select: { id: true, tenantId: true },
          });
          if (!draft) return reply.code(404).send({ error: "draft_not_found" });
          if (draft.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });

          await prisma.tagAssignment.create({
            data: { tagId: tag.id, draftId: draft.id },
          });
        } else if (body.breedingPlanId != null) {
          if (tag.module !== "BREEDING_PLAN") return reply.code(400).send({ error: "module_mismatch" });
          const planId = parseIntOrNull(body.breedingPlanId);
          if (!planId) return reply.code(400).send({ error: "breedingPlanId_invalid" });
          const plan = await prisma.breedingPlan.findUnique({
            where: { id: planId },
            select: { id: true, tenantId: true },
          });
          if (!plan) return reply.code(404).send({ error: "breeding_plan_not_found" });
          if (plan.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });

          await prisma.tagAssignment.create({
            data: { tagId: tag.id, breedingPlanId: plan.id },
          });
        } else if (body.offspringGroupId != null) {
          if (tag.module !== "OFFSPRING_GROUP") return reply.code(400).send({ error: "module_mismatch" });
          const groupId = parseIntOrNull(body.offspringGroupId);
          if (!groupId) return reply.code(400).send({ error: "offspringGroupId_invalid" });
          const group = await prisma.offspringGroup.findUnique({
            where: { id: groupId },
            select: { id: true, tenantId: true },
          });
          if (!group) return reply.code(404).send({ error: "offspring_group_not_found" });
          if (group.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });

          await prisma.tagAssignment.create({
            data: { tagId: tag.id, offspringGroupId: group.id },
          });
        } else if (body.offspringId != null) {
          if (tag.module !== "OFFSPRING") return reply.code(400).send({ error: "module_mismatch" });
          const offspringId = parseIntOrNull(body.offspringId);
          if (!offspringId) return reply.code(400).send({ error: "offspringId_invalid" });
          const offspring = await prisma.offspring.findUnique({
            where: { id: offspringId },
            select: { id: true, tenantId: true },
          });
          if (!offspring) return reply.code(404).send({ error: "offspring_not_found" });
          if (offspring.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });

          await prisma.tagAssignment.create({
            data: { tagId: tag.id, offspringId: offspring.id },
          });
        } else if (body.animalId != null) {
          if (tag.module !== "ANIMAL") return reply.code(400).send({ error: "module_mismatch" });
          const animalId = parseIntOrNull(body.animalId);
          if (!animalId) return reply.code(400).send({ error: "animalId_invalid" });
          const a = await prisma.animal.findUnique({
            where: { id: animalId },
            select: { id: true, tenantId: true },
          });
          if (!a) return reply.code(404).send({ error: "animal_not_found" });
          if (a.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });

          // Animal assignment (not party-like, no dual-write needed)
          await createTagAssignment({ tagId: tag.id, animalId: a.id });
        } else {
          return reply.code(400).send({ error: "one_target_required" });
        }
      } catch (e: any) {
        if (e?.code === "P2002") {
          // @@unique([tagId, contactId]) and siblings
          return reply.code(409).send({ error: "already_assigned" });
        }
        throw e;
      }

      reply.code(201).send({ ok: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /tags/:id/unassign   body: { contactId? | organizationId? | animalId? | messageThreadId? | draftId? | breedingPlanId? | offspringGroupId? | offspringId? }
  // Step 6B: Resolves contactId/organizationId to taggedPartyId before deletion
  app.post("/tags/:id/unassign", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const tag = await prisma.tag.findFirst({ where: { id: Number(id), tenantId }, select: { id: true } });
      if (!tag) return reply.code(404).send({ error: "not_found" });

      const body = (req.body || {}) as { contactId?: number; organizationId?: number; animalId?: number; messageThreadId?: number; draftId?: number; breedingPlanId?: number; offspringGroupId?: number; offspringId?: number };
      const targets = ["contactId", "organizationId", "animalId", "messageThreadId", "draftId", "breedingPlanId", "offspringGroupId", "offspringId"].filter((k) => (body as any)[k] != null);
      if (targets.length !== 1) return reply.code(400).send({ error: "one_target_required" });

      if (body.organizationId != null) {
        const orgId = parseIntOrNull(body.organizationId);
        if (!orgId) return reply.code(400).send({ error: "organizationId_invalid" });

        // Resolve to partyId and delete by taggedPartyId
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { partyId: true, tenantId: true },
        });
        if (!org) return reply.code(404).send({ error: "organization_not_found" });
        if (org.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });
        if (org.partyId) {
          await prisma.tagAssignment.deleteMany({ where: { tagId: tag.id, taggedPartyId: org.partyId } });
        }
      } else if (body.contactId != null) {
        const contactId = parseIntOrNull(body.contactId);
        if (!contactId) return reply.code(400).send({ error: "contactId_invalid" });

        // Resolve to partyId and delete by taggedPartyId
        const contact = await prisma.contact.findUnique({
          where: { id: contactId },
          select: { partyId: true, tenantId: true },
        });
        if (!contact) return reply.code(404).send({ error: "contact_not_found" });
        if (contact.tenantId !== tenantId) return reply.code(403).send({ error: "forbidden" });
        if (contact.partyId) {
          await prisma.tagAssignment.deleteMany({ where: { tagId: tag.id, taggedPartyId: contact.partyId } });
        }
      } else if (body.messageThreadId != null) {
        const threadId = parseIntOrNull(body.messageThreadId);
        if (!threadId) return reply.code(400).send({ error: "messageThreadId_invalid" });
        await prisma.tagAssignment.deleteMany({ where: { tagId: tag.id, messageThreadId: threadId } });
      } else if (body.draftId != null) {
        const draftIdVal = parseIntOrNull(body.draftId);
        if (!draftIdVal) return reply.code(400).send({ error: "draftId_invalid" });
        await prisma.tagAssignment.deleteMany({ where: { tagId: tag.id, draftId: draftIdVal } });
      } else if (body.breedingPlanId != null) {
        const planId = parseIntOrNull(body.breedingPlanId);
        if (!planId) return reply.code(400).send({ error: "breedingPlanId_invalid" });
        await prisma.tagAssignment.deleteMany({ where: { tagId: tag.id, breedingPlanId: planId } });
      } else if (body.offspringGroupId != null) {
        const groupId = parseIntOrNull(body.offspringGroupId);
        if (!groupId) return reply.code(400).send({ error: "offspringGroupId_invalid" });
        await prisma.tagAssignment.deleteMany({ where: { tagId: tag.id, offspringGroupId: groupId } });
      } else if (body.offspringId != null) {
        const offspringId = parseIntOrNull(body.offspringId);
        if (!offspringId) return reply.code(400).send({ error: "offspringId_invalid" });
        await prisma.tagAssignment.deleteMany({ where: { tagId: tag.id, offspringId } });
      } else if (body.animalId != null) {
        const animalId = parseIntOrNull(body.animalId);
        if (!animalId) return reply.code(400).send({ error: "animalId_invalid" });
        await prisma.tagAssignment.deleteMany({ where: { tagId: tag.id, animalId } });
      }

      reply.send({ ok: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /message-threads/:id/tags - Get tags for a message thread
  app.get("/message-threads/:id/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const threadId = Number(id);
      if (!Number.isInteger(threadId) || threadId <= 0) {
        return reply.code(400).send({ error: "invalid_thread_id" });
      }

      const thread = await prisma.messageThread.findFirst({
        where: { id: threadId, tenantId },
        select: { id: true },
      });
      if (!thread) return reply.code(404).send({ error: "thread_not_found" });

      const assignments = await prisma.tagAssignment.findMany({
        where: { messageThreadId: threadId },
        include: {
          tag: {
            select: { id: true, name: true, module: true, color: true, isArchived: true, archivedAt: true, createdAt: true, updatedAt: true },
          },
        },
      });

      const items = assignments.map((a) => tagDTO(a.tag));
      return reply.send({ items, total: items.length });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /drafts/:id/tags - Get tags for a draft
  app.get("/drafts/:id/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const draftId = Number(id);
      if (!Number.isInteger(draftId) || draftId <= 0) {
        return reply.code(400).send({ error: "invalid_draft_id" });
      }

      const draft = await prisma.draft.findFirst({
        where: { id: draftId, tenantId },
        select: { id: true },
      });
      if (!draft) return reply.code(404).send({ error: "draft_not_found" });

      const assignments = await prisma.tagAssignment.findMany({
        where: { draftId },
        include: {
          tag: {
            select: { id: true, name: true, module: true, color: true, isArchived: true, archivedAt: true, createdAt: true, updatedAt: true },
          },
        },
      });

      const items = assignments.map((a) => tagDTO(a.tag));
      return reply.send({ items, total: items.length });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /breeding/plans/:id/tags - Get tags for a breeding plan
  app.get("/breeding/plans/:id/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const planId = Number(id);
      if (!Number.isInteger(planId) || planId <= 0) {
        return reply.code(400).send({ error: "invalid_plan_id" });
      }

      const plan = await prisma.breedingPlan.findFirst({
        where: { id: planId, tenantId },
        select: { id: true },
      });
      if (!plan) return reply.code(404).send({ error: "breeding_plan_not_found" });

      const assignments = await prisma.tagAssignment.findMany({
        where: { breedingPlanId: planId },
        include: {
          tag: {
            select: { id: true, name: true, module: true, color: true, isArchived: true, archivedAt: true, createdAt: true, updatedAt: true },
          },
        },
      });

      const items = assignments.map((a) => tagDTO(a.tag));
      return reply.send({ items, total: items.length });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /offspring/:id/tags - Get tags for an offspring group
  app.get("/offspring/:id/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const groupId = Number(id);
      if (!Number.isInteger(groupId) || groupId <= 0) {
        return reply.code(400).send({ error: "invalid_group_id" });
      }

      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
        select: { id: true },
      });
      if (!group) return reply.code(404).send({ error: "offspring_group_not_found" });

      const assignments = await prisma.tagAssignment.findMany({
        where: { offspringGroupId: groupId },
        include: {
          tag: {
            select: { id: true, name: true, module: true, color: true, isArchived: true, archivedAt: true, createdAt: true, updatedAt: true },
          },
        },
      });

      const items = assignments.map((a) => tagDTO(a.tag));
      return reply.send({ items, total: items.length });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /offspring/individuals/:id/tags - Get tags for an individual offspring
  app.get("/offspring/individuals/:id/tags", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const { id } = req.params as { id: string };
      const offspringId = Number(id);
      if (!Number.isInteger(offspringId) || offspringId <= 0) {
        return reply.code(400).send({ error: "invalid_offspring_id" });
      }

      const offspring = await prisma.offspring.findFirst({
        where: { id: offspringId, tenantId },
        select: { id: true },
      });
      if (!offspring) return reply.code(404).send({ error: "offspring_not_found" });

      const assignments = await prisma.tagAssignment.findMany({
        where: { offspringId },
        include: {
          tag: {
            select: { id: true, name: true, module: true, color: true, isArchived: true, archivedAt: true, createdAt: true, updatedAt: true },
          },
        },
      });

      const items = assignments.map((a) => tagDTO(a.tag));
      return reply.send({ items, total: items.length });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });
};

export default routes;
