/**
 * Minimal node:test coverage for offspring state normalization.
 * No existing backend test harness was found; this file exercises the reducer directly
 * to lock in invariants without touching Prisma.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  OffspringFinancialState,
  OffspringKeeperIntent,
  OffspringLifeState,
  OffspringPaperworkState,
  OffspringPlacementState,
  OffspringStatus,
  Species,
  type Offspring,
} from "@prisma/client";
import { normalizeOffspringState } from "../offspring.js";

const BASE_DATE = new Date("2020-01-01T00:00:00.000Z");

function baseOffspring(overrides: Partial<Offspring> = {}): Offspring {
  return {
    id: 1,
    tenantId: 1,
    groupId: 1,
    name: null,
    species: Species.DOG,
    breed: null,
    sex: null,
    bornAt: null,
    diedAt: null,
    status: OffspringStatus.NEWBORN,
    lifeState: OffspringLifeState.ALIVE,
    placementState: OffspringPlacementState.UNASSIGNED,
    keeperIntent: OffspringKeeperIntent.AVAILABLE,
    financialState: OffspringFinancialState.NONE,
    paperworkState: OffspringPaperworkState.NONE,
    damId: null,
    sireId: null,
    collarColorId: null,
    collarColorName: null,
    collarColorHex: null,
    collarAssignedAt: null,
    collarLocked: false,
    buyerPartyType: null,
    buyerContactId: null,
    buyerOrganizationId: null,
    priceCents: null,
    depositCents: null,
    contractId: null,
    contractSignedAt: null,
    paidInFullAt: null,
    pickupAt: null,
    placedAt: null,
    promotedAnimalId: null,
    notes: null,
    data: null,
    Tags: [],
    Attachments: [],
    Events: [],
    WaitlistAllocations: [],
    Invoices: [],
    Tasks: [],
    HealthLogs: [],
    Documents: [],
    Contracts: [],
    InvoiceLinks: [],
    CampaignAttribution: [],
    OffspringDocument: [],
    OffspringContract: [],
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides,
  };
}

function applyPatch(current: Offspring | null, patch: Partial<Offspring>): Offspring {
  const normalized = normalizeOffspringState(current, patch);
  const base = current ?? baseOffspring();
  return {
    ...base,
    ...patch,
    ...normalized,
    updatedAt: BASE_DATE,
  };
}

test("reserve then place", () => {
  const reserved = applyPatch(null, { buyerContactId: 123 });
  assert.equal(reserved.placementState, OffspringPlacementState.RESERVED);
  assert.equal(reserved.placedAt, null);
  assert.equal(reserved.lifeState, OffspringLifeState.ALIVE);

  const placedAt = new Date("2020-02-01T00:00:00.000Z");
  const placed = applyPatch(reserved, { placedAt });
  assert.equal(placed.placementState, OffspringPlacementState.PLACED);
  assert.equal(placed.lifeState, OffspringLifeState.ALIVE);
  assert.ok(placed.placedAt instanceof Date);
  assert.equal((placed.placedAt as Date).getTime(), placedAt.getTime());
});

test("placed then returned preserves placement timestamp", () => {
  const placedAt = new Date("2020-02-01T00:00:00.000Z");
  const placed = applyPatch(null, { placedAt });
  assert.equal(placed.placementState, OffspringPlacementState.PLACED);

  const returned = applyPatch(placed, { placementState: OffspringPlacementState.RETURNED });
  assert.equal(returned.placementState, OffspringPlacementState.RETURNED);
  assert.ok(returned.placedAt);
  assert.equal((returned.placedAt as Date).getTime(), placedAt.getTime());
  assert.equal(returned.lifeState, OffspringLifeState.ALIVE);
});

test("alive to deceased auto-sets diedAt", () => {
  const deceased = applyPatch(null, { lifeState: OffspringLifeState.DECEASED });
  assert.equal(deceased.lifeState, OffspringLifeState.DECEASED);
  assert.ok(deceased.diedAt);
});

test("promotion forces keeper intent KEEP", () => {
  const promoted = applyPatch(null, { promotedAnimalId: 999 });
  assert.equal(promoted.keeperIntent, OffspringKeeperIntent.KEEP);
  assert.equal(promoted.lifeState, OffspringLifeState.ALIVE);
  assert.equal(promoted.placementState, OffspringPlacementState.UNASSIGNED);
});

test("financial progression deposit pending to paid-in-full", () => {
  const reserved = applyPatch(null, { buyerContactId: 5, depositCents: 10000 });
  assert.equal(reserved.financialState, OffspringFinancialState.DEPOSIT_PENDING);

  const paidAt = new Date("2020-03-01T00:00:00.000Z");
  const paidInFull = applyPatch(reserved, { paidInFullAt: paidAt });
  assert.equal(paidInFull.financialState, OffspringFinancialState.PAID_IN_FULL);
  assert.ok(paidInFull.paidInFullAt);
});

test("paperwork progression sent then signed", () => {
  const sent = applyPatch(null, { contractId: "ctr_1" });
  assert.equal(sent.paperworkState, OffspringPaperworkState.SENT);

  const signedAt = new Date("2020-04-01T00:00:00.000Z");
  const signed = applyPatch(sent, { contractSignedAt: signedAt });
  assert.equal(signed.paperworkState, OffspringPaperworkState.SIGNED);
  assert.ok(signed.contractSignedAt);
});

test("cannot place deceased offspring", () => {
  const deceased = applyPatch(null, { lifeState: OffspringLifeState.DECEASED });
  assert.throws(() => normalizeOffspringState(deceased, { placedAt: new Date() }));
  assert.equal(deceased.placementState, OffspringPlacementState.UNASSIGNED);
  assert.equal(deceased.placedAt, null);
});

test("placementState=PLACED requires placedAt", () => {
  assert.throws(() =>
    normalizeOffspringState(baseOffspring(), { placementState: OffspringPlacementState.PLACED }),
  );
});

test("cannot clear placedAt while still PLACED", () => {
  const placedAt = new Date("2020-02-01T00:00:00.000Z");
  const placed = applyPatch(null, { placedAt });
  assert.equal(placed.placementState, OffspringPlacementState.PLACED);
  assert.throws(() => normalizeOffspringState(placed, { placedAt: null }));
});
