import { describe, expect, it } from "vitest";
import { EVENT_TYPES } from "@foundry/event-types";
import { WORLD_AGENTS, WORLD_VEHICLE } from "@foundry/world-model";
import { describeEvent } from "@/components/timeline/describeEvent";
import { computeAgentPosition } from "@/lib/world/agentPosition";
import { computeCargoState } from "@/lib/world/cargoState";
import { computeVehiclePosition } from "@/lib/world/vehiclePosition";
import { computeVehicleState } from "@/lib/world/vehicleState";
import { computeActiveRoadSegmentId } from "@/lib/world/roadNetwork";
import { buildCanonicalScript } from "./script";
import { selectStages } from "./selectors";
import { reduceWorldState } from "./worldStateReducer";

// FBL-021 — end-to-end integration tests running the real canonical
// script through the real reducer/selectors/projections, complementing
// the isolated unit tests already written per pure function. These prove
// the Required behaviors hold against the actual deterministic mock run,
// not only against hand-built fixtures.

describe("FBL-021 — V-04: Cargo remains incomplete/blocked while the intentional requirement failure is active", () => {
  it("Cargo is blocked for the entire window between stage.blocked and that stage's own stage.completed, and not blocked before or after", () => {
    const script = buildCanonicalScript("cargo-blocking");
    const blockedIndex = script.findIndex((e) => e.type === "stage.blocked");
    const frontendCompletedIndex = script.findIndex(
      (e) => e.type === "stage.completed" && e.entityId.includes("stage-frontend"),
    );
    expect(blockedIndex).toBeGreaterThan(0);
    expect(frontendCompletedIndex).toBeGreaterThan(blockedIndex);

    // Before the failure: not blocked.
    const beforeState = reduceWorldState(script.slice(0, blockedIndex));
    const beforeStages = selectStages(script.slice(0, blockedIndex));
    expect(computeCargoState(beforeState, beforeStages)).not.toBe("blocked");

    // During the failure (right after stage.blocked, before the retry resolves it).
    const duringState = reduceWorldState(script.slice(0, blockedIndex + 1));
    const duringStages = selectStages(script.slice(0, blockedIndex + 1));
    expect(computeCargoState(duringState, duringStages)).toBe("blocked");

    // Still blocked one event before the stage's own completion (retry in progress).
    const stillDuringState = reduceWorldState(script.slice(0, frontendCompletedIndex));
    const stillDuringStages = selectStages(script.slice(0, frontendCompletedIndex));
    expect(computeCargoState(stillDuringState, stillDuringStages)).toBe("blocked");

    // Recovered the instant the stage completes.
    const afterState = reduceWorldState(script.slice(0, frontendCompletedIndex + 1));
    const afterStages = selectStages(script.slice(0, frontendCompletedIndex + 1));
    expect(computeCargoState(afterState, afterStages)).not.toBe("blocked");
  });

  it("Cargo becomes sealed_ready only once a real transfer.ready event has fired, never earlier", () => {
    const script = buildCanonicalScript("cargo-sealed-timing");
    const firstTransferReadyIndex = script.findIndex((e) => e.type === "transfer.ready");
    expect(firstTransferReadyIndex).toBeGreaterThan(0);

    const beforeState = reduceWorldState(script.slice(0, firstTransferReadyIndex));
    const beforeStages = selectStages(script.slice(0, firstTransferReadyIndex));
    expect(computeCargoState(beforeState, beforeStages)).not.toBe("sealed_ready");

    const afterState = reduceWorldState(script.slice(0, firstTransferReadyIndex + 1));
    const afterStages = selectStages(script.slice(0, firstTransferReadyIndex + 1));
    expect(computeCargoState(afterState, afterStages)).toBe("sealed_ready");
  });
});

describe("FBL-021 — V-05: vehicle does not move before transfer.started, and moves only after it", () => {
  it("the vehicle stays at home through every event up to and including the first transfer.ready", () => {
    const script = buildCanonicalScript("vehicle-no-early-motion");
    const firstTransferReadyIndex = script.findIndex((e) => e.type === "transfer.ready");
    const state = reduceWorldState(script.slice(0, firstTransferReadyIndex + 1));
    const activeTransfer = state.activeTransfers.find((t) => t.vehicleId === WORLD_VEHICLE.id);
    const position = computeVehiclePosition(activeTransfer);
    const homePosition = computeVehiclePosition(undefined);
    expect(position).toEqual(homePosition);
    expect(computeVehicleState(state)).not.toBe("in_transit");
  });

  it("the vehicle moves away from home the instant (and only after) the first transfer.started fires", () => {
    const script = buildCanonicalScript("vehicle-motion-after-start");
    const firstTransferStartedIndex = script.findIndex((e) => e.type === "transfer.started");
    expect(firstTransferStartedIndex).toBeGreaterThan(0);

    const beforeState = reduceWorldState(script.slice(0, firstTransferStartedIndex));
    const beforeTransfer = beforeState.activeTransfers.find(
      (t) => t.vehicleId === WORLD_VEHICLE.id,
    );
    expect(computeVehiclePosition(beforeTransfer)).toEqual(computeVehiclePosition(undefined));

    const afterState = reduceWorldState(script.slice(0, firstTransferStartedIndex + 1));
    const afterTransfer = afterState.activeTransfers.find((t) => t.vehicleId === WORLD_VEHICLE.id);
    expect(computeVehicleState(afterState)).toBe("in_transit");
    expect(computeVehiclePosition(afterTransfer)).not.toEqual(computeVehiclePosition(undefined));
  });

  it("across all three transfer legs, the vehicle is never in_transit or at a moved position without a real transfer.started already having fired", () => {
    const script = buildCanonicalScript("vehicle-all-legs");
    let sawAnyMotion = false;
    for (let i = 0; i < script.length; i++) {
      const upTo = script.slice(0, i + 1);
      const state = reduceWorldState(upTo);
      const transfer = state.activeTransfers.find((t) => t.vehicleId === WORLD_VEHICLE.id);
      const vehicleState = computeVehicleState(state);
      if (vehicleState === "in_transit") {
        sawAnyMotion = true;
        // A real transfer.started must already have occurred by this point.
        const startedSoFar = upTo.filter((e) => e.type === "transfer.started").length;
        expect(startedSoFar).toBeGreaterThan(0);
        const position = computeVehiclePosition(transfer);
        expect(position).not.toEqual(computeVehiclePosition(undefined));
      }
    }
    expect(sawAnyMotion).toBe(true); // sanity: the run does exercise in_transit at least once
  });

  it("the road highlights a segment only while the vehicle itself is in_transit or unloading — never while merely waiting or parked", () => {
    const script = buildCanonicalScript("vehicle-road-sync");
    let sawHighlight = false;
    for (let i = 0; i < script.length; i++) {
      const state = reduceWorldState(script.slice(0, i + 1));
      const transfer = state.activeTransfers.find((t) => t.vehicleId === WORLD_VEHICLE.id);
      const highlighted = computeActiveRoadSegmentId(transfer);
      const vehicleState = computeVehicleState(state);
      if (highlighted) {
        sawHighlight = true;
        expect(["in_transit", "unloading"]).toContain(vehicleState);
      }
    }
    expect(sawHighlight).toBe(true); // sanity: the run does exercise highlighting at least once
  });
});

describe("FBL-021 — animation completion cannot complete a transfer", () => {
  it("computing vehicle position/state repeatedly, with no new events, never advances the transfer toward completion", () => {
    const script = buildCanonicalScript("no-fake-completion");
    const inTransitIndex = script.findIndex((e) => e.type === "transfer.started");
    const state = reduceWorldState(script.slice(0, inTransitIndex + 1));
    const transferBefore = state.activeTransfers.find((t) => t.vehicleId === WORLD_VEHICLE.id);

    // Simulate many animation frames' worth of pure re-computation with no
    // new event delivered — position/state must be identical every time,
    // since only a real transfer.arrived/transfer.completed event (never a
    // render-loop callback) can change status.
    for (let frame = 0; frame < 100; frame++) {
      const position = computeVehiclePosition(transferBefore);
      const vehicleState = computeVehicleState(state);
      expect(position).toEqual(computeVehiclePosition(transferBefore));
      expect(vehicleState).toBe("in_transit");
    }
    // The transfer itself is untouched by all that re-computation.
    const stillState = reduceWorldState(script.slice(0, inTransitIndex + 1));
    expect(stillState.activeTransfers).toEqual(state.activeTransfers);
  });
});

describe("FBL-021 — agent single-location invariant throughout the mock run", () => {
  it("every agent resolves to exactly one building position at every point in the canonical run — never two", () => {
    const script = buildCanonicalScript("agent-single-location");
    for (let i = 0; i < script.length; i++) {
      const state = reduceWorldState(script.slice(0, i + 1));
      for (const [index, def] of WORLD_AGENTS.entries()) {
        const agent = state.agents.find((a) => a.id === def.id)!;
        // Exactly one currentBuildingId per agent, always — the type
        // system already guarantees this (Agent.currentBuildingId is a
        // single string, not an array), but this proves the resolved
        // world position is always a single, defined point too.
        const position = computeAgentPosition(agent.currentBuildingId, index);
        expect(position).not.toBeNull();
      }
    }
  });

  it("no two agents ever resolve to the identical (x, z) footprint at the same building, even when co-located", () => {
    const script = buildCanonicalScript("agent-no-overlap");
    const state = reduceWorldState(script);
    const positions = WORLD_AGENTS.map((def, index) =>
      computeAgentPosition(state.agents.find((a) => a.id === def.id)!.currentBuildingId, index),
    );
    const keys = positions.map((p) => `${p!.x},${p!.z}`);
    // All three happen to be home (idle) at the end of the canonical run —
    // still each must have its own distinct footprint via the per-index offset.
    expect(new Set(keys).size).toBe(3);
  });
});

// Minimal realistic payload per event type — just enough for every
// `describeEvent` branch to read the fields it actually accesses, so this
// test exercises every case in that switch, not only the ~40 types the
// canonical happy-path script itself emits.
const MINIMAL_PAYLOAD: Record<string, Record<string, unknown>> = {
  "system.started": { neighborhoodId: "n1", serviceVersion: "1.0.0" },
  "system.health_changed": { previousHealth: "healthy", newHealth: "degraded" },
  "operator.objective_submitted": { objective: "Build a thing" },
  "operator.command_submitted": { commandType: "demo.pause" },
  "operator.command_accepted": { commandType: "demo.pause" },
  "operator.command_rejected": { commandType: "demo.bogus", reason: "not a valid command" },
  "agent.registered": { role: "architect" },
  "agent.assigned": { taskId: "task-1" },
  "agent.departed": { destinationBuildingId: "construction-office" },
  "agent.arrived": { destinationBuildingId: "construction-office" },
  "agent.started_work": { runtimeType: "mock" },
  "agent.failed": { message: "runtime error" },
  "agentrun.started": { runtimeType: "mock", riskClass: "R1" },
  "agentrun.completed": { exitCode: 0 },
  "agentrun.failed": { failureMessage: "exit 1" },
  "build.created": { objective: "Build a thing" },
  "build.planned": { stageIds: ["s1", "s2"] },
  "build.failed": { failureCode: "E_FAIL" },
  "stage.blocked": { reason: "Mandatory requirement failed" },
  "revision.requested": { reason: "Needs more evidence" },
  "requirement.failed": { message: "Delete task error state missing" },
  "artifact.created": { name: "Build plan", artifactType: "plan" },
  "transfer.blocked": { reason: "Artifact not ready" },
  "transfer.started": {
    sourceBuildingId: "construction-office",
    destinationBuildingId: "warehouse",
  },
  "transfer.failed": { reason: "Vehicle unavailable" },
  "approval.requested": { title: "Approve deployment package" },
  "approval.approved": { resolvedBy: "operator-1" },
  "approval.rejected": { resolvedBy: "operator-1" },
  "approval.revision_requested": { resolvedBy: "operator-1" },
  "operator.plan_reviewed": {
    planId: "plan-1",
    buildId: "build-1",
    planRevision: "rev-1",
    decision: "proceed",
    reviewedBy: "operator-1",
  },
  "building.selected": { buildingId: "lighthouse" },
  "building.state_changed": { priorState: "idle", newState: "active" },
  "upgrade.completed": { fromLevel: 1, toLevel: 2 },
};

describe("FBL-021 — timeline/detail textual equivalents (Required behavior 11, Principle 24)", () => {
  it("describeEvent produces a non-empty string for every authoritative V1 event type, without throwing", () => {
    for (const type of EVENT_TYPES) {
      const [entityTypeGuess] = type.split(".");
      const fakeEvent = {
        id: "evt-1",
        type,
        occurredAt: "2026-07-30T00:00:00.000Z",
        actorType: "backend",
        actorId: "backend",
        entityType: entityTypeGuess,
        entityId: "entity-1",
        correlationId: "corr-1",
        severity: "info",
        schemaVersion: 1,
        payload: MINIMAL_PAYLOAD[type] ?? {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      const description = describeEvent(fakeEvent);
      expect(description.length, `describeEvent(${type})`).toBeGreaterThan(0);
    }
  });

  it("describeEvent falls back to a readable (not blank) row for a genuinely unknown future event type", () => {
    const fakeEvent = {
      id: "evt-1",
      type: "future.not_yet_specified",
      occurredAt: "2026-07-30T00:00:00.000Z",
      actorType: "backend",
      actorId: "backend",
      entityType: "Future",
      entityId: "entity-1",
      correlationId: "corr-1",
      severity: "info",
      schemaVersion: 1,
      payload: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const description = describeEvent(fakeEvent);
    expect(description).toContain("future.not_yet_specified");
    expect(description).toContain("Future");
  });
});
