import type { Transfer } from "@foundry/contracts";
import { WORLD_BUILDINGS, WORLD_VEHICLE } from "@foundry/world-model";
import { describe, expect, it } from "vitest";
import { computeVehiclePosition } from "./vehiclePosition";

const BUILDING_OFFSET_X = 2.2;
const homeBuilding = WORLD_BUILDINGS.find((b) => b.id === WORLD_VEHICLE.homeBuildingId)!.position;
// Beside its home building, never exactly on top of it — the same offset
// FBL-019 established, kept as the single source of truth in
// computeVehiclePosition rather than a component-level constant.
const HOME = { x: homeBuilding.x + BUILDING_OFFSET_X, y: homeBuilding.y, z: homeBuilding.z };
const OFFICE = WORLD_BUILDINGS.find((b) => b.id === "construction-office")!.position;
const WAREHOUSE_BUILDING = WORLD_BUILDINGS.find((b) => b.id === "warehouse")!.position;
const WAREHOUSE = {
  x: WAREHOUSE_BUILDING.x + BUILDING_OFFSET_X,
  y: WAREHOUSE_BUILDING.y,
  z: WAREHOUSE_BUILDING.z,
};

function transfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: "t1",
    buildId: "b1",
    stageId: "s1",
    leg: "construction_office_to_warehouse",
    status: "created",
    sourceBuildingId: "",
    destinationBuildingId: "",
    artifactIds: [],
    vehicleId: WORLD_VEHICLE.id,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeVehiclePosition — V-05: motion only after transfer.started", () => {
  it("stays at home with no active transfer", () => {
    expect(computeVehiclePosition(undefined)).toEqual(HOME);
  });

  it("stays at home while created/blocked/ready/loading — before transfer.started has populated real endpoints", () => {
    for (const status of ["created", "blocked", "ready", "loading"] as const) {
      expect(computeVehiclePosition(transfer({ status }))).toEqual(HOME);
    }
  });

  it("moves to the midpoint between source and destination only once status is in_transit", () => {
    const t = transfer({
      status: "in_transit",
      sourceBuildingId: "construction-office",
      destinationBuildingId: "warehouse",
    });
    const position = computeVehiclePosition(t);
    // The midpoint uses the two buildings' own (un-offset) positions —
    // only the single-building "beside it" anchor points (home/destination)
    // get the offset, since a midpoint is already clear of both buildings.
    expect(position).toEqual({
      x: (OFFICE.x + WAREHOUSE_BUILDING.x) / 2,
      y: (OFFICE.y + WAREHOUSE_BUILDING.y) / 2,
      z: (OFFICE.z + WAREHOUSE_BUILDING.z) / 2,
    });
  });

  it("moves to the destination once status is unloading (transfer.arrived) — not before", () => {
    const t = transfer({
      status: "unloading",
      sourceBuildingId: "construction-office",
      destinationBuildingId: "warehouse",
    });
    expect(computeVehiclePosition(t)).toEqual(WAREHOUSE);
  });

  it("falls back to home for an in_transit transfer with unresolvable endpoints, rather than fabricating a position", () => {
    const t = transfer({
      status: "in_transit",
      sourceBuildingId: "does-not-exist",
      destinationBuildingId: "also-does-not-exist",
    });
    expect(computeVehiclePosition(t)).toEqual(HOME);
  });
});
