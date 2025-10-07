// src/routes/contacts.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";

// ---------- zod schemas

const idParam = z.object({ id: z.coerce.number().int().positive() });

const commPrefsSchema = z.object({
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
  phone: z.boolean().optional(),
  mail: z.boolean().optional(),
}).strict().optional();

const baseContact = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  nickname: z.string().trim().nullable().optional(),

  email: z.string().email().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  phoneType: z.string().trim().nullable().optional(),
  whatsapp: z.boolean().nullable().optional(),
  whatsappPhone: z.string().trim().nullable().optional(),

  street: z.string().trim().nullable().optional(),
  street2: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  postalCode: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),

  organizationId: z.number().int().positive().nullable().optional(),

  status: z.enum(["ACTIVE", "INACTIVE", "Active", "Inactive"]).optional(),
  leadStatus: z.string().trim().nullable().optional(),

  commPrefs: commPrefsSchema,

  emailStatus: z.enum(["SUBSCRIBED", "UNSUBSCRIBED", "subscribed", "unsubscribed"]).nullable().optional(),
  smsStatus: z.enum(["SUBSCRIBED", "UNSUBSCRIBED", "subscribed", "unsubscribed"]).nullable().optional(),

  notes: z.string().nullable().optional(),

  tags: z.array(z.string().trim().min(1)).optional(),

  depositHolds: z.array(z.object({
    groupName: z.string().trim().min(1),
    queuePosition: z.coerce.number().int().min(1),
  })).optional(),

  lastContacted: z.string().datetime().nullable().optional(),
  nextFollowUp: z.string().datetime().nullable().optional(),
  // If your Zod version doesn’t support .date(), switch to .regex(/^\d{4}-\d{2}-\d{2}$/)
  birthday: (z.string() as any).date?.().nullable().optional() ?? z.string().nullable().optional(),
});

const createBody = baseContact;
const updateBody = baseContact.partial();

// ---------- helpers
function toContactStatus(input?: string) {
  if (!input) return undefined;
  const v = input.toUpperCase();
  if (v === "ACTIVE" || v === "INACTIVE") return v;
  return undefined;
}
function toCommStatus(input?: string | null) {
  if (input == null) return null;
  const v = input.toUpperCase();
  if (v === "SUBSCRIBED" || v === "UNSUBSCRIBED") return v;
  return null;
}

function computeDisplayName(nick?: string | null, first?: string | null, last?: string | null) {
  if (nick && nick.trim()) return nick.trim();
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  return [f, l].filter(Boolean).join(" ") || "Unnamed";
}

function iso(d: any) {
  return d instanceof Date ? d.toISOString() : (d ?? null);
}

function toDto(c: any) {
  const tagNames = Array.from(new Set(
    (c?.tagAssignments ?? []).map((ta: any) => ta?.tag?.name).filter((n: any) => !!n)
  ));
  return {
    id: String(c.id), // keep numeric for FE convenience
    firstName: c.firstName ?? null,
    lastName: c.lastName ?? null,
    nickname: c.nickname ?? null,
    cDisplayName: computeDisplayName(c.nickname, c.firstName, c.lastName),

    email: c.email ?? null,
    phone: c.phone ?? null,
    phoneType: c.phoneType ?? null,
    whatsapp: c.whatsapp ?? null,
    whatsappPhone: c.whatsappPhone ?? null,

    street: c.street ?? null,
    street2: c.street2 ?? null,
    city: c.city ?? null,
    state: c.state ?? null,
    postalCode: c.postalCode ?? null,
    country: c.country ?? null,

    organizationId: c.organizationId ?? null,
    organizationName: c.organization?.name ?? null,

    status: c.status === "INACTIVE" ? "Inactive" : "Active",
    leadStatus: c.leadStatus ?? null,

    commPrefs: c.commPrefs ?? null,

    emailStatus: c.emailStatus == null ? null : (c.emailStatus === "UNSUBSCRIBED" ? "unsubscribed" : "subscribed"),
    smsStatus: c.smsStatus == null ? null : (c.smsStatus === "UNSUBSCRIBED" ? "unsubscribed" : "subscribed"),

    notes: c.notes ?? null,

    tags: tagNames,

    depositHolds: (c.depositHolds ?? []).map((h: any) => ({
      groupName: h.groupName,
      queuePosition: h.queuePosition,
    })),

    archived: !!c.archivedAt,
    archivedAt: iso(c.archivedAt),
    archivedBy: c.archivedBy ?? null,
    archivedReason: c.archivedReason ?? null,

    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
    lastContacted: iso(c.lastContacted),
    nextFollowUp: iso(c.nextFollowUp),
    birthday: typeof c.birthday === "string" ? c.birthday : (c.birthday ? (c.birthday as Date).toISOString().slice(0, 10) : null),
  };
}

async function ensureArchivedTagId(): Promise<number> {
  const t = await prisma.tag.upsert({
    where: { name_type: { name: "Archived", type: "contact" } },
    update: {},
    create: { name: "Archived", type: "contact", color: "amber" },
    select: { id: true },
  });
  return t.id;
}

async function replaceTags(contactId: number, names: string[]) {
  const uniq = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)));
  if (!uniq.length) {
    await prisma.tagAssignment.deleteMany({ where: { contactId } });
    return;
  }
  const tagIds: number[] = [];
  for (const name of uniq) {
    const t = await prisma.tag.upsert({
      where: { name_type: { name, type: "contact" } },
      update: {},
      create: { name, type: "contact" },
      select: { id: true },
    });
    tagIds.push(t.id);
  }
  const existing = await prisma.tagAssignment.findMany({ where: { contactId }, select: { tagId: true } });
  const existingIds = new Set(existing.map(e => e.tagId));
  const desired = new Set(tagIds);

  const toAdd = [...desired].filter(id => !existingIds.has(id));
  const toRemove = [...existingIds].filter(id => !desired.has(id));

  if (toAdd.length) {
    await prisma.$transaction(
      toAdd.map(tagId => prisma.tagAssignment.upsert({
        where: { contactId_tagId: { contactId, tagId } },
        update: {},
        create: { contactId, tagId, targetType: "CONTACT" },
      }))
    );
  }
  if (toRemove.length) {
    await prisma.tagAssignment.deleteMany({ where: { contactId, tagId: { in: toRemove } } });
  }
}

async function replaceDepositHolds(contactId: number, holds: Array<{ groupName: string; queuePosition: number }>) {
  await prisma.contactDepositHold.deleteMany({ where: { contactId } });
  if (holds?.length) {
    await prisma.contactDepositHold.createMany({
      data: holds.map(h => ({ contactId, groupName: h.groupName, queuePosition: h.queuePosition })),
    });
  }
}

// ---------- routes export

export default async function contactsRoutes(app: FastifyInstance) {
  // Auth/org guard
  app.addHook("preHandler", async (req, reply) => {
    if (!req.url.startsWith("/api/v1/contacts")) return;

    // @ts-ignore
    let u = req.authUser;

    if ((!u || !u.id) && process.env.NODE_ENV !== "production") {
      const header = req.headers.authorization || "";
      const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;

      if (bearer && bearer === (process.env.ADMIN_TOKEN || "")) {
        const orgHdr = req.headers["x-org-id"];
        const orgId = orgHdr ? Number(orgHdr) : NaN;
        if (!Number.isFinite(orgId)) return reply.code(400).send({ error: "org_required" });
        // @ts-ignore
        u = { id: "dev-admin", email: "dev@local", orgId, role: "ADMIN" };
        // @ts-ignore
        req.authUser = u;
      }

      if (!u?.id && process.env.DEFAULT_DEV_USER_ID && process.env.DEFAULT_DEV_ORG_ID) {
        const envUser = String(process.env.DEFAULT_DEV_USER_ID);
        const envOrg = Number(process.env.DEFAULT_DEV_ORG_ID);
        if (Number.isFinite(envOrg)) {
          // @ts-ignore
          u = { id: envUser, email: "dev@local", orgId: envOrg, role: "ADMIN" };
          // @ts-ignore
          req.authUser = u;
          req.log.warn({ envUser, envOrg }, "DEV: using DEFAULT_DEV_* identity");
        }
      }
    }

    if (!u?.id) return reply.code(401).send({ error: "unauthorized" });
    if (!u?.orgId) return reply.code(400).send({ error: "org_required" });
  });

  // ---------- Affiliations (ContactAffiliation) ----------
  app.get("/api/v1/contacts/:id/affiliations", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    // @ts-ignore
    const orgId = req.authUser!.orgId!;
    // Ensure contact is visible in this tenant
    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, kind: true }
    });
    if (!contact || contact.kind === "SUBSCRIBER") return reply.code(404).send({ error: "not_found" });

    const rows = await prisma.contactAffiliation.findMany({
      where: { contactId: id },
      select: { organizationId: true },
      orderBy: { organizationId: "asc" },
    });
    reply.send(rows.map(r => ({ organizationId: r.organizationId })));
  });

  app.put("/api/v1/contacts/:id/affiliations", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    // @ts-ignore
    const orgId = req.authUser!.orgId!;
    const body = (req.body as any) ?? {};
    const organizationIds: number[] = Array.isArray(body.organizationIds)
      ? body.organizationIds.map(Number).filter(Number.isFinite)
      : [];

    // Ensure contact is visible in this tenant
    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, kind: true }
    });
    if (!contact || contact.kind === "SUBSCRIBER") return reply.code(404).send({ error: "not_found" });

    const uniq = Array.from(new Set(organizationIds));

    await prisma.$transaction(async (tx) => {
      await tx.contactAffiliation.deleteMany({ where: { contactId: id } });
      if (uniq.length) {
        await tx.contactAffiliation.createMany({
          data: uniq.map(oid => ({ contactId: id, organizationId: oid })),
          skipDuplicates: true,
        });
      }
    });

    const rows = await prisma.contactAffiliation.findMany({
      where: { contactId: id },
      select: { organizationId: true },
      orderBy: { organizationId: "asc" },
    });
    reply.send(rows.map(r => ({ organizationId: r.organizationId })));
  });

  // ---------- List ----------
  app.get("/api/v1/contacts", async (req, reply) => {
    const q = (req.query as any)?.q?.toString?.() || "";
    const page = Math.max(1, parseInt((req.query as any)?.page ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query as any)?.limit ?? "50", 10)));
    const includeArchived = String((req.query as any)?.includeArchived ?? "false") === "true";

    // ✅ pull org + auth email from auth guard
    // @ts-ignore
    const orgId = req.authUser!.orgId! as number;
    // @ts-ignore
    const authEmail = req.authUser!.email! as string;

    // optional exact email filter (used by Settings → Profile)
    const emailParam = ((req.query as any)?.email ?? "").toString().trim() || null;

    // ✅ only allow the caller’s own SUBSCRIBER row when email=<authEmail>
    const subscriberAllowance =
      emailParam && emailParam.toLowerCase() === authEmail.toLowerCase()
        ? [{ AND: [{ kind: "SUBSCRIBER" }, { email: { equals: authEmail, mode: "insensitive" } }] }]
        : [];

    const where: any = {
      AND: [
        { organizationId: orgId },
        emailParam ? { email: { equals: emailParam, mode: "insensitive" } } : {},
        {
          OR: [
            { kind: { not: "SUBSCRIBER" } }, // ✅ hide subscribers from normal lists
            ...subscriberAllowance,          // ✅ allow only the caller’s own when email= matches
          ],
        },
        q
          ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { nickname: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
          : {},
        includeArchived ? {} : { archivedAt: null },
      ],
    };

    const [total, rows] = await prisma.$transaction([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          organization: true,
          tagAssignments: { include: { tag: true } },
          depositHolds: true,
        },
      }),
    ]);

    reply.send({ page, limit, total, data: rows.map(toDto) });
  });

  // ---------- Get one ----------
  app.get("/api/v1/contacts/:id", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    // @ts-ignore
    const orgId = req.authUser!.orgId!;
    const c = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
      include: {
        organization: true,
        tagAssignments: { include: { tag: true } },
        depositHolds: true,
      },
    });
    if (!c || c.kind === "SUBSCRIBER") return reply.code(404).send({ error: "not_found" });
    reply.send(toDto(c));
  });

  // ---------- Create ----------
  app.post("/api/v1/contacts", async (req, reply) => {
    const p = createBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", details: p.error.flatten() });
    const b = p.data;

    // @ts-ignore
    const orgId = req.authUser!.orgId!;

    const created = await prisma.contact.create({
      data: {
        firstName: b.firstName ?? "",
        lastName: b.lastName ?? "",
        nickname: b.nickname ?? null,
        displayName: computeDisplayName(b.nickname ?? null, b.firstName ?? null, b.lastName ?? null),

        email: b.email ?? null,
        phone: b.phone ?? null,
        phoneType: b.phoneType ?? null,
        whatsapp: b.whatsapp ?? null,
        whatsappPhone: b.whatsappPhone ?? null,

        street: b.street ?? null,
        street2: b.street2 ?? null,
        city: b.city ?? null,
        state: b.state ?? null,
        postalCode: b.postalCode ?? null,
        country: b.country ?? null,

        organizationId: orgId, // enforce caller’s org
        status: (toContactStatus(b.status) ?? "ACTIVE") as any,
        leadStatus: b.leadStatus ?? null,

        commPrefs: b.commPrefs ?? undefined,

        emailStatus: toCommStatus(b.emailStatus) as any,
        smsStatus: toCommStatus(b.smsStatus) as any,

        notes: b.notes ?? null,

        lastContacted: b.lastContacted ? new Date(b.lastContacted) : null,
        nextFollowUp: b.nextFollowUp ? new Date(b.nextFollowUp) : null,
        birthday: b.birthday ? new Date(b.birthday) : null,
      },
      include: {
        organization: true,
        tagAssignments: { include: { tag: true } },
        depositHolds: true,
      },
    });

    if (b.tags) await replaceTags(created.id, b.tags);
    if (b.depositHolds) await replaceDepositHolds(created.id, b.depositHolds);

    const fresh = await prisma.contact.findFirst({
      where: { id: created.id, organizationId: orgId },
      include: { organization: true, tagAssignments: { include: { tag: true } }, depositHolds: true },
    });

    reply.code(201).send(toDto(fresh));
  });

  // ---------- Update ----------
  app.patch("/api/v1/contacts/:id", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    // @ts-ignore
    const orgId = req.authUser!.orgId!;
    const prev = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
    if (!prev || prev.kind === "SUBSCRIBER") return reply.code(404).send({ error: "not_found" });

    const p = updateBody.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "validation_error", details: p.error.flatten() });
    const b = p.data;

    await prisma.contact.updateMany({
      where: { id, organizationId: orgId },
      data: {
        firstName: b.firstName ?? undefined,
        lastName: b.lastName ?? undefined,
        nickname: b.nickname === undefined ? undefined : b.nickname,
        displayName: b.nickname !== undefined || b.firstName !== undefined || b.lastName !== undefined
          ? computeDisplayName(b.nickname ?? prev.nickname, b.firstName ?? prev.firstName, b.lastName ?? prev.lastName)
          : undefined,

        email: b.email === undefined ? undefined : b.email,
        phone: b.phone === undefined ? undefined : b.phone,
        phoneType: b.phoneType === undefined ? undefined : b.phoneType,
        whatsapp: b.whatsapp === undefined ? undefined : b.whatsapp,
        whatsappPhone: b.whatsappPhone === undefined ? undefined : b.whatsappPhone,

        street: b.street === undefined ? undefined : b.street,
        street2: b.street2 === undefined ? undefined : b.street2,
        city: b.city === undefined ? undefined : b.city,
        state: b.state === undefined ? undefined : b.state,
        postalCode: b.postalCode === undefined ? undefined : b.postalCode,
        country: b.country === undefined ? undefined : b.country,

        organizationId: undefined, // never allow cross-tenant moves

        status: b.status === undefined ? undefined : (toContactStatus(b.status) as any),
        leadStatus: b.leadStatus === undefined ? undefined : b.leadStatus,

        commPrefs: b.commPrefs ?? undefined,

        emailStatus: b.emailStatus === undefined ? undefined : (toCommStatus(b.emailStatus) as any),
        smsStatus: b.smsStatus === undefined ? undefined : (toCommStatus(b.smsStatus) as any),

        notes: b.notes === undefined ? undefined : b.notes,

        lastContacted: b.lastContacted === undefined ? undefined : (b.lastContacted ? new Date(b.lastContacted) : null),
        nextFollowUp: b.nextFollowUp === undefined ? undefined : (b.nextFollowUp ? new Date(b.nextFollowUp) : null),
        birthday: b.birthday === undefined ? undefined : (b.birthday ? new Date(b.birthday) : null),
      },
    });

    if (b.tags) await replaceTags(id, b.tags);
    if (b.depositHolds) await replaceDepositHolds(id, b.depositHolds);

    const fresh = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
      include: { organization: true, tagAssignments: { include: { tag: true } }, depositHolds: true },
    });
    reply.send(toDto(fresh));
  });

  // ---------- Archive ----------
  app.delete("/api/v1/contacts/:id", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    // @ts-ignore
    const orgId = req.authUser!.orgId!;
    const reason = (req.body as any)?.reason?.toString?.() || null;

    const prev = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
    if (!prev) return reply.code(404).send({ error: "not_found" });

    await prisma.contact.updateMany({
      where: { id, organizationId: orgId },
      data: { archivedAt: new Date(), archivedBy: null, archivedReason: reason },
    });

    try {
      const tagId = await ensureArchivedTagId();
      const existing = await prisma.tagAssignment.findFirst({
        where: { contactId: id, tagId: tagId, targetType: "CONTACT" },
        select: { id: true },
      });
      if (!existing) {
        await prisma.tagAssignment.create({
          data: { contactId: id, tagId: tagId, targetType: "CONTACT" },
        });
      }
    } catch (err) {
      req.log.warn({ err }, "Non-fatal: failed to apply Archived tag");
    }

    const fresh = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
      include: { organization: true, tagAssignments: { include: { tag: true } }, depositHolds: true },
    });
    reply.send(toDto(fresh));
  });

  // ---------- Restore ----------
  app.post("/api/v1/contacts/:id/restore", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    // @ts-ignore
    const orgId = req.authUser!.orgId!;

    const prev = await prisma.contact.findFirst({ where: { id, organizationId: orgId } });
    if (!prev) return reply.code(404).send({ error: "not_found" });

    await prisma.contact.updateMany({
      where: { id, organizationId: orgId },
      data: { archivedAt: null, archivedBy: null, archivedReason: null },
    });

    await prisma.tagAssignment.deleteMany({
      where: { contactId: id, tag: { name: "Archived" } },
    });

    const fresh = await prisma.contact.findFirst({
      where: { id, organizationId: orgId },
      include: { organization: true, tagAssignments: { include: { tag: true } }, depositHolds: true },
    });
    reply.send(toDto(fresh));
  });

  // ---------- Audit (optional) ----------
  app.get("/api/v1/contacts/:id/audit", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    if ((prisma as any).auditLog?.findMany) {
      const rows = await (prisma as any).auditLog.findMany({
        where: { entityType: "contact", entityId: String(id) },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return reply.send(rows.map((r: any) => ({
        id: String(r.id),
        action: r.action,
        field: r.field ?? null,
        before: r.before ?? null,
        after: r.after ?? null,
        reason: r.reason ?? null,
        userId: r.userId ?? null,
        userEmail: r.userEmail ?? null,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      })));
    }
    return reply.send([]);
  });
}
