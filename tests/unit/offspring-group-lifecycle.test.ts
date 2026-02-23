/**
 * Unit Tests for Offspring Group Lifecycle Service
 *
 * Tests the date calculation logic and transition validation
 * without requiring a running server or database.
 *
 * Run: npx tsx --test tests/unit/offspring-group-lifecycle.test.ts
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  calculateGroupExpectedDates,
  getSpeciesPostBirthIntervals,
} from "../../src/services/offspring-group-lifecycle-service.js";

// ─── calculateGroupExpectedDates ────────────────────────────────────────────

test("calculateGroupExpectedDates", async (t) => {
  await t.test("DOG: calculates correct weaning/placement dates from birth", () => {
    const birthDate = new Date("2026-03-01T12:00:00Z");
    const result = calculateGroupExpectedDates(birthDate, "DOG");

    // DOG: wean at 56 days, placement start at 63 days, placement complete at 84 days
    assertDaysDiff(birthDate, result.expectedWeanedAt, 56);
    assertDaysDiff(birthDate, result.expectedPlacementStartAt, 63);
    assertDaysDiff(birthDate, result.expectedPlacementCompletedAt, 84);
  });

  await t.test("CAT: calculates correct weaning/placement dates from birth", () => {
    const birthDate = new Date("2026-06-15T12:00:00Z");
    const result = calculateGroupExpectedDates(birthDate, "CAT");

    assertDaysDiff(birthDate, result.expectedWeanedAt, 56);
    assertDaysDiff(birthDate, result.expectedPlacementStartAt, 63);
    assertDaysDiff(birthDate, result.expectedPlacementCompletedAt, 84);
  });

  await t.test("HORSE: calculates correct weaning/placement dates from birth", () => {
    const birthDate = new Date("2026-04-10T12:00:00Z");
    const result = calculateGroupExpectedDates(birthDate, "HORSE");

    assertDaysDiff(birthDate, result.expectedWeanedAt, 180);
    assertDaysDiff(birthDate, result.expectedPlacementStartAt, 210);
    assertDaysDiff(birthDate, result.expectedPlacementCompletedAt, 365);
  });

  await t.test("RABBIT: calculates correct weaning/placement dates from birth", () => {
    const birthDate = new Date("2026-02-01T12:00:00Z");
    const result = calculateGroupExpectedDates(birthDate, "RABBIT");

    assertDaysDiff(birthDate, result.expectedWeanedAt, 42);
    assertDaysDiff(birthDate, result.expectedPlacementStartAt, 49);
    assertDaysDiff(birthDate, result.expectedPlacementCompletedAt, 70);
  });

  await t.test("GOAT: calculates correct weaning/placement dates from birth", () => {
    const birthDate = new Date("2026-01-15T12:00:00Z");
    const result = calculateGroupExpectedDates(birthDate, "GOAT");

    assertDaysDiff(birthDate, result.expectedWeanedAt, 60);
    assertDaysDiff(birthDate, result.expectedPlacementStartAt, 84);
    assertDaysDiff(birthDate, result.expectedPlacementCompletedAt, 112);
  });

  await t.test("SHEEP: calculates correct weaning/placement dates from birth", () => {
    const birthDate = new Date("2026-03-20T12:00:00Z");
    const result = calculateGroupExpectedDates(birthDate, "SHEEP");

    assertDaysDiff(birthDate, result.expectedWeanedAt, 60);
    assertDaysDiff(birthDate, result.expectedPlacementStartAt, 84);
    assertDaysDiff(birthDate, result.expectedPlacementCompletedAt, 112);
  });

  await t.test("ALPACA: calculates correct weaning/placement dates from birth", () => {
    const birthDate = new Date("2026-05-01T12:00:00Z");
    const result = calculateGroupExpectedDates(birthDate, "ALPACA");

    assertDaysDiff(birthDate, result.expectedWeanedAt, 180);
    assertDaysDiff(birthDate, result.expectedPlacementStartAt, 210);
    assertDaysDiff(birthDate, result.expectedPlacementCompletedAt, 365);
  });

  await t.test("LLAMA: calculates correct weaning/placement dates from birth", () => {
    const birthDate = new Date("2026-07-10T12:00:00Z");
    const result = calculateGroupExpectedDates(birthDate, "LLAMA");

    assertDaysDiff(birthDate, result.expectedWeanedAt, 180);
    assertDaysDiff(birthDate, result.expectedPlacementStartAt, 210);
    assertDaysDiff(birthDate, result.expectedPlacementCompletedAt, 365);
  });

  await t.test("unknown species falls back to DOG intervals", () => {
    const birthDate = new Date("2026-03-01T12:00:00Z");
    const result = calculateGroupExpectedDates(birthDate, "UNKNOWN_SPECIES");

    // Should use DOG defaults
    assertDaysDiff(birthDate, result.expectedWeanedAt, 56);
    assertDaysDiff(birthDate, result.expectedPlacementStartAt, 63);
    assertDaysDiff(birthDate, result.expectedPlacementCompletedAt, 84);
  });

  await t.test("species name is case-insensitive", () => {
    const birthDate = new Date("2026-03-01T12:00:00Z");
    const lower = calculateGroupExpectedDates(birthDate, "dog");
    const upper = calculateGroupExpectedDates(birthDate, "DOG");
    const mixed = calculateGroupExpectedDates(birthDate, "Dog");

    assert.deepStrictEqual(lower, upper);
    assert.deepStrictEqual(lower, mixed);
  });

  await t.test("returns Date objects for all fields", () => {
    const birthDate = new Date("2026-03-01T12:00:00Z");
    const result = calculateGroupExpectedDates(birthDate, "DOG");

    assert.ok(result.expectedWeanedAt instanceof Date);
    assert.ok(result.expectedPlacementStartAt instanceof Date);
    assert.ok(result.expectedPlacementCompletedAt instanceof Date);
  });

  await t.test("dates are in chronological order: wean < placement start < placement complete", () => {
    for (const species of ["DOG", "CAT", "HORSE", "RABBIT", "GOAT", "SHEEP", "ALPACA", "LLAMA"]) {
      const birthDate = new Date("2026-03-01T12:00:00Z");
      const result = calculateGroupExpectedDates(birthDate, species);

      assert.ok(
        result.expectedWeanedAt < result.expectedPlacementStartAt,
        `${species}: weanedAt should be before placementStartAt`,
      );
      assert.ok(
        result.expectedPlacementStartAt < result.expectedPlacementCompletedAt,
        `${species}: placementStartAt should be before placementCompletedAt`,
      );
    }
  });
});

// ─── getSpeciesPostBirthIntervals ───────────────────────────────────────────

test("getSpeciesPostBirthIntervals", async (t) => {
  await t.test("returns correct intervals for supported species", () => {
    const dogIntervals = getSpeciesPostBirthIntervals("DOG");
    assert.strictEqual(dogIntervals.weanDays, 56);
    assert.strictEqual(dogIntervals.placementStartDays, 63);
    assert.strictEqual(dogIntervals.placementCompletedDays, 84);
  });

  await t.test("returns DOG intervals for unknown species", () => {
    const unknownIntervals = getSpeciesPostBirthIntervals("PARROT");
    assert.strictEqual(unknownIntervals.weanDays, 56);
  });

  await t.test("all supported species have valid intervals", () => {
    const supported = ["DOG", "CAT", "HORSE", "RABBIT", "GOAT", "SHEEP", "ALPACA", "LLAMA"];
    for (const species of supported) {
      const intervals = getSpeciesPostBirthIntervals(species);
      assert.ok(intervals.weanDays > 0, `${species}: weanDays should be > 0`);
      assert.ok(intervals.placementStartDays > intervals.weanDays, `${species}: placementStart > wean`);
      assert.ok(intervals.placementCompletedDays > intervals.placementStartDays, `${species}: placementComplete > placementStart`);
    }
  });
});

// ─── Helper ─────────────────────────────────────────────────────────────────

function assertDaysDiff(from: Date, to: Date, expectedDays: number) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const actualDays = Math.round((to.getTime() - from.getTime()) / msPerDay);
  assert.strictEqual(
    actualDays,
    expectedDays,
    `Expected ${expectedDays} days difference but got ${actualDays}`,
  );
}
