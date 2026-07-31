import type { StageSummary } from "@/lib/mock-runtime/selectors";
import type { Approval, Build, Transfer, WorldState } from "@foundry/contracts";
import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "../mock-runtime/worldStateReducer";
import { computeCargoState } from "./cargoState";

function runningBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: "build-1",
    projectId: "project-1",
    sequenceNumber: 1,
    status: "running",
    objectiveSnapshot: "Build a basic app",
    currentStageId: "stage-1",
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

function transfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: "t1",
    buildId: "build-1",
    stageId: "stage-1",
    leg: "construction_office_to_warehouse",
    status: "created",
    sourceBuildingId: "",
    destinationBuildingId: "",
    artifactIds: [],
    vehicleId: "vehicle-utility-1",
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

function approval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: "a1",
    buildId: "build-1",
    stageId: "stage-1",
    status: "pending",
    riskClass: "R1",
    title: "Approve deployment",
    reason: "QA passed",
    recommendedAction: "approve",
    evidenceIds: [],
    requestedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeCargoState — V-04: cargo stays incomplete/blocked while the mandatory failure is active", () => {
  it("defaults to open_incomplete with a running build and no transfer", () => {
    const state: WorldState = { ...createInitialWorldState(), currentBuild: runningBuild() };
    expect(computeCargoState(state, [])).toBe("open_incomplete");
  });

  it("stays blocked for the entire window the build is blocked (the intentional requirement failure)", () => {
    const state: WorldState = {
      ...createInitialWorldState(),
      currentBuild: runningBuild({ status: "blocked" }),
    };
    expect(computeCargoState(state, [])).toBe("blocked");
  });

  it("becomes sealed_ready only once a real Transfer reports status ready", () => {
    const state: WorldState = {
      ...createInitialWorldState(),
      currentBuild: runningBuild(),
      activeTransfers: [transfer({ status: "ready" })],
    };
    expect(computeCargoState(state, [])).toBe("sealed_ready");
  });

  it("never becomes sealed_ready merely because a build is running with a created (not-yet-ready) transfer", () => {
    const state: WorldState = {
      ...createInitialWorldState(),
      currentBuild: runningBuild(),
      activeTransfers: [transfer({ status: "created" })],
    };
    expect(computeCargoState(state, [])).toBe("open_incomplete");
  });

  it("maps loading/in_transit/unloading transfer statuses to in_transit", () => {
    for (const status of ["loading", "in_transit", "unloading"] as const) {
      const state: WorldState = {
        ...createInitialWorldState(),
        currentBuild: runningBuild(),
        activeTransfers: [transfer({ status })],
      };
      expect(computeCargoState(state, [])).toBe("in_transit");
    }
  });

  it("shows received once the build completes", () => {
    const state: WorldState = {
      ...createInitialWorldState(),
      currentBuild: runningBuild({ status: "completed" }),
    };
    expect(computeCargoState(state, [])).toBe("received");
  });

  it("shows rejected when the approval is rejected, outranking everything else", () => {
    const state: WorldState = {
      ...createInitialWorldState(),
      currentBuild: runningBuild({ status: "completed" }),
      approvals: [approval({ status: "rejected" })],
    };
    expect(computeCargoState(state, [])).toBe("rejected");
  });

  it("shows validating while a stage is in the validating status", () => {
    const state: WorldState = { ...createInitialWorldState(), currentBuild: runningBuild() };
    const stages: StageSummary[] = [
      { id: "s1", name: "qa_validation", status: "validating" },
    ];
    expect(computeCargoState(state, stages)).toBe("validating");
  });

  it("a blocked build outranks a transfer that happens to already be ready", () => {
    const state: WorldState = {
      ...createInitialWorldState(),
      currentBuild: runningBuild({ status: "blocked" }),
      activeTransfers: [transfer({ status: "ready" })],
    };
    expect(computeCargoState(state, [])).toBe("blocked");
  });
});
