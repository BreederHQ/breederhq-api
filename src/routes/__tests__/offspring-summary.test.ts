import assert from "node:assert/strict";
import test from "node:test";
import {
  OffspringKeeperIntent,
  OffspringLifeState,
  OffspringPlacementState,
} from "@prisma/client";
import { summarizeOffspringStates } from "../offspring.js";

test("offspring summary uses canonical state dimensions", () => {
  const groupId = 1;
  const samples = [
    {
      id: 1,
      groupId,
      lifeState: OffspringLifeState.ALIVE,
      placementState: OffspringPlacementState.UNASSIGNED,
      keeperIntent: OffspringKeeperIntent.AVAILABLE,
    },
    {
      id: 2,
      groupId,
      lifeState: OffspringLifeState.ALIVE,
      placementState: OffspringPlacementState.RESERVED,
      keeperIntent: OffspringKeeperIntent.AVAILABLE,
    },
    {
      id: 3,
      groupId,
      lifeState: OffspringLifeState.ALIVE,
      placementState: OffspringPlacementState.PLACED,
      keeperIntent: OffspringKeeperIntent.AVAILABLE,
    },
    {
      id: 4,
      groupId,
      lifeState: OffspringLifeState.DECEASED,
      placementState: OffspringPlacementState.UNASSIGNED,
      keeperIntent: OffspringKeeperIntent.AVAILABLE,
    },
  ];

  const summary = summarizeOffspringStates(samples);
  assert.deepEqual(summary.counts, {
    alive: 3,
    deceased: 1,
    unassigned: 2,
    optionHold: 0,
    reserved: 1,
    placed: 1,
    returned: 0,
    transferred: 0,
  });
  assert.equal(summary.availableToPlaceCount, 1);
  assert.equal(summary.placementRate, 1 / 4);
});
