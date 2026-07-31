import type { Approval, Build, WorldState } from "@foundry/contracts";
import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "../mock-runtime/worldStateReducer";
import { computeLighthouseState } from "./lighthouseState";

function withHealth(status: WorldState["health"]["status"]): WorldState {
  return { ...createInitialWorldState(), health: { status, reasons: ["nominal"] } };
}

function pendingApproval(): Approval {
  return {
    id: "approval-1",
    buildId: "build-1",
    stageId: "stage-1",
    status: "pending",
    riskClass: "R1",
    title: "Deploy to production",
    reason: "QA passed",
    recommendedAction: "approve",
    evidenceIds: [],
    requestedAt: "2026-07-30T00:00:00.000Z",
  };
}

function runningBuild(): Build {
  return {
    id: "build-1",
    projectId: "project-1",
    sequenceNumber: 1,
    status: "running",
    objectiveSnapshot: "Build a basic app",
    currentStageId: "stage-1",
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
  };
}

describe("computeLighthouseState — deterministic mapping from real WorldState only", () => {
  it("defaults to healthy: no build, no approvals, healthy system", () => {
    expect(computeLighthouseState(createInitialWorldState())).toBe("healthy");
  });

  it("maps a running build (no pending approval, healthy system) to active", () => {
    const state = { ...createInitialWorldState(), currentBuild: runningBuild() };
    expect(computeLighthouseState(state)).toBe("active");
  });

  it("maps a pending approval to attention_required, even while a build is running", () => {
    const state: WorldState = {
      ...createInitialWorldState(),
      currentBuild: runningBuild(),
      approvals: [pendingApproval()],
    };
    expect(computeLighthouseState(state)).toBe("attention_required");
  });

  it("maps system health degraded/critical/disconnected directly", () => {
    expect(computeLighthouseState(withHealth("degraded"))).toBe("degraded");
    expect(computeLighthouseState(withHealth("critical"))).toBe("critical");
    expect(computeLighthouseState(withHealth("disconnected"))).toBe("disconnected");
  });

  it("a genuine health problem always outranks a pending approval or a running build", () => {
    const state: WorldState = {
      ...withHealth("critical"),
      currentBuild: runningBuild(),
      approvals: [pendingApproval()],
    };
    expect(computeLighthouseState(state)).toBe("critical");
  });

  it("disconnected outranks critical/degraded (most severe wins)", () => {
    const state: WorldState = { ...withHealth("disconnected") };
    expect(computeLighthouseState(state)).toBe("disconnected");
  });

  it("a resolved (non-pending) approval does not trigger attention_required", () => {
    const state: WorldState = {
      ...createInitialWorldState(),
      currentBuild: runningBuild(),
      approvals: [
        {
          ...pendingApproval(),
          status: "approved",
          resolvedAt: "2026-07-30T00:01:00.000Z",
          resolvedBy: "operator-1",
        },
      ],
    };
    expect(computeLighthouseState(state)).toBe("active");
  });
});
