// src/routes/animal-health-export.ts
/**
 * Animal Health Export Routes
 *
 * PDF download, stall card, email via Resend, PIN-secured share links.
 *
 * Routes:
 *   GET  /animals/:animalId/health-report/pdf?months=12       Download full report PDF
 *   GET  /animals/:animalId/health-report/stall-card          Download stall card PDF
 *   POST /animals/:animalId/health-report/email               Email report to vet
 *   POST /animals/:animalId/health-report/share               Generate PIN-secured share link
 *   GET  /health-report/shared/:code                          Public: access shared report (PIN required)
 */
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { generateHealthReportPdf } from "../services/health-report-pdf-builder.js";
import type {
  HealthReportData,
  HealthReportMedication,
  HealthReportVaccination,
  HealthReportClearance,
} from "../services/health-report-pdf-builder.js";
import { generateStallCardPdf } from "../services/stall-card-pdf-builder.js";
import type { StallCardData, StallCardMedication } from "../services/stall-card-pdf-builder.js";
import { renderHealthReportEmail } from "../services/email-templates.js";
import { getResendClient, buildFromAddress } from "../services/email-service.js";
import crypto from "crypto";

// ────────────────────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────────────────────

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: "missing_tenant" });
    return null;
  }
  return tenantId;
}

async function assertAnimalInTenant(animalId: number, tenantId: number) {
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      species: true,
      breed: true,
      birthDate: true,
      sex: true,
      microchip: true,
      registryIds: { select: { identifier: true }, take: 1 },
    },
  });
  if (!animal) throw Object.assign(new Error("animal_not_found"), { statusCode: 404 });
  if (animal.tenantId !== tenantId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  return animal;
}

// ────────────────────────────────────────────────────────────────────────────
// Data Assembly — builds HealthReportData from DB
// ────────────────────────────────────────────────────────────────────────────

async function assembleHealthReportData(
  animalId: number,
  tenantId: number,
  historyMonths: number
): Promise<HealthReportData> {
  const animal = await assertAnimalInTenant(animalId, tenantId);

  // Fetch tenant/org name
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, organizations: { select: { name: true }, take: 1 } },
  });

  // Fetch owner info (primary owner via AnimalOwner → Party)
  const ownerLink = await prisma.animalOwner.findFirst({
    where: { animalId, isPrimary: true },
    select: { party: { select: { name: true } } },
  });
  const ownerName = ownerLink?.party?.name || null;

  // ── Current medications ──
  const medicationCourses = await prisma.medicationCourse.findMany({
    where: {
      animalId,
      tenantId,
      deletedAt: null,
      status: { in: ["ACTIVE", "SCHEDULED"] },
    },
    include: { MedicationDose: { orderBy: { administeredAt: "desc" } } },
    orderBy: { startDate: "desc" },
  });

  const currentMedications: HealthReportMedication[] = medicationCourses.map((c) => ({
    medicationName: c.medicationName,
    dosageAmount: c.dosageAmount ? Number(c.dosageAmount) : null,
    dosageUnit: c.dosageUnit,
    administrationRoute: c.administrationRoute,
    frequency: c.frequency || "ONCE",
    startDate: c.startDate.toISOString(),
    endDate: c.endDate?.toISOString() || null,
    status: c.status,
    completedDoses: c.completedDoses,
    totalDoses: c.totalDoses,
    nextDueDate: c.nextDueDate?.toISOString() || null,
    withdrawalPeriodDays: c.withdrawalPeriodDays,
    withdrawalExpiryDate: c.withdrawalExpiryDate?.toISOString() || null,
    isControlledSubstance: c.isControlledSubstance,
  }));

  // ── Medication history (completed/discontinued in last N months) ──
  const historyStart = new Date();
  historyStart.setMonth(historyStart.getMonth() - historyMonths);

  const historyCourses = await prisma.medicationCourse.findMany({
    where: {
      animalId,
      tenantId,
      deletedAt: null,
      status: { in: ["COMPLETED", "DISCONTINUED"] },
      updatedAt: { gte: historyStart },
    },
    orderBy: { startDate: "desc" },
  });

  const medicationHistory: HealthReportMedication[] = historyCourses.map((c) => ({
    medicationName: c.medicationName,
    dosageAmount: c.dosageAmount ? Number(c.dosageAmount) : null,
    dosageUnit: c.dosageUnit,
    administrationRoute: c.administrationRoute,
    frequency: c.frequency || "ONCE",
    startDate: c.startDate.toISOString(),
    endDate: c.endDate?.toISOString() || null,
    status: c.status,
    completedDoses: c.completedDoses,
    totalDoses: c.totalDoses,
    nextDueDate: null,
    withdrawalPeriodDays: c.withdrawalPeriodDays,
    withdrawalExpiryDate: c.withdrawalExpiryDate?.toISOString() || null,
    isControlledSubstance: c.isControlledSubstance,
  }));

  // ── Vaccination records ──
  const vaccRecords = await prisma.vaccinationRecord.findMany({
    where: { animalId, tenantId },
    orderBy: { administeredAt: "desc" },
  });

  // Group by protocol key, compute status
  const vaccByProtocol = new Map<string, typeof vaccRecords>();
  for (const r of vaccRecords) {
    const key = r.protocolKey;
    if (!vaccByProtocol.has(key)) vaccByProtocol.set(key, []);
    vaccByProtocol.get(key)!.push(r);
  }

  const vaccinations: HealthReportVaccination[] = Array.from(vaccByProtocol.entries()).map(
    ([protocolKey, records]) => {
      const latest = records[0]; // Already sorted desc
      const now = new Date();
      let status: "current" | "overdue" | "due_soon" | "not_started" = "not_started";
      let expiresAt: string | null = null;

      if (latest.expiresAt) {
        expiresAt = latest.expiresAt.toISOString();
        if (latest.expiresAt < now) {
          status = "overdue";
        } else {
          const daysTillExpiry = Math.ceil((latest.expiresAt.getTime() - now.getTime()) / 86400000);
          status = daysTillExpiry <= 30 ? "due_soon" : "current";
        }
      } else if (latest.administeredAt) {
        status = "current";
      }

      return {
        protocolName: protocolKey,
        lastAdministered: latest.administeredAt?.toISOString() || null,
        expiresAt,
        status,
      };
    }
  );

  // ── Health clearances (from traits) ──
  const clearanceKeys = ["coggins_status", "coggins_date", "bse_status", "lameness_exam"];
  const traitValues = await prisma.animalTraitValue.findMany({
    where: {
      animalId,
      traitDefinition: { key: { in: clearanceKeys } },
    },
    select: {
      traitDefinition: { select: { key: true } },
      valueText: true,
      valueDate: true,
      valueBoolean: true,
    },
  });

  const traitMap = new Map(traitValues.map((t) => [t.traitDefinition.key, t]));
  const clearances: HealthReportClearance[] = [];

  const cogginsStatus = traitMap.get("coggins_status");
  const cogginsDate = traitMap.get("coggins_date");
  if (cogginsStatus) {
    const val = cogginsStatus.valueText?.toLowerCase();
    clearances.push({
      name: "Coggins (EIA)",
      value: cogginsStatus.valueText || undefined,
      date: cogginsDate?.valueDate?.toISOString() || cogginsDate?.valueText || undefined,
      status: val === "negative" ? "clear" : val === "positive" ? "positive" : "unknown",
    });
  }

  const bseStatus = traitMap.get("bse_status");
  if (bseStatus) {
    const val = bseStatus.valueText?.toLowerCase();
    clearances.push({
      name: "BSE Status",
      value: bseStatus.valueText || undefined,
      date: undefined,
      status: val === "clear" || val === "negative" ? "clear" : val === "positive" ? "positive" : "unknown",
    });
  }

  const lamenessExam = traitMap.get("lameness_exam");
  if (lamenessExam) {
    const val = lamenessExam.valueText?.toLowerCase();
    clearances.push({
      name: "Lameness Exam",
      value: lamenessExam.valueText || undefined,
      date: undefined,
      status: val === "clear" || val === "sound" ? "clear" : val && val !== "unknown" ? "positive" : "unknown",
    });
  }

  const orgName = tenant?.organizations?.[0]?.name || tenant?.name || null;

  return {
    animal: {
      id: animal.id,
      name: animal.name,
      species: animal.species,
      breed: animal.breed,
      dateOfBirth: animal.birthDate?.toISOString() || null,
      sex: animal.sex,
      registrationNumber: animal.registryIds?.[0]?.identifier || null,
      microchipId: animal.microchip,
      ownerName,
      organizationName: orgName,
    },
    currentMedications,
    medicationHistory,
    vaccinations,
    clearances,
    generatedAt: new Date(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Share Link Store (in-memory, TTL-based)
// PIN-secured, 72h TTL, 5-attempt lockout
// ────────────────────────────────────────────────────────────────────────────

interface ShareLinkEntry {
  code: string;
  pin: string;
  animalId: number;
  tenantId: number;
  historyMonths: number;
  createdAt: number;
  expiresAt: number;
  failedAttempts: number;
  locked: boolean;
}

const shareLinkStore = new Map<string, ShareLinkEntry>();

// Cleanup expired entries periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of shareLinkStore) {
    if (entry.expiresAt < now) {
      shareLinkStore.delete(code);
    }
  }
}, 10 * 60 * 1000);

function generateShareCode(): string {
  return crypto.randomBytes(4).toString("hex"); // 8-char alphanumeric
}

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
}

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

const animalHealthExportRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {

  // ─── GET /animals/:animalId/health-report/pdf ───
  app.get("/animals/:animalId/health-report/pdf", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as any).animalId);
    if (!animalId) return reply.code(400).send({ error: "invalid_animal_id" });

    const months = Number((req.query as any).months) || 12;
    const data = await assembleHealthReportData(animalId, tenantId, months);
    const { buffer, filename } = await generateHealthReportPdf(data);

    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(Buffer.from(buffer));
  });

  // ─── GET /animals/:animalId/health-report/stall-card ───
  app.get("/animals/:animalId/health-report/stall-card", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as any).animalId);
    if (!animalId) return reply.code(400).send({ error: "invalid_animal_id" });

    const reportData = await assembleHealthReportData(animalId, tenantId, 0);

    // Collect adverse reactions from medication doses
    const allCourses = await prisma.medicationCourse.findMany({
      where: { animalId, tenantId, deletedAt: null },
      include: { MedicationDose: { where: { adverseReaction: { not: null } }, select: { adverseReaction: true } } },
    });
    const allergies = allCourses
      .flatMap((c) => c.MedicationDose.map((d) => d.adverseReaction))
      .filter((r): r is string => !!r);
    const uniqueAllergies = [...new Set(allergies)];

    // Emergency vet: use last prescribing vet from active medications
    const latestCourse = await prisma.medicationCourse.findFirst({
      where: { animalId, tenantId, deletedAt: null, prescribingVet: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { prescribingVet: true, clinic: true },
    });

    const stallCardData: StallCardData = {
      animal: {
        name: reportData.animal.name,
        species: reportData.animal.species,
        breed: reportData.animal.breed,
        sex: reportData.animal.sex,
        dateOfBirth: reportData.animal.dateOfBirth,
      },
      activeMedications: reportData.currentMedications.map((m): StallCardMedication => ({
        medicationName: m.medicationName,
        dosageAmount: m.dosageAmount,
        dosageUnit: m.dosageUnit,
        frequency: m.frequency,
        administrationRoute: m.administrationRoute,
        nextDueDate: m.nextDueDate,
        isControlledSubstance: m.isControlledSubstance,
      })),
      allergiesAndReactions: uniqueAllergies,
      emergencyVet: latestCourse?.prescribingVet
        ? { name: latestCourse.prescribingVet, clinic: latestCourse.clinic || undefined }
        : null,
      generatedAt: new Date(),
    };

    const { buffer, filename } = await generateStallCardPdf(stallCardData);

    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(Buffer.from(buffer));
  });

  // ─── POST /animals/:animalId/health-report/email ───
  app.post("/animals/:animalId/health-report/email", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as any).animalId);
    if (!animalId) return reply.code(400).send({ error: "invalid_animal_id" });

    const body = req.body as {
      recipientEmail?: string;
      recipientName?: string;
      message?: string;
    };

    if (!body.recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.recipientEmail)) {
      return reply.code(400).send({ error: "valid_email_required" });
    }

    const data = await assembleHealthReportData(animalId, tenantId, 12);
    const { buffer, filename } = await generateHealthReportPdf(data);

    // Render email template
    const { subject, html, text } = renderHealthReportEmail({
      animalName: data.animal.name,
      organizationName: data.animal.organizationName || "BreederHQ User",
      recipientName: body.recipientName,
      message: body.message,
      activeMedicationCount: data.currentMedications.length,
      hasActiveWithdrawals: data.currentMedications.some(
        (m) => m.withdrawalExpiryDate && new Date(m.withdrawalExpiryDate) > new Date()
      ),
    });

    // Send via Resend with PDF attachment
    const resend = getResendClient();
    const from = buildFromAddress(data.animal.organizationName || "BreederHQ", "health-reports");

    const { data: sendResult, error } = await resend.emails.send({
      from,
      to: body.recipientEmail,
      subject,
      html,
      text,
      attachments: [
        {
          filename,
          content: Buffer.from(buffer).toString("base64"),
        },
      ],
    });

    if (error) {
      app.log.error({ error }, "Failed to send health report email");
      return reply.code(500).send({ error: "email_send_failed" });
    }

    return reply.send({ success: true, messageId: sendResult?.id });
  });

  // ─── POST /animals/:animalId/health-report/share ───
  app.post("/animals/:animalId/health-report/share", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as any).animalId);
    if (!animalId) return reply.code(400).send({ error: "invalid_animal_id" });

    // Verify animal belongs to tenant
    await assertAnimalInTenant(animalId, tenantId);

    const code = generateShareCode();
    const pin = generatePin();
    const TTL_HOURS = 72;
    const now = Date.now();

    shareLinkStore.set(code, {
      code,
      pin,
      animalId,
      tenantId,
      historyMonths: 12,
      createdAt: now,
      expiresAt: now + TTL_HOURS * 60 * 60 * 1000,
      failedAttempts: 0,
      locked: false,
    });

    const shareUrl = `https://app.breederhq.com/shared/health/${code}`;
    const expiresAt = new Date(now + TTL_HOURS * 60 * 60 * 1000).toISOString();

    return reply.code(201).send({
      url: shareUrl,
      code,
      pin,
      expiresAt,
      ttlHours: TTL_HOURS,
    });
  });

};

/**
 * Public shared health report route (no auth required).
 * Registered outside the authenticated scope in server.ts.
 */
export const publicHealthReportSharedRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─── GET /health-report/shared/:code ─── Public endpoint (PIN required)
  app.get("/health-report/shared/:code", async (req, reply) => {
    const { code } = req.params as { code: string };
    const { pin } = req.query as { pin?: string };

    if (!code) return reply.code(400).send({ error: "code_required" });

    const entry = shareLinkStore.get(code);

    if (!entry) {
      return reply.code(404).send({ error: "share_link_not_found" });
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      shareLinkStore.delete(code);
      return reply.code(410).send({ error: "share_link_expired" });
    }

    // Check lockout
    if (entry.locked) {
      return reply.code(423).send({ error: "share_link_locked", message: "Too many failed PIN attempts. This link is locked." });
    }

    // Verify PIN
    if (!pin) {
      return reply.code(401).send({ error: "pin_required" });
    }

    if (pin !== entry.pin) {
      entry.failedAttempts++;
      if (entry.failedAttempts >= 5) {
        entry.locked = true;
        return reply.code(423).send({ error: "share_link_locked", message: "Too many failed PIN attempts. This link is locked." });
      }
      return reply.code(401).send({
        error: "invalid_pin",
        attemptsRemaining: 5 - entry.failedAttempts,
      });
    }

    // PIN correct — generate and return PDF
    const data = await assembleHealthReportData(entry.animalId, entry.tenantId, entry.historyMonths);
    const { buffer, filename } = await generateHealthReportPdf(data);

    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `inline; filename="${filename}"`)
      .send(Buffer.from(buffer));
  });
};

export default animalHealthExportRoutes;
