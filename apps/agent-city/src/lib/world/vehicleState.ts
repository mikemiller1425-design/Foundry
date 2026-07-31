import type { VehicleStatus, WorldState } from "@foundry/contracts";
import { WORLD_VEHICLE } from "@foundry/world-model";

// docs/02-specification/domain-model.md → "Vehicle" — "Emitted events: None
// independently — visual/domain state derives entirely from the
// `transfer.*` events of its assigned Transfer." WorldState carries no
// standalone Vehicle record (see worldState.ts — only `activeTransfers`),
// so the vehicle's own status is read from whichever active Transfer
// currently names it, exactly mirroring that Transfer's own
// backend-authoritative status — never a local animation or timer. With no
// active transfer, the vehicle defaults to `parked` (world-model.md
// "Utility vehicle" default state). This is the same "one pure function
// over real WorldState only" discipline lighthouseState.ts /
// residenceState.ts established.
//
// `in_transit` can only ever be returned here when a real Transfer already
// carries that exact status — which the mock runtime only ever sets from a
// real `transfer.started` event (worldStateReducer.ts) — so this function
// can never itself imply motion the backend hasn't authorized (V-05 / this
// rung's own "Explicitly prohibited work").
export function computeVehicleState(worldState: WorldState): VehicleStatus {
  const transfer = worldState.activeTransfers.find((t) => t.vehicleId === WORLD_VEHICLE.id);
  if (!transfer) return "parked";
  switch (transfer.status) {
    case "created":
    case "blocked":
    case "ready":
      return "waiting";
    case "loading":
      return "loading";
    case "in_transit":
      return "in_transit";
    case "unloading":
      return "unloading";
    default:
      return "parked";
  }
}
