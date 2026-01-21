#!/usr/bin/env node
// scripts/verify-placement-gating.mjs
// Phase 6: Verification script for placement order gating

import {
  computePlacementWindow,
  checkPlacementGating,
  parsePlacementSchedulingPolicy,
  validatePlacementSchedulingPolicy,
  getPlacementBlockedMessage,
} from "../dist/services/placement-scheduling.js";

console.log("=== Phase 6: Placement Order Gating Verification ===\n");

// Test 1: Policy parsing
console.log("1. Testing policy parsing...");
const validPolicy = {
  enabled: true,
  windowMinutesPerBuyer: 60,
  startAt: new Date().toISOString(),
  timezone: "America/Chicago",
  gapMinutesBetweenRanks: 5,
  graceMinutesAfterWindow: 30,
};

const parsed = parsePlacementSchedulingPolicy(validPolicy);
console.log("   Valid policy parsed:", parsed?.enabled === true ? "PASS" : "FAIL");

const invalidPolicy = { enabled: true }; // missing required fields
const invalidParsed = parsePlacementSchedulingPolicy(invalidPolicy);
console.log("   Invalid policy rejected:", invalidParsed === null ? "PASS" : "FAIL");

// Test 2: Policy validation
console.log("\n2. Testing policy validation...");
const errors = validatePlacementSchedulingPolicy(validPolicy);
console.log("   Valid policy has no errors:", errors.length === 0 ? "PASS" : "FAIL");

const badPolicy = {
  enabled: true,
  windowMinutesPerBuyer: -10,
  startAt: "invalid-date",
  timezone: "",
  graceMinutesAfterWindow: 2000,
};
const badErrors = validatePlacementSchedulingPolicy(badPolicy);
console.log("   Invalid policy has errors:", badErrors.length > 0 ? "PASS" : "FAIL");
if (badErrors.length > 0) {
  console.log("   Errors:", badErrors);
}

// Test 3: Window computation
console.log("\n3. Testing window computation...");
const testPolicy = {
  enabled: true,
  windowMinutesPerBuyer: 60, // 1 hour per buyer
  startAt: new Date("2026-01-15T10:00:00Z").toISOString(),
  timezone: "America/Chicago",
  gapMinutesBetweenRanks: 10,
  graceMinutesAfterWindow: 15,
};

const rank1Window = computePlacementWindow(testPolicy, 1);
const rank2Window = computePlacementWindow(testPolicy, 2);
const rank3Window = computePlacementWindow(testPolicy, 3);

console.log("   Rank 1 window starts at policy start:",
  rank1Window?.windowStartAt.toISOString() === testPolicy.startAt ? "PASS" : "FAIL");

console.log("   Rank 2 window starts after rank 1:",
  rank2Window && rank1Window && rank2Window.windowStartAt > rank1Window.windowEndAt ? "PASS" : "FAIL");

console.log("   Windows:", {
  rank1: rank1Window ? {
    start: rank1Window.windowStartAt.toISOString(),
    end: rank1Window.windowEndAt.toISOString(),
    grace: rank1Window.graceEndAt.toISOString(),
  } : null,
  rank2: rank2Window ? {
    start: rank2Window.windowStartAt.toISOString(),
    end: rank2Window.windowEndAt.toISOString(),
    grace: rank2Window.graceEndAt.toISOString(),
  } : null,
  rank3: rank3Window ? {
    start: rank3Window.windowStartAt.toISOString(),
    end: rank3Window.windowEndAt.toISOString(),
    grace: rank3Window.graceEndAt.toISOString(),
  } : null,
});

// Test 4: Gating checks
console.log("\n4. Testing gating checks...");

// Before window opens
const beforeWindow = new Date("2026-01-15T09:00:00Z");
const gatingBefore = checkPlacementGating(testPolicy, 1, beforeWindow);
console.log("   Before window opens:",
  !gatingBefore.allowed && gatingBefore.code === "PLACEMENT_WINDOW_NOT_OPEN" ? "PASS" : "FAIL");

// During window
const duringWindow = new Date("2026-01-15T10:30:00Z");
const gatingDuring = checkPlacementGating(testPolicy, 1, duringWindow);
console.log("   During window:",
  gatingDuring.allowed && gatingDuring.code === null ? "PASS" : "FAIL");

// During grace period
const duringGrace = new Date("2026-01-15T11:10:00Z"); // Window ends at 11:00, grace until 11:15
const gatingGrace = checkPlacementGating(testPolicy, 1, duringGrace);
console.log("   During grace period:",
  gatingGrace.allowed && gatingGrace.code === null ? "PASS" : "FAIL");

// After grace period
const afterGrace = new Date("2026-01-15T11:20:00Z");
const gatingAfter = checkPlacementGating(testPolicy, 1, afterGrace);
console.log("   After grace period:",
  !gatingAfter.allowed && gatingAfter.code === "PLACEMENT_WINDOW_CLOSED" ? "PASS" : "FAIL");

// No placement rank
const gatingNoRank = checkPlacementGating(testPolicy, null, duringWindow);
console.log("   No placement rank:",
  !gatingNoRank.allowed && gatingNoRank.code === "NO_PLACEMENT_RANK" ? "PASS" : "FAIL");

// Policy disabled
const disabledPolicy = { enabled: false };
const gatingDisabled = checkPlacementGating(disabledPolicy, 1, duringWindow);
console.log("   Policy disabled:",
  gatingDisabled.allowed ? "PASS" : "FAIL");

// Test 5: Blocked messages
console.log("\n5. Testing blocked messages...");
console.log("   PLACEMENT_WINDOW_NOT_OPEN:", getPlacementBlockedMessage("PLACEMENT_WINDOW_NOT_OPEN"));
console.log("   PLACEMENT_WINDOW_CLOSED:", getPlacementBlockedMessage("PLACEMENT_WINDOW_CLOSED"));
console.log("   NO_PLACEMENT_RANK:", getPlacementBlockedMessage("NO_PLACEMENT_RANK"));

console.log("\n=== Verification Complete ===");
