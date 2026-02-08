// src/routes/rearing-import-export.ts
// Rearing Protocols API - Import/Export functionality
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

function idNum(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function trimToNull(v: any) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function errorReply(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[rearing-import-export]", msg);
  return { status: 500, payload: { error: "internal_error", message: msg } };
}

// Validate protocol structure
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  protocol?: any;
}

function validateProtocolJson(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required top-level fields
  if (!data.name || typeof data.name !== "string") {
    errors.push("Missing or invalid 'name' field");
  }
  if (!data.species || typeof data.species !== "string") {
    errors.push("Missing or invalid 'species' field");
  }
  if (typeof data.targetAgeStart !== "number" || data.targetAgeStart < 0) {
    errors.push("Missing or invalid 'targetAgeStart' field");
  }
  if (typeof data.targetAgeEnd !== "number" || data.targetAgeEnd < 0) {
    errors.push("Missing or invalid 'targetAgeEnd' field");
  }

  // Valid species
  const validSpecies = ["DOG", "CAT", "HORSE", "GOAT", "RABBIT", "SHEEP"];
  if (data.species && !validSpecies.includes(data.species)) {
    errors.push(`Invalid species: ${data.species}. Must be one of: ${validSpecies.join(", ")}`);
  }

  // Valid activity categories
  const validCategories = [
    "ENS", "ESI", "SOCIALIZATION", "HANDLING", "ENRICHMENT",
    "TRAINING", "HEALTH", "ASSESSMENT", "TRANSITION", "CUSTOM"
  ];

  // Valid frequencies
  const validFrequencies = [
    "ONCE", "DAILY", "TWICE_DAILY", "WEEKLY", "AS_AVAILABLE", "CHECKLIST"
  ];

  // Validate stages
  if (!Array.isArray(data.stages)) {
    errors.push("'stages' must be an array");
  } else if (data.stages.length === 0) {
    warnings.push("Protocol has no stages");
  } else {
    data.stages.forEach((stage: any, si: number) => {
      if (!stage.name) {
        errors.push(`Stage ${si + 1}: Missing 'name'`);
      }
      if (typeof stage.ageStartDays !== "number") {
        errors.push(`Stage ${si + 1}: Missing or invalid 'ageStartDays'`);
      }
      if (typeof stage.ageEndDays !== "number") {
        errors.push(`Stage ${si + 1}: Missing or invalid 'ageEndDays'`);
      }

      // Validate activities
      if (!Array.isArray(stage.activities)) {
        errors.push(`Stage ${si + 1}: 'activities' must be an array`);
      } else if (stage.activities.length === 0) {
        warnings.push(`Stage ${si + 1} (${stage.name || "unnamed"}): has no activities`);
      } else {
        stage.activities.forEach((activity: any, ai: number) => {
          if (!activity.name) {
            errors.push(`Stage ${si + 1}, Activity ${ai + 1}: Missing 'name'`);
          }
          if (!activity.category) {
            errors.push(`Stage ${si + 1}, Activity ${ai + 1}: Missing 'category'`);
          } else if (!validCategories.includes(activity.category)) {
            errors.push(`Stage ${si + 1}, Activity ${ai + 1}: Invalid category '${activity.category}'`);
          }
          if (!activity.frequency) {
            errors.push(`Stage ${si + 1}, Activity ${ai + 1}: Missing 'frequency'`);
          } else if (!validFrequencies.includes(activity.frequency)) {
            errors.push(`Stage ${si + 1}, Activity ${ai + 1}: Invalid frequency '${activity.frequency}'`);
          }
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    protocol: errors.length === 0 ? data : undefined,
  };
}

/* ───────────────────────── routes ───────────────────────── */

const rearingImportExportRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-protocols/import/validate - Validate JSON
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-protocols/import/validate", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const body = req.body as any;

      if (!body || typeof body !== "object") {
        return reply.code(400).send({
          valid: false,
          errors: ["Request body must be a valid JSON object"],
          warnings: [],
        });
      }

      // Handle case where protocol JSON is nested in a 'protocol' field
      const protocolData = body.protocol || body;

      const result = validateProtocolJson(protocolData);

      return reply.send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-protocols/import - Import protocol from JSON
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-protocols/import", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const body = req.body as any;
      const protocolData = body.protocol || body;

      // Validate first
      const validation = validateProtocolJson(protocolData);

      if (!validation.valid) {
        return reply.code(400).send({
          error: "validation_failed",
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }

      // Create protocol
      const protocol = await prisma.rearingProtocol.create({
        data: {
          tenantId,
          name: protocolData.name,
          description: trimToNull(protocolData.description),
          species: protocolData.species,
          targetAgeStart: protocolData.targetAgeStart,
          targetAgeEnd: protocolData.targetAgeEnd,
          estimatedDailyMinutes: protocolData.estimatedDailyMinutes ?? null,
          isBenchmark: false,
          isPublic: false,
          isActive: true,
          stages: {
            create: protocolData.stages.map((stage: any, si: number) => ({
              name: stage.name,
              description: trimToNull(stage.description),
              ageStartDays: stage.ageStartDays,
              ageEndDays: stage.ageEndDays,
              order: stage.order ?? si,
              activities: {
                create: (stage.activities || []).map((activity: any, ai: number) => ({
                  name: activity.name,
                  description: trimToNull(activity.description),
                  instructions: trimToNull(activity.instructions),
                  category: activity.category,
                  frequency: activity.frequency,
                  durationMinutes: activity.durationMinutes ?? null,
                  isRequired: activity.isRequired ?? true,
                  requiresEquipment: activity.requiresEquipment ?? [],
                  order: activity.order ?? ai,
                  checklistItems: activity.checklistItems ?? null,
                })),
              },
            })),
          },
        },
        include: {
          stages: {
            orderBy: { order: "asc" },
            include: {
              activities: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      });

      return reply.code(201).send({
        protocol,
        warnings: validation.warnings,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-protocols/:id/export - Export protocol as JSON
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-protocols/:id/export", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Get protocol (own or benchmark)
      const protocol = await prisma.rearingProtocol.findFirst({
        where: {
          id,
          OR: [
            { tenantId, deletedAt: null },
            { isBenchmark: true, tenantId: null },
          ],
        },
        include: {
          stages: {
            orderBy: { order: "asc" },
            include: {
              activities: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      });

      if (!protocol) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Build export object (strip internal fields)
      const exportData = {
        name: protocol.name,
        description: protocol.description,
        species: protocol.species,
        targetAgeStart: protocol.targetAgeStart,
        targetAgeEnd: protocol.targetAgeEnd,
        estimatedDailyMinutes: protocol.estimatedDailyMinutes,
        stages: protocol.stages.map((stage: any) => ({
          name: stage.name,
          description: stage.description,
          ageStartDays: stage.ageStartDays,
          ageEndDays: stage.ageEndDays,
          order: stage.order,
          activities: stage.activities.map((activity: any) => ({
            name: activity.name,
            description: activity.description,
            instructions: activity.instructions,
            category: activity.category,
            frequency: activity.frequency,
            durationMinutes: activity.durationMinutes,
            isRequired: activity.isRequired,
            requiresEquipment: activity.requiresEquipment,
            order: activity.order,
            checklistItems: activity.checklistItems,
          })),
        })),
        exportedAt: new Date().toISOString(),
        exportedFrom: {
          protocolId: protocol.id,
          version: protocol.version,
          isBenchmark: protocol.isBenchmark,
        },
      };

      // Set content-disposition header for download
      const q = (req.query as any) ?? {};
      if (q.download === "true") {
        const filename = `${protocol.name.replace(/[^a-z0-9]/gi, "_")}_v${protocol.version}.json`;
        reply.header("Content-Disposition", `attachment; filename="${filename}"`);
        reply.header("Content-Type", "application/json");
      }

      return reply.send(exportData);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });
};

export default rearingImportExportRoutes;
