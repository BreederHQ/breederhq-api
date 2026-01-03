// src/services/placement-scheduling.ts
// Phase 6: Placement order gating for scheduling fairness

export interface PlacementSchedulingPolicy {
  enabled: boolean;
  windowMinutesPerBuyer: number;
  startAt: string;
  gapMinutesBetweenRanks?: number;
  allowOverlap?: boolean;
  graceMinutesAfterWindow?: number;
  timezone: string;
  eventTypeScope?: string[];
}

export interface PlacementWindow {
  windowStartAt: Date;
  windowEndAt: Date;
  graceEndAt: Date;
  timezone: string;
}

export interface PlacementGatingResult {
  allowed: boolean;
  code: PlacementBlockedCode | null;
  window: PlacementWindow | null;
  serverNow: Date;
}

export type PlacementBlockedCode =
  | "PLACEMENT_WINDOW_NOT_OPEN"
  | "PLACEMENT_WINDOW_CLOSED"
  | "NO_PLACEMENT_RANK";

export interface PlacementBlockedContext {
  offspringGroupId: number;
  eventId?: string;
  placementWindowStartAt?: string;
  placementWindowEndAt?: string;
  serverNow: string;
}

export function computePlacementWindow(
  policy: PlacementSchedulingPolicy,
  placementRank: number
): PlacementWindow | null {
  if (!policy.enabled) return null;
  if (placementRank < 1) return null;

  const startAt = new Date(policy.startAt);
  if (isNaN(startAt.getTime())) return null;

  const windowDurationMs = policy.windowMinutesPerBuyer * 60 * 1000;
  const gapMs = policy.allowOverlap ? 0 : (policy.gapMinutesBetweenRanks ?? 0) * 60 * 1000;
  const graceMs = (policy.graceMinutesAfterWindow ?? 0) * 60 * 1000;

  const rankOffset = (placementRank - 1) * (windowDurationMs + gapMs);
  const windowStartAt = new Date(startAt.getTime() + rankOffset);
  const windowEndAt = new Date(windowStartAt.getTime() + windowDurationMs);
  const graceEndAt = new Date(windowEndAt.getTime() + graceMs);

  return { windowStartAt, windowEndAt, graceEndAt, timezone: policy.timezone };
}

export function checkPlacementGating(
  policy: PlacementSchedulingPolicy | null,
  placementRank: number | null,
  now: Date = new Date()
): PlacementGatingResult {
  const serverNow = now;

  if (!policy || !policy.enabled) {
    return { allowed: true, code: null, window: null, serverNow };
  }

  if (placementRank == null || placementRank < 1) {
    return { allowed: false, code: "NO_PLACEMENT_RANK", window: null, serverNow };
  }

  const window = computePlacementWindow(policy, placementRank);
  if (!window) {
    return { allowed: true, code: null, window: null, serverNow };
  }

  if (serverNow < window.windowStartAt) {
    return { allowed: false, code: "PLACEMENT_WINDOW_NOT_OPEN", window, serverNow };
  }

  if (serverNow > window.graceEndAt) {
    return { allowed: false, code: "PLACEMENT_WINDOW_CLOSED", window, serverNow };
  }

  return { allowed: true, code: null, window, serverNow };
}

export function parsePlacementSchedulingPolicy(data: unknown): PlacementSchedulingPolicy | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  if (typeof obj.enabled !== "boolean") return null;
  if (!obj.enabled) return { enabled: false } as PlacementSchedulingPolicy;

  if (typeof obj.windowMinutesPerBuyer !== "number" || obj.windowMinutesPerBuyer <= 0) return null;
  if (typeof obj.startAt !== "string") return null;
  if (typeof obj.timezone !== "string" || obj.timezone.length === 0) return null;

  const startAtDate = new Date(obj.startAt);
  if (isNaN(startAtDate.getTime())) return null;

  const policy: PlacementSchedulingPolicy = {
    enabled: true,
    windowMinutesPerBuyer: obj.windowMinutesPerBuyer,
    startAt: obj.startAt,
    timezone: obj.timezone,
  };

  if (typeof obj.gapMinutesBetweenRanks === "number" && obj.gapMinutesBetweenRanks >= 0) {
    policy.gapMinutesBetweenRanks = obj.gapMinutesBetweenRanks;
  }
  if (typeof obj.allowOverlap === "boolean") {
    policy.allowOverlap = obj.allowOverlap;
  }
  if (typeof obj.graceMinutesAfterWindow === "number" && obj.graceMinutesAfterWindow >= 0) {
    policy.graceMinutesAfterWindow = obj.graceMinutesAfterWindow;
  }
  if (Array.isArray(obj.eventTypeScope)) {
    const scopes = obj.eventTypeScope.filter((s): s is string => typeof s === "string");
    if (scopes.length > 0) policy.eventTypeScope = scopes;
  }

  return policy;
}

export function validatePlacementSchedulingPolicy(policy: PlacementSchedulingPolicy): string[] {
  const errors: string[] = [];

  if (policy.enabled) {
    if (!policy.timezone || policy.timezone.length === 0) {
      errors.push("Timezone is required when placement scheduling is enabled");
    }
    if (!policy.startAt) {
      errors.push("Start time is required when placement scheduling is enabled");
    } else {
      const startAtDate = new Date(policy.startAt);
      if (isNaN(startAtDate.getTime())) errors.push("Start time must be a valid date");
    }
    if (policy.windowMinutesPerBuyer <= 0) {
      errors.push("Window duration must be greater than 0");
    }
    if (policy.windowMinutesPerBuyer > 10080) {
      errors.push("Window duration cannot exceed 7 days (10080 minutes)");
    }
    if (policy.gapMinutesBetweenRanks != null && policy.gapMinutesBetweenRanks < 0) {
      errors.push("Gap between ranks cannot be negative");
    }
    if (policy.graceMinutesAfterWindow != null && policy.graceMinutesAfterWindow < 0) {
      errors.push("Grace period cannot be negative");
    }
    if (policy.graceMinutesAfterWindow != null && policy.graceMinutesAfterWindow > 1440) {
      errors.push("Grace period cannot exceed 24 hours (1440 minutes)");
    }
  }

  return errors;
}

export function buildPlacementBlockedContext(
  offspringGroupId: number,
  window: PlacementWindow | null,
  serverNow: Date,
  eventId?: string
): PlacementBlockedContext {
  const ctx: PlacementBlockedContext = {
    offspringGroupId,
    serverNow: serverNow.toISOString(),
  };
  if (eventId) ctx.eventId = eventId;
  if (window) {
    ctx.placementWindowStartAt = window.windowStartAt.toISOString();
    ctx.placementWindowEndAt = window.windowEndAt.toISOString();
  }
  return ctx;
}

export function getPlacementBlockedMessage(code: PlacementBlockedCode): string {
  switch (code) {
    case "PLACEMENT_WINDOW_NOT_OPEN": return "Your scheduling window has not opened yet.";
    case "PLACEMENT_WINDOW_CLOSED": return "Your scheduling window has closed.";
    case "NO_PLACEMENT_RANK": return "You do not have a placement rank for this group.";
  }
}
