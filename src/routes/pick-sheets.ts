/**
 * Pick Sheet PDF Routes
 *
 * Generates printable pick sheets for breeding plan buyers.
 * Each sheet shows available offspring with space to rank preferences.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import {
  buildPickSheetPdf,
  buildCombinedPickSheetsPdf,
  type PickSheetData,
  type PickSheetOffspring,
} from "../services/pick-sheet-pdf.js";

/* ───────────────────────── helpers ───────────────────────── */

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function resolveTenantIdFromRequest(req: { headers?: Record<string, unknown> }): number | null {
  const h = req.headers?.["x-tenant-id"];
  if (typeof h === "string") return toNum(h);
  if (typeof h === "number") return toNum(h);
  return null;
}

/* ───────────────────────── routes ───────────────────────── */

const pickSheetsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Enforce tenant context
  app.addHook("preHandler", async (req, reply) => {
    let tenantId: number | null = toNum((req as any).tenantId);
    if (!tenantId) {
      tenantId = resolveTenantIdFromRequest(req as any);
      if (tenantId) (req as any).tenantId = tenantId;
    }
    if (!tenantId) {
      return reply
        .code(400)
        .send({ message: "Missing or invalid tenant context (X-Tenant-Id or session tenant)" });
    }
  });

  /**
   * GET /breeding/plans/:planId/pick-sheets
   * Generate pick sheet PDF(s) for a breeding plan.
   *
   * Query params:
   *   ?buyerId=X  — single buyer pick sheet (returns one PDF)
   *   (no buyerId) — all assigned buyers (returns combined multi-page PDF)
   */
  app.get<{
    Params: { planId: string };
    Querystring: { buyerId?: string };
  }>(
    "/breeding/plans/:planId/pick-sheets",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        // Fetch plan with dam, sire, tenant
        const plan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId, deletedAt: null },
          include: {
            dam: { select: { id: true, name: true } },
            sire: { select: { id: true, name: true } },
            tenant: { select: { name: true } },
          },
        });

        if (!plan) {
          return reply.code(404).send({ error: "plan_not_found" });
        }

        // Fetch available offspring (alive, not keepers, not deceased)
        const offspring = await prisma.offspring.findMany({
          where: {
            breedingPlanId: planId,
            tenantId,
            lifeState: { not: "DECEASED" },
            keeperIntent: { notIn: ["KEEP", "WITHHELD"] },
          },
          select: {
            id: true,
            name: true,
            sex: true,
            collarColorName: true,
            collarColorHex: true,
          },
          orderBy: [{ collarColorName: "asc" }, { name: "asc" }],
        });

        const offspringList: PickSheetOffspring[] = offspring.map((o) => ({
          id: o.id,
          name: o.name,
          sex: o.sex,
          collarColorName: o.collarColorName,
          collarColorHex: o.collarColorHex,
          photoUrl: null, // Photos not embedded in initial version
        }));

        // Fetch buyers — either specific buyer or all assigned buyers
        const buyerIdParam = req.query.buyerId ? toNum(req.query.buyerId) : null;

        const buyerWhere: any = {
          planId,
          tenantId,
          stage: {
            in: [
              "ASSIGNED",
              "DEPOSIT_PAID",
              "AWAITING_PICK",
              "MATCHED_TO_OFFSPRING",
              "MATCH_PROPOSED",
              "VISIT_SCHEDULED",
              "PICKUP_SCHEDULED",
            ],
          },
        };

        if (buyerIdParam) {
          buyerWhere.id = buyerIdParam;
        }

        const buyers = await prisma.breedingPlanBuyer.findMany({
          where: buyerWhere,
          include: {
            waitlistEntry: {
              include: {
                clientParty: { select: { name: true } },
              },
            },
            party: { select: { name: true } },
          },
          orderBy: { priority: "asc" },
        });

        if (buyers.length === 0) {
          return reply.code(404).send({
            error: "no_buyers",
            message: buyerIdParam
              ? "Buyer not found or not in an eligible stage"
              : "No assigned buyers found for this plan",
          });
        }

        // Build total picks count from all eligible buyers
        const totalPicks = buyers.length;

        // Build pick sheet data for each buyer
        const sheets: PickSheetData[] = buyers.map((b, index) => {
          const buyerName =
            b.waitlistEntry?.clientParty?.name ||
            b.party?.name ||
            "Unknown Buyer";

          return {
            planName: plan.name,
            damName: plan.dam?.name ?? null,
            sireName: plan.sire?.name ?? null,
            breederName: plan.tenant.name,
            buyer: {
              buyerId: b.id,
              buyerName,
              pickNumber: b.priority ?? index + 1,
              totalPicks,
            },
            offspring: offspringList,
            generatedAt: new Date(),
          };
        });

        // Generate PDF
        let pdfBuffer: Uint8Array;
        let filename: string;

        if (sheets.length === 1) {
          pdfBuffer = await buildPickSheetPdf(sheets[0]);
          const sanitized = sheets[0].buyer.buyerName.replace(/[^a-zA-Z0-9-_ ]/g, "");
          filename = `Pick-Sheet-${sanitized}.pdf`;
        } else {
          pdfBuffer = await buildCombinedPickSheetsPdf(sheets);
          const sanitizedPlan = plan.name.replace(/[^a-zA-Z0-9-_ ]/g, "");
          filename = `Pick-Sheets-${sanitizedPlan}.pdf`;
        }

        return reply
          .code(200)
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .send(Buffer.from(pdfBuffer));
      } catch (err) {
        console.error("[pick-sheets] Error generating pick sheet:", err);
        const message = err instanceof Error ? err.message : "internal_error";
        return reply.code(500).send({ error: "internal_error", message });
      }
    }
  );
};

export default pickSheetsRoutes;
