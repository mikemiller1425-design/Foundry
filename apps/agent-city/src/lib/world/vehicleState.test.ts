import type { Transfer, WorldState } from "@foundry/contracts";
import { WORLD_VEHICLE } from "@foundry/world-model";
import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "../mock-runtime/worldStateReducer";
import { computeVehicleState } from "./vehicleState";

function transfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: "transfer-1",
    buildId: "build-1",
    stageId: "stage-1",
    leg: "construction_office_to_warehouse",
    status: "created",
    sourceBuildingId: "construction-office",
    destinationBuildingId: "warehouse",
    artifactIds: [],
    vehicleId: WORLD_VEHICLE.id,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

function withTransfer(t: Transfer | null): WorldState {
  return {
    ...createInitialWorldState(),
    activeTransfers: t ? [t] : [],
  };
}

describe("computeVehicleState — deterministic mapping from the assigned Transfer only", () => {
  it("defaults to parked when no active transfer exists", () => {
    expect(computeVehicleState(createInitialWorldState())).toBe("parked");
    expect(computeVehicleState(withTransfer(null))).toBe("parked");
  });

  it("maps created/blocked/ready transfer statuses to waiting (not yet moving)", () => {
    expect(computeVehicleState(withTransfer(transfer({ status: "created" })))).toBe("waiting");
    expect(computeVehicleState(withTransfer(transfer({ status: "blocked" })))).toBe("waiting");
    expect(computeVehicleState(withTransfer(transfer({ status: "ready" })))).toBe("waiting");
  });

  it("maps loading directly", () => {
    expect(computeVehicleState(withTransfer(transfer({ status: "loading" })))).toBe("loading");
  });

  it("maps in_transit only when the real Transfer record itself is in_transit", () => {
    expect(computeVehicleState(withTransfer(transfer({ status: "in_transit" })))).toBe("in_transit");
  });

  it("maps unloading directly", () => {
    expect(computeVehicleState(withTransfer(transfer({ status: "unloading" })))).toBe("unloading");
  });

  it("ignores a transfer assigned to a different vehicle (never possible in V1, but must not cross-report)", () => {
    const state = withTransfer(transfer({ status: "in_transit", vehicleId: "some-other-vehicle" }));
    expect(computeVehicleState(state)).toBe("parked");
  });

  it("never reports in_transit or loading absent a real matching Transfer — no motion can be implied without one", () => {
    const state = createInitialWorldState();
    expect(state.activeTransfers).toHaveLength(0);
    expect(computeVehicleState(state)).toBe("parked");
  });
});
