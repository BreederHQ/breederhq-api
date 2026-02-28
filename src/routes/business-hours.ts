// src/routes/business-hours.ts
// Business hours CRUD endpoints for tenant messaging availability
//
// Auth: Requires session + tenant membership (OWNER/ADMIN for writes)
// Endpoints:
//   GET    /api/v1/business-hours      - Read business hours settings
//   PUT    /api/v1/business-hours      - Update business hours settings

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import prisma from "../prisma.js";
import { requirePermission } from "../middleware/require-permission.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Day schedule - open/close times and enabled flag
 */
interface DaySchedule {
  enabled: boolean;
  open: string;  // "HH:mm" format, e.g. "09:00"
  close: string; // "HH:mm" format, e.g. "17:00"
}

/**
 * Weekly business hours schedule
 */
interface BusinessHoursSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

/**
 * Full business hours configuration
 */
interface BusinessHoursConfig {
  schedule: BusinessHoursSchedule;
  timeZone: string;
}

/**
 * System default business hours (Mon-Fri 9am-5pm)
 */
const DEFAULT_BUSINESS_HOURS: BusinessHoursSchedule = {
  monday: { enabled: true, open: "09:00", close: "17:00" },
  tuesday: { enabled: true, open: "09:00", close: "17:00" },
  wednesday: { enabled: true, open: "09:00", close: "17:00" },
  thursday: { enabled: true, open: "09:00", close: "17:00" },
  friday: { enabled: true, open: "09:00", close: "17:00" },
  saturday: { enabled: false, open: "09:00", close: "17:00" },
  sunday: { enabled: false, open: "09:00", close: "17:00" },
};

const DEFAULT_TIMEZONE = "America/New_York";

// ============================================================================
// Helpers
// ============================================================================


/**
 * Validate time format (HH:mm)
 */
function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

/**
 * Validate a day schedule
 */
function validateDaySchedule(day: unknown, dayName: string): string[] {
  const errors: string[] = [];
  if (!day || typeof day !== "object") {
    errors.push(`${dayName}: must be an object`);
    return errors;
  }

  const d = day as Record<string, unknown>;

  if (typeof d.enabled !== "boolean") {
    errors.push(`${dayName}.enabled: must be a boolean`);
  }

  if (typeof d.open !== "string" || !isValidTimeFormat(d.open)) {
    errors.push(`${dayName}.open: must be in HH:mm format`);
  }

  if (typeof d.close !== "string" || !isValidTimeFormat(d.close)) {
    errors.push(`${dayName}.close: must be in HH:mm format`);
  }

  // Validate close is after open (if both are valid)
  if (
    typeof d.open === "string" &&
    typeof d.close === "string" &&
    isValidTimeFormat(d.open) &&
    isValidTimeFormat(d.close)
  ) {
    if (d.close <= d.open) {
      errors.push(`${dayName}: close time must be after open time`);
    }
  }

  return errors;
}

/**
 * Validate the full business hours schedule
 */
function validateBusinessHours(schedule: unknown): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!schedule || typeof schedule !== "object") {
    return { valid: false, errors: ["schedule: must be an object"] };
  }

  const s = schedule as Record<string, unknown>;
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  for (const day of days) {
    if (!(day in s)) {
      errors.push(`schedule.${day}: required`);
    } else {
      errors.push(...validateDaySchedule(s[day], `schedule.${day}`));
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Validate timezone string (basic check - must be non-empty string)
 * In production, you might want to validate against IANA timezone database
 */
function isValidTimezone(tz: unknown): boolean {
  if (typeof tz !== "string" || !tz.trim()) return false;
  // Basic format check for IANA timezone (e.g., "America/New_York")
  return /^[A-Za-z_]+\/[A-Za-z_]+$/.test(tz) || /^[A-Za-z]+$/.test(tz);
}

/**
 * Infer timezone from US zip code prefix.
 * Returns the most common timezone for that region, or null if unknown.
 */
function inferTimezoneFromZip(zip: string | null | undefined): string | null {
  if (!zip || zip.length < 3) return null;

  const prefix = parseInt(zip.substring(0, 3), 10);
  if (isNaN(prefix)) return null;

  // US zip code ranges to timezone mapping (approximate)
  // Based on first 3 digits of zip code

  // Eastern Time (ET)
  // 010-069: New England (MA, CT, RI, VT, NH, ME)
  // 070-089: New Jersey
  // 100-149: New York
  // 150-196: Pennsylvania, Delaware
  // 200-268: DC, Maryland, Virginia, West Virginia
  // 270-289: North Carolina
  // 290-299: South Carolina
  // 300-319: Northern Georgia (mostly ET)
  // 320-339: Florida (mostly ET, some CT)
  // 430-458: Ohio
  if (
    (prefix >= 10 && prefix <= 89) ||
    (prefix >= 100 && prefix <= 196) ||
    (prefix >= 200 && prefix <= 268) ||
    (prefix >= 270 && prefix <= 299) ||
    (prefix >= 300 && prefix <= 339) ||
    (prefix >= 430 && prefix <= 458)
  ) {
    return "America/New_York";
  }

  // Central Time (CT)
  // 350-369: Alabama
  // 370-385: Tennessee (mostly CT)
  // 386-397: Mississippi
  // 400-427: Kentucky (split, mostly ET but using CT here)
  // 460-479: Indiana (split, using CT)
  // 480-499: Michigan
  // 500-528: Iowa
  // 530-549: Wisconsin
  // 550-567: Minnesota
  // 570-577: South Dakota (eastern, mostly CT)
  // 580-588: North Dakota (eastern, mostly CT)
  // 590-599: Montana (far eastern, mostly MT)
  // 600-629: Illinois
  // 630-658: Missouri
  // 660-679: Kansas (eastern, mostly CT)
  // 680-693: Nebraska (eastern, mostly CT)
  // 700-714: Louisiana
  // 716-729: Arkansas
  // 730-749: Oklahoma
  // 750-799: Texas (mostly CT)
  if (
    (prefix >= 350 && prefix <= 397) ||
    (prefix >= 400 && prefix <= 499) ||
    (prefix >= 500 && prefix <= 588) ||
    (prefix >= 600 && prefix <= 693) ||
    (prefix >= 700 && prefix <= 799)
  ) {
    return "America/Chicago";
  }

  // Mountain Time (MT)
  // 590-599: Montana
  // 800-816: Colorado
  // 820-831: Wyoming
  // 832-838: Idaho (southern)
  // 840-847: Utah
  // 850-865: Arizona (note: AZ doesn't observe DST except Navajo Nation)
  // 870-884: New Mexico
  if (
    (prefix >= 590 && prefix <= 599) ||
    (prefix >= 800 && prefix <= 847) ||
    (prefix >= 850 && prefix <= 884)
  ) {
    return "America/Denver";
  }

  // Pacific Time (PT)
  // 889-898: Nevada
  // 900-961: California
  // 970-979: Oregon
  // 980-994: Washington
  if (
    (prefix >= 889 && prefix <= 898) ||
    (prefix >= 900 && prefix <= 961) ||
    (prefix >= 970 && prefix <= 994)
  ) {
    return "America/Los_Angeles";
  }

  // Alaska Time (AKT)
  // 995-999: Alaska
  if (prefix >= 995 && prefix <= 999) {
    return "America/Anchorage";
  }

  // Hawaii Time (HT)
  // 967-968: Hawaii
  if (prefix >= 967 && prefix <= 968) {
    return "Pacific/Honolulu";
  }

  return null;
}

// ============================================================================
// Routes
// ============================================================================

const businessHoursRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /business-hours - Read business hours settings
  // --------------------------------------------------------------------------
  app.get("/business-hours", { preHandler: requirePermission("contacts.view") }, async (req, reply) => {
    const tenantId = req.tenantId!;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        businessHours: true,
        timeZone: true,
        quickResponderBadge: true,
        avgBusinessHoursResponseTime: true,
        totalResponseCount: true,
        organizations: {
          select: { zip: true },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return reply.code(404).send({ error: "tenant_not_found" });
    }

    // Try to infer timezone from organization's zip code
    const orgZip = tenant.organizations[0]?.zip ?? null;
    const inferredTimeZone = inferTimezoneFromZip(orgZip);

    // Return current settings or defaults
    const schedule = (tenant.businessHours as unknown as BusinessHoursSchedule) ?? DEFAULT_BUSINESS_HOURS;
    const timeZone = tenant.timeZone ?? DEFAULT_TIMEZONE;
    const isCustom = tenant.businessHours !== null;
    const hasCustomTimeZone = tenant.timeZone !== null;

    return reply.send({
      schedule,
      timeZone,
      isCustom, // true if breeder has set custom hours, false if using system defaults
      hasCustomTimeZone, // true if breeder has explicitly set a timezone
      defaults: {
        schedule: DEFAULT_BUSINESS_HOURS,
        timeZone: DEFAULT_TIMEZONE,
      },
      // Suggested timezone based on organization's zip code
      suggestedTimeZone: inferredTimeZone,
      organizationZip: orgZip,
      // Badge status
      quickResponderBadge: tenant.quickResponderBadge,
      avgResponseTimeSeconds: tenant.avgBusinessHoursResponseTime,
      totalResponseCount: tenant.totalResponseCount,
    });
  });

  // --------------------------------------------------------------------------
  // PUT /business-hours - Update business hours settings
  // --------------------------------------------------------------------------
  app.put<{
    Body: {
      schedule?: BusinessHoursSchedule;
      timeZone?: string;
      resetToDefaults?: boolean;
    };
  }>("/business-hours", { preHandler: requirePermission("staff.*") }, async (req, reply) => {
    const tenantId = req.tenantId!;

    const { schedule, timeZone, resetToDefaults } = req.body ?? {};

    // Handle reset to defaults
    if (resetToDefaults === true) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          businessHours: Prisma.DbNull, // DbNull means use system defaults
          timeZone: null,
        },
      });

      return reply.send({
        ok: true,
        schedule: DEFAULT_BUSINESS_HOURS,
        timeZone: DEFAULT_TIMEZONE,
        isCustom: false,
      });
    }

    // Validate schedule if provided
    if (schedule !== undefined) {
      const validation = validateBusinessHours(schedule);
      if (!validation.valid) {
        return reply.code(400).send({
          error: "validation_failed",
          errors: validation.errors,
        });
      }
    }

    // Validate timezone if provided
    if (timeZone !== undefined && !isValidTimezone(timeZone)) {
      return reply.code(400).send({
        error: "validation_failed",
        errors: ["timeZone: must be a valid IANA timezone (e.g., 'America/New_York')"],
      });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (schedule !== undefined) {
      updateData.businessHours = schedule;
    }
    if (timeZone !== undefined) {
      updateData.timeZone = timeZone;
    }

    if (Object.keys(updateData).length === 0) {
      return reply.code(400).send({
        error: "no_changes",
        message: "At least one of schedule, timeZone, or resetToDefaults is required",
      });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: {
        businessHours: true,
        timeZone: true,
      },
    });

    return reply.send({
      ok: true,
      schedule: (updated.businessHours as unknown as BusinessHoursSchedule) ?? DEFAULT_BUSINESS_HOURS,
      timeZone: updated.timeZone ?? DEFAULT_TIMEZONE,
      isCustom: updated.businessHours !== null,
    });
  });
};

export default businessHoursRoutes;

// ============================================================================
// Utility exports for other modules
// ============================================================================

export { DEFAULT_BUSINESS_HOURS, DEFAULT_TIMEZONE };
export type { BusinessHoursSchedule, DaySchedule, BusinessHoursConfig };
