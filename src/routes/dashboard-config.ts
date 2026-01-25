// src/routes/dashboard-config.ts
// Dashboard configuration and presets API
//
// GET  /api/v1/dashboard/config           - Get current config
// PUT  /api/v1/dashboard/config           - Update config
// GET  /api/v1/dashboard/presets          - List all presets
// POST /api/v1/dashboard/presets          - Create custom preset
// DELETE /api/v1/dashboard/presets/:id    - Delete custom preset
// POST /api/v1/dashboard/presets/:id/apply - Apply preset

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

// ───────────────────────── System Presets ─────────────────────────

const STANDARD_WIDGETS: WidgetPlacement[] = [
  { widgetId: "alert-banner", size: "full", order: 0 },
  { widgetId: "greeting-banner", size: "full", order: 1 },
  { widgetId: "breeding-pipeline-tile", size: "small", order: 2 },
  { widgetId: "offspring-tile", size: "small", order: 3 },
  { widgetId: "waitlist-tile", size: "small", order: 4 },
  { widgetId: "finances-tile", size: "small", order: 5 },
  { widgetId: "todays-agenda", size: "large", order: 6 },
  { widgetId: "quick-actions", size: "medium", order: 7 },
  { widgetId: "contact-followups", size: "large", order: 8 },
  { widgetId: "breeding-pipeline", size: "full", order: 9 },
  { widgetId: "offspring-groups", size: "medium", order: 10 },
  { widgetId: "waitlist-gauge", size: "medium", order: 11 },
  { widgetId: "financial-snapshot", size: "medium", order: 12 },
  { widgetId: "kpi-panel", size: "large", order: 13 },
  { widgetId: "activity-feed", size: "large", order: 14 },
];

const STANDARD_PRESET: DashboardPreset = {
  id: "standard",
  name: "BreederHQ - Standard",
  description: "Default dashboard layout optimized for all species.",
  isSystem: true,
  isDefault: true,
  config: {
    version: 1,
    presetId: "standard",
    presetName: "BreederHQ - Standard",
    widgets: STANDARD_WIDGETS,
    layouts: {
      desktop: STANDARD_WIDGETS,
      tablet: STANDARD_WIDGETS,
      mobile: STANDARD_WIDGETS.map((w) => ({ ...w, size: "full" as const })),
    },
    preferences: {
      compactMode: false,
      showEmptyWidgets: false,
      refreshInterval: 0,
    },
  },
};

const HORSE_BREEDER_WIDGETS: WidgetPlacement[] = [
  { widgetId: "alert-banner", size: "full", order: 0 },
  { widgetId: "greeting-banner", size: "full", order: 1 },
  { widgetId: "breeding-pipeline-tile", size: "small", order: 2 },
  { widgetId: "offspring-tile", size: "small", order: 3 },
  { widgetId: "waitlist-tile", size: "small", order: 4 },
  { widgetId: "finances-tile", size: "small", order: 5 },
  { widgetId: "mare-status-grid", size: "full", order: 6 },
  { widgetId: "pre-foaling-alerts", size: "medium", order: 7 },
  { widgetId: "foaling-dashboard", size: "medium", order: 8 },
  { widgetId: "todays-agenda", size: "medium", order: 9 },
  { widgetId: "quick-actions", size: "small", order: 10 },
  { widgetId: "mare-performance", size: "medium", order: 11 },
  { widgetId: "ovulation-tracker", size: "medium", order: 12 },
  { widgetId: "breeding-pipeline", size: "large", order: 13 },
  { widgetId: "stallion-calendar", size: "medium", order: 14 },
  { widgetId: "contact-followups", size: "medium", order: 15 },
  { widgetId: "financial-snapshot", size: "medium", order: 16 },
  { widgetId: "foaling-analytics", size: "medium", order: 17 },
  { widgetId: "genetic-intelligence", size: "large", order: 18 },
  { widgetId: "activity-feed", size: "large", order: 19 },
];

const HORSE_BREEDER_PRESET: DashboardPreset = {
  id: "horse-breeder",
  name: "BreederHQ - Horse Breeder",
  description:
    "Optimized for equine breeding operations with mare tracking and foaling alerts.",
  species: ["HORSE"],
  isSystem: true,
  isDefault: false,
  config: {
    version: 1,
    presetId: "horse-breeder",
    presetName: "BreederHQ - Horse Breeder",
    species: ["HORSE"],
    widgets: HORSE_BREEDER_WIDGETS,
    layouts: {
      desktop: HORSE_BREEDER_WIDGETS,
      tablet: HORSE_BREEDER_WIDGETS,
      mobile: HORSE_BREEDER_WIDGETS.map((w) => ({
        ...w,
        size: "full" as const,
      })),
    },
    preferences: {
      compactMode: false,
      showEmptyWidgets: false,
      refreshInterval: 0,
    },
  },
};

const SYSTEM_PRESETS: DashboardPreset[] = [STANDARD_PRESET, HORSE_BREEDER_PRESET];

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

// ───────────────────────── Routes ─────────────────────────

const dashboardConfigRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
) => {
  /**
   * GET /api/v1/dashboard/config
   * Get current dashboard configuration and available presets
   */
  app.get("/dashboard/config", async (req, reply) => {
    try {
      const tenantId = await getTenantFromRequest(req);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Get user's current config (or default)
      const { data: storedConfig, updatedAt } =
        await readTenantSetting<DashboardLayoutConfig | null>(
          tenantId,
          DASHBOARD_CONFIG_NS,
          null
        );

      // Get user's custom presets
      const { data: customPresets } = await readTenantSetting<DashboardPreset[]>(
        tenantId,
        DASHBOARD_PRESETS_NS,
        []
      );

      // Determine which config to use
      let config: DashboardLayoutConfig;
      if (storedConfig) {
        config = storedConfig;
      } else {
        // Check if tenant has horses to recommend horse preset
        const hasHorses = await prisma.animal.findFirst({
          where: { tenantId, species: "HORSE", archived: false },
          select: { id: true },
        });
        config = hasHorses
          ? HORSE_BREEDER_PRESET.config
          : STANDARD_PRESET.config;
      }

      // Combine system presets with user's custom presets
      const allPresets: DashboardPreset[] = [...SYSTEM_PRESETS, ...customPresets];

      return reply.send({
        config,
        presets: allPresets,
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
   * GET /api/v1/dashboard/presets
   * Get all available presets (system + custom)
   */
  app.get("/dashboard/presets", async (req, reply) => {
    try {
      const tenantId = await getTenantFromRequest(req);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Get user's custom presets
      const { data: customPresets } = await readTenantSetting<DashboardPreset[]>(
        tenantId,
        DASHBOARD_PRESETS_NS,
        []
      );

      const allPresets: DashboardPreset[] = [...SYSTEM_PRESETS, ...customPresets];

      return reply.send({ presets: allPresets });
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

        // Can't delete system presets
        if (SYSTEM_PRESETS.some((p) => p.id === id)) {
          return reply.code(403).send({ error: "cannot_delete_system_preset" });
        }

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

  /**
   * POST /api/v1/dashboard/presets/:id/apply
   * Apply a preset to current configuration
   */
  app.post<{ Params: { id: string } }>(
    "/dashboard/presets/:id/apply",
    async (req, reply) => {
      try {
        const tenantId = await getTenantFromRequest(req);
        if (!tenantId) {
          return reply.code(400).send({ error: "missing_tenant" });
        }

        const userId = getActorId(req);
        const { id } = req.params;

        // Find preset (system or custom)
        let preset: DashboardPreset | undefined = SYSTEM_PRESETS.find(
          (p) => p.id === id
        );

        if (!preset) {
          const { data: customPresets } = await readTenantSetting<DashboardPreset[]>(
            tenantId,
            DASHBOARD_PRESETS_NS,
            []
          );
          preset = customPresets.find((p) => p.id === id);
        }

        if (!preset) {
          return reply.code(404).send({ error: "preset_not_found" });
        }

        // Apply preset config
        const { data: savedConfig, updatedAt } = await writeTenantSetting(
          tenantId,
          DASHBOARD_CONFIG_NS,
          preset.config,
          userId
        );

        return reply.send({
          config: savedConfig,
          updatedAt: updatedAt.toISOString(),
        });
      } catch (err) {
        req.log?.error?.({ err }, "Failed to apply dashboard preset");
        return reply.code(500).send({ error: "apply_preset_failed" });
      }
    }
  );
};

export default dashboardConfigRoutes;
