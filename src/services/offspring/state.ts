import {
  Offspring,
  OffspringKeeperIntent,
  OffspringLifeState,
  OffspringPlacementState,
  OffspringStatus,
} from "@prisma/client";

export const OFFSPRING_DUAL_WRITE_LEGACY_STATUS =
  (process.env.OFFSPRING_DUAL_WRITE_LEGACY_STATUS ?? "true").toLowerCase() !== "false";

export function deriveLegacyStatus(
  state: Pick<Offspring, "lifeState" | "placementState" | "keeperIntent">,
): OffspringStatus {
  if (state.lifeState === OffspringLifeState.DECEASED) return OffspringStatus.DECEASED;
  if (state.placementState === OffspringPlacementState.PLACED) return OffspringStatus.PLACED;
  return OffspringStatus.ALIVE;
}

export function legacyStatusToCanonicalPatch(status: OffspringStatus): Partial<Offspring> {
  switch (status) {
    case OffspringStatus.DECEASED:
      return { lifeState: OffspringLifeState.DECEASED };
    case OffspringStatus.PLACED:
      return { placementState: OffspringPlacementState.PLACED };
    case OffspringStatus.ALIVE:
      return { lifeState: OffspringLifeState.ALIVE };
    case OffspringStatus.NEWBORN:
      return {
        lifeState: OffspringLifeState.ALIVE,
        placementState: OffspringPlacementState.UNASSIGNED,
      };
    default:
      return {};
  }
}
