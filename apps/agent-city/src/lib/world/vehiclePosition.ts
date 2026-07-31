import type { Position, Transfer } from "@foundry/contracts";
import { WORLD_BUILDINGS, WORLD_VEHICLE } from "@foundry/world-model";

// docs/02-specification/world-model.md → "Utility vehicle" → "Motion only
// after transfer.started"; domain-model.md → Vehicle lifecycle: parked →
// waiting → loading → in_transit → unloading → completed (returns to
// parked). Position has exactly three discrete, event-derived states —
// never a timer-interpolated position, so "vehicle moved" can only ever
// be true because a real Transfer record says so:
//
// - home (parked/waiting/loading, or no active transfer at all): the
//   Transfer's `sourceBuildingId`/`destinationBuildingId` are empty until
//   `transfer.started` populates them (worldStateReducer.ts), so there is
//   no real pickup location to render before that event — the vehicle's
//   own home building is the only truthful default before departure.
// - midpoint (status `in_transit`): between the transfer's real
//   `sourceBuildingId` and `destinationBuildingId`, both populated only by
//   `transfer.started`'s payload.
// - destination (status `unloading`): `transfer.arrived` (worldStateReducer.ts
//   FBL-021 addition) moves status to `unloading` — visually arrived, not
//   yet complete until `transfer.completed`, which removes the transfer
//   from `activeTransfers` entirely and the vehicle "returns to parked."
//
// A fixed offset (never a timer-driven one) is applied to any single-
// building anchor point (home or destination) so the vehicle renders
// beside that building rather than exactly overlapping its own geometry
// — the same offset FBL-019 used for the vehicle's original parked
// position, preserved here so it never sits inside/behind a building's
// own hit-testable mesh.
const BUILDING_OFFSET_X = 2.2;

function besideBuilding(position: Position): Position {
  return { x: position.x + BUILDING_OFFSET_X, y: position.y, z: position.z };
}

export function computeVehiclePosition(activeTransfer: Transfer | undefined): Position {
  const home = WORLD_BUILDINGS.find((b) => b.id === WORLD_VEHICLE.homeBuildingId)!.position;
  if (!activeTransfer) return besideBuilding(home);

  if (activeTransfer.status === "in_transit") {
    const source = WORLD_BUILDINGS.find((b) => b.id === activeTransfer.sourceBuildingId)?.position;
    const destination = WORLD_BUILDINGS.find(
      (b) => b.id === activeTransfer.destinationBuildingId,
    )?.position;
    if (!source || !destination) return besideBuilding(home);
    return {
      x: (source.x + destination.x) / 2,
      y: (source.y + destination.y) / 2,
      z: (source.z + destination.z) / 2,
    };
  }

  if (activeTransfer.status === "unloading") {
    const destination = WORLD_BUILDINGS.find(
      (b) => b.id === activeTransfer.destinationBuildingId,
    )?.position;
    return besideBuilding(destination ?? home);
  }

  // created / blocked / ready / loading: not yet departed.
  return besideBuilding(home);
}
