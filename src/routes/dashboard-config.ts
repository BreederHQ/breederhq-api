// src/routes/dashboard-config.ts
// Dashboard configuration API
//
// The API only stores/retrieves configuration - it does NOT define presets.
// Preset definitions live in the frontend (apps/platform/src/features/dashboard/presets/).
// This separation keeps presentation concerns in the frontend.
//
// GET  /api/v1/dashboard/config           - Get current config (or null if none)
// PUT  /api/v1/dashboard/config           - Update config
// DELETE /api/v1/dashboard/config         - Reset to default (delete saved config)
// GET  /api/v1/dashboard/presets          - List custom presets
// POST /api/v1/dashboard/presets          - Create custom preset
// DELETE /api/v1/dashboard/presets/:id    - Delete custom preset

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";
import crypto from "crypto";

// ───────────────────────── Constants ─────────────────────────

const DASHBOARD_CONFIG_NS = "dashboard.config";
const DASHBOARD_PRESETS_NS = "dashboard.presets";

// ───────────────────────── Types ─────────────────────────

type WidgetSize = "small" | "medium" | "large" | "full";

interface WidgetPlacement {
  widgetId: string;
  size: WidgetSize;
  order: number;
  collapsed?: boolean;
  settings?: Record<string, unknown>;
}

interface DashboardPreferences {
  compactMode: boolean;
  showEmptyWidgets: boolean;
  refreshInterval: number;
}

interface DashboardLayoutConfig {
  version: number;
  presetId: string;
  presetName: string;
  species?: string[];
  widgets: WidgetPlacement[];
  layouts: {
    desktop: WidgetPlacement[];
    tablet: WidgetPlacement[];
    mobile: WidgetPlacement[];
  };
  preferences: DashboardPreferences;
}

interface DashboardPreset {
  id: string;
  name: string;
  description: string;
  species?: string[];
  isSystem: boolean;
  isDefault: boolean;
  config: DashboardLayoutConfig;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

// ───────────────────────── Helpers ─────────────────────────

function generatePresetId(): string {
  return `custom-${crypto.randomBytes(8).toString("hex")}`;
}

async function getTenantFromRequest(req: any): Promise<number | null> {
  const tenantId = Number(req.tenantId);
  return Number.isFinite(tenantId) && tenantId > 0 ? tenantId : null;
}

async function readTenantSetting<T>(
  tenantId: number,
  namespace: string,
  fallback: T
): Promise<{ data: T; version: number; updatedAt: Date | null }> {
  const row = await prisma.tenantSetting.findUnique({
    where: { tenantId_namespace: { tenantId, namespace } },
    select: { data: true, version: true, updatedAt: true },
  });
  if (!row) {
    return { data: fallback, version: 1, updatedAt: null };
  }
  return {
    data: (row.data as T) ?? fallback,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

async function writeTenantSetting<T>(
  tenantId: number,
  namespace: string,
  data: T,
  userId: string | null
): Promise<{ data: T; version: number; updatedAt: Date }> {
  const row = await prisma.tenantSetting.upsert({
    where: { tenantId_namespace: { tenantId, namespace } },
    update: { data: data as any, version: { increment: 1 }, updatedBy: userId ?? undefined },
    create: { tenantId, namespace, data: data as any, version: 1, updatedBy: userId ?? undefined },
    select: { data: true, version: true, updatedAt: true },
  });
  return { data: row.data as T, version: row.version, updatedAt: row.updatedAt };
}

async function deleteTenantSetting(
  tenantId: number,
  namespace: string
): Promise<boolean> {
  try {
    await prisma.tenantSetting.delete({
      where: { tenantId_namespace: { tenantId, namespace } },
    });
    return true;
  } catch {
    return false; // Didn't exist
  }
}

// ───────────────────────── Routes ─────────────────────────

const dashboardConfigRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
) => {
  /**
   * GET /api/v1/dashboard/config
   * Get current dashboard configuration and custom presets.
   * Returns null for config if user hasn't customized - frontend applies default preset.
   */
  app.get("/dashboard/config", async (req, reply) => {
    try {
      const tenantId = await getTenantFromRequest(req);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Get user's current config (null if not set)
      const { data: storedConfig, updatedAt } =
        await readTenantSetting<DashboardLayoutConfig | null>(
          tenantId,
          DASHBOARD_CONFIG_NS,
          null
        );

      // Get user's custom presets only (system presets come from frontend)
      const { data: customPresets } = await readTenantSetting<DashboardPreset[]>(
        tenantId,
        DASHBOARD_PRESETS_NS,
        []
      );

      return reply.send({
        config: storedConfig, // null if no saved config - frontend applies default
        customPresets,
        updatedAt: updatedAt?.toISOString() ?? null,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get dashboard config");
      return reply.code(500).send({ error: "get_config_failed" });
    }
  });

  /**
   * PUT /api/v1/dashboard/config
   * Update dashboard configuration
   */
  app.put<{ Body: { config: DashboardLayoutConfig } }>(
    "/dashboard/config",
    async (req, reply) => {
      try {
        const tenantId = await getTenantFromRequest(req);
        if (!tenantId) {
          return reply.code(400).send({ error: "missing_tenant" });
        }

        const userId = getActorId(req);
        const { config } = req.body || {};

        if (!config || typeof config !== "object") {
          return reply.code(400).send({ error: "invalid_config" });
        }

        // Validate required fields
        if (!config.presetId || !config.widgets || !config.layouts) {
          return reply.code(400).send({ error: "missing_required_fields" });
        }

        // Save config
        const { data: savedConfig, updatedAt } = await writeTenantSetting(
          tenantId,
          DASHBOARD_CONFIG_NS,
          config,
          userId
        );

        return reply.send({
          config: savedConfig,
          updatedAt: updatedAt.toISOString(),
        });
      } catch (err) {
        req.log?.error?.({ err }, "Failed to update dashboard config");
        return reply.code(500).send({ error: "update_config_failed" });
      }
    }
  );

  /**
   * DELETE /api/v1/dashboard/config
   * Reset dashboard to default (delete saved config)
   */
  app.delete("/dashboard/config", async (req, reply) => {
    try {
      const tenantId = await getTenantFromRequest(req);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      await deleteTenantSetting(tenantId, DASHBOARD_CONFIG_NS);

      return reply.send({ ok: true });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to reset dashboard config");
      return reply.code(500).send({ error: "reset_config_failed" });
    }
  });

  /**
   * GET /api/v1/dashboard/presets
   * Get user's custom presets only (system presets come from frontend)
   */
  app.get("/dashboard/presets", async (req, reply) => {
    try {
      const tenantId = await getTenantFromRequest(req);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const { data: customPresets } = await readTenantSetting<DashboardPreset[]>(
        tenantId,
        DASHBOARD_PRESETS_NS,
        []
      );

      return reply.send({ presets: customPresets });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get dashboard presets");
      return reply.code(500).send({ error: "get_presets_failed" });
    }
  });

  /**
   * POST /api/v1/dashboard/presets
   * Create a new custom preset
   */
  app.post<{
    Body: {
      name: string;
      description?: string;
      config: DashboardLayoutConfig;
      setAsDefault?: boolean;
    };
  }>("/dashboard/presets", async (req, reply) => {
    try {
      const tenantId = await getTenantFromRequest(req);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const userId = getActorId(req);
      const { name, description, config, setAsDefault } = req.body || {};

      if (!name || !config) {
        return reply.code(400).send({ error: "missing_required_fields" });
      }

      // Generate preset ID
      const presetId = generatePresetId();
      const now = new Date().toISOString();

      // Create preset object
      const newPreset: DashboardPreset = {
        id: presetId,
        name,
        description: description || "",
        species: config.species,
        isSystem: false,
        isDefault: setAsDefault || false,
        config: {
          ...config,
          presetId,
          presetName: name,
        },
        createdAt: now,
        updatedAt: now,
        createdBy: userId || undefined,
      };

      // Get existing presets
      const { data: existingPresets } = await readTenantSetting<DashboardPreset[]>(
        tenantId,
        DASHBOARD_PRESETS_NS,
        []
      );

      // If setting as default, unset other defaults
      let updatedPresets = existingPresets;
      if (setAsDefault) {
        updatedPresets = existingPresets.map((p) => ({
          ...p,
          isDefault: false,
        }));
      }

      // Add new preset
      updatedPresets = [...updatedPresets, newPreset];

      // Save presets
      await writeTenantSetting(tenantId, DASHBOARD_PRESETS_NS, updatedPresets, userId);

      // If setting as default, also update current config
      if (setAsDefault) {
        await writeTenantSetting(tenantId, DASHBOARD_CONFIG_NS, newPreset.config, userId);
      }

      return reply.code(201).send({ preset: newPreset });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to create dashboard preset");
      return reply.code(500).send({ error: "create_preset_failed" });
    }
  });

  /**
   * DELETE /api/v1/dashboard/presets/:id
   * Delete a custom preset
   */
  app.delete<{ Params: { id: string } }>(
    "/dashboard/presets/:id",
    async (req, reply) => {
      try {
        const tenantId = await getTenantFromRequest(req);
        if (!tenantId) {
          return reply.code(400).send({ error: "missing_tenant" });
        }

        const userId = getActorId(req);
        const { id } = req.params;

        // Get existing presets
        const { data: existingPresets } = await readTenantSetting<DashboardPreset[]>(
          tenantId,
          DASHBOARD_PRESETS_NS,
          []
        );

        // Find and remove preset
        const presetIndex = existingPresets.findIndex((p) => p.id === id);
        if (presetIndex === -1) {
          return reply.code(404).send({ error: "preset_not_found" });
        }

        const updatedPresets = existingPresets.filter((p) => p.id !== id);

        // Save presets
        await writeTenantSetting(tenantId, DASHBOARD_PRESETS_NS, updatedPresets, userId);

        return reply.send({ ok: true });
      } catch (err) {
        req.log?.error?.({ err }, "Failed to delete dashboard preset");
        return reply.code(500).send({ error: "delete_preset_failed" });
      }
    }
  );
};

export default dashboardConfigRoutes;
