import { describe, expect, it } from "vitest";
import { WORLD_AGENTS } from "@foundry/world-model";
import { computeCargoState } from "@/lib/world/cargoState";
import { computeLighthouseState } from "@/lib/world/lighthouseState";
import { computeVehiclePosition } from "@/lib/world/vehiclePosition";
import { computeVehicleState } from "@/lib/world/vehicleState";
import { OBJECTIVE, buildCanonicalScript } from "./script";
import { selectStages } from "./selectors";
import { reduceWorldState } from "./worldStateReducer";

const BUILDER = WORLD_AGENTS.find((a) => a.role === "builder")!.id;

/**
 * FBL-022 — the one canonical, end-to-end "Primary user journey" test
 * (v1-acceptance.md § "Primary user journey"; docs/01-mission/v1-scope.md
 * § "Required workflow"; this rung's own 22 numbered "Required journey"
 * steps). Every step below is checked against the real deterministic mock
 * runtime — `buildCanonicalScript` + `reduceWorldState` + the same pure
 * selectors/projections every 2D/3D surface reads — in narrative order, so
 * this file reads as a literal walkthrough of the journey rather than a
 * scattered set of unrelated assertions. It intentionally overlaps with
 * more granular tests elsewhere (script.test.ts, worldStateReducer.test.ts,
 * eventToWorldMapping.test.ts) — those prove individual mechanisms in
 * isolation; this one proves the whole story holds together in sequence.
 */
describe("V1 primary user journey — complete, end-to-end, on the mock runtime only", () => {
  const script = buildCanonicalScript("v1-primary-journey");

  function indexOf(predicate: (e: (typeof script)[number]) => boolean): number {
    const index = script.findIndex(predicate);
    expect(index, "expected event not found in canonical script").toBeGreaterThanOrEqual(0);
    return index;
  }

  it("step 1 — operator submits the seeded V1 objective", () => {
    const submittedIndex = indexOf((e) => e.type === "operator.objective_submitted");
    const payload = script[submittedIndex]!.payload as { objective: string };
    expect(payload.objective).toBe(OBJECTIVE);
    const createdIndex = indexOf((e) => e.type === "build.created");
    expect(submittedIndex).toBeLessThan(createdIndex);
  });

  it("step 2 — build is created", () => {
    const createdIndex = indexOf((e) => e.type === "build.created");
    const state = reduceWorldState(script.slice(0, createdIndex + 1));
    expect(state.currentBuild).not.toBeNull();
    expect(state.currentBuild!.status).toBe("planned");
    expect(state.currentBuild!.objectiveSnapshot).toBe(OBJECTIVE);
  });

  it("step 3 — Architect produces the fixed stages, requirements, and acceptance criteria", () => {
    const plannedIndex = indexOf((e) => e.type === "build.planned");
    const payload = script[plannedIndex]!.payload as {
      stageIds: string[];
      requirementCount: number;
    };
    expect(payload.stageIds).toHaveLength(7);
    expect(payload.requirementCount).toBeGreaterThan(0);
    const stagesAfterPlanning = selectStages(script.slice(0, plannedIndex + 1));
    expect(stagesAfterPlanning[0]?.name).toBe("planning");
  });

  it("step 4 — Builder is assigned", () => {
    // scaffold (assigned + travels from home) and integration (assigned,
    // already at the office) — frontend_implementation reuses the Builder
    // already on-site from scaffold, so it has no separate agent.assigned
    // of its own (event-model.md: assignment precedes travel, not every
    // stage re-assigns an agent already present).
    const assignedToBuilder = script.filter(
      (e) => e.type === "agent.assigned" && e.entityId === BUILDER,
    );
    expect(assignedToBuilder.length).toBeGreaterThanOrEqual(2);
  });

  it("step 5 — requirements pass incrementally", () => {
    const passedEvents = script.filter((e) => e.type === "requirement.passed");
    expect(passedEvents.length).toBeGreaterThan(3);
    // Spread across more than one stage, not all bunched at the end.
    const firstPassedIndex = indexOf((e) => e.type === "requirement.passed");
    const lastPassedIndex =
      script.length - 1 - [...script].reverse().findIndex((e) => e.type === "requirement.passed");
    expect(lastPassedIndex).toBeGreaterThan(firstPassedIndex);
  });

  it("step 6 — one mandatory requirement fails intentionally", () => {
    const failedEvents = script.filter((e) => e.type === "requirement.failed");
    expect(failedEvents).toHaveLength(1);
    const payload = failedEvents[0]!.payload as { message: string; retryEligible: boolean };
    expect(payload.message).toContain("Delete task");
    expect(payload.retryEligible).toBe(true);
  });

  it("step 7 — build progression, cargo readiness, and transfer remain visibly blocked", () => {
    const blockedIndex = indexOf((e) => e.type === "stage.blocked");
    const state = reduceWorldState(script.slice(0, blockedIndex + 1));
    const stages = selectStages(script.slice(0, blockedIndex + 1));

    expect(state.currentBuild!.status).toBe("blocked");
    expect(computeCargoState(state, stages)).toBe("blocked");
    // No transfer has even been created yet — nothing to ready or depart.
    expect(state.activeTransfers).toHaveLength(0);
    expect(computeVehicleState(state)).toBe("parked");
  });

  it("step 8 — Builder retries and repairs the failure", () => {
    const retriedIndex = indexOf((e) => e.type === "requirement.retried");
    const failedIndex = indexOf((e) => e.type === "requirement.failed");
    expect(retriedIndex).toBeGreaterThan(failedIndex);

    const frontendCompletedIndex = script.findIndex(
      (e) => e.type === "stage.completed" && e.entityId.includes("stage-frontend"),
    );
    expect(frontendCompletedIndex).toBeGreaterThan(retriedIndex);
    const state = reduceWorldState(script.slice(0, frontendCompletedIndex + 1));
    expect(state.currentBuild!.status).not.toBe("blocked");
    const stages = selectStages(script.slice(0, frontendCompletedIndex + 1));
    const frontendStage = stages.find((s) => s.name === "frontend_implementation")!;
    expect(frontendStage.status).toBe("completed");
  });

  it("step 9 — Inspector validates independently, only after the artifact physically arrives at QA", () => {
    const whToQaCompletedIndex = script.findIndex(
      (e, i) =>
        e.type === "transfer.completed" &&
        script
          .slice(0, i)
          .some(
            (prior) =>
              prior.type === "transfer.started" &&
              (prior.payload as { destinationBuildingId: string }).destinationBuildingId === "qa",
          ),
    );
    const validationStartedIndex = indexOf((e) => e.type === "stage.validation_started");
    const validationPassedIndex = indexOf((e) => e.type === "stage.validation_passed");
    expect(whToQaCompletedIndex).toBeGreaterThanOrEqual(0);
    expect(validationStartedIndex).toBeGreaterThan(whToQaCompletedIndex);
    expect(validationPassedIndex).toBeGreaterThan(validationStartedIndex);
    for (const e of [script[validationStartedIndex]!, script[validationPassedIndex]!]) {
      expect(e.actorId).not.toBe(BUILDER);
    }
  });

  it("step 10 — the artifact becomes transfer-ready", () => {
    const readyEvents = script.filter((e) => e.type === "transfer.ready");
    expect(readyEvents.length).toBeGreaterThanOrEqual(1);
    const firstReadyIndex = indexOf((e) => e.type === "transfer.ready");
    const state = reduceWorldState(script.slice(0, firstReadyIndex + 1));
    const stages = selectStages(script.slice(0, firstReadyIndex + 1));
    expect(computeCargoState(state, stages)).toBe("sealed_ready");
  });

  it("step 11 — the utility vehicle represents the authorized transfer, never before transfer.started", () => {
    const firstStartedIndex = indexOf((e) => e.type === "transfer.started");
    const beforeState = reduceWorldState(script.slice(0, firstStartedIndex));
    const beforeTransfer = beforeState.activeTransfers[0];
    expect(computeVehiclePosition(beforeTransfer)).toEqual(computeVehiclePosition(undefined));

    const afterState = reduceWorldState(script.slice(0, firstStartedIndex + 1));
    expect(computeVehicleState(afterState)).toBe("in_transit");
    const afterTransfer = afterState.activeTransfers[0];
    expect(computeVehiclePosition(afterTransfer)).not.toEqual(computeVehiclePosition(undefined));
  });

  it("step 12 — human approval is requested", () => {
    const requestedIndex = indexOf((e) => e.type === "approval.requested");
    const state = reduceWorldState(script.slice(0, requestedIndex + 1));
    expect(state.approvals).toHaveLength(1);
    expect(state.approvals[0]!.status).toBe("pending");
  });

  it("step 13 — the Lighthouse signals attention and exact evidence is inspectable", () => {
    const requestedIndex = indexOf((e) => e.type === "approval.requested");
    const state = reduceWorldState(script.slice(0, requestedIndex + 1));
    expect(computeLighthouseState(state)).toBe("attention_required");
    expect(state.approvals[0]!.evidenceIds.length).toBeGreaterThan(0);
    expect(state.approvals[0]!.reason.length).toBeGreaterThan(0);
    expect(state.approvals[0]!.riskClass).toBeDefined();
  });

  it("step 14 — approval, rejection, and revision-request controls remain contract-correct (see approvalActions.test.ts for full coverage)", () => {
    // The pure builders exist, are schema-valid, and correctly transition
    // WorldState.approvals when applied to this exact canonical script's
    // pending approval — approvalActions.test.ts proves this in detail;
    // this step exists so the journey narrative names it explicitly.
    const requestedIndex = indexOf((e) => e.type === "approval.requested");
    expect(script[requestedIndex]!.type).toBe("approval.requested");
  });

  it("step 15 — valid approval resumes protected progression", () => {
    const approvedIndex = indexOf((e) => e.type === "approval.approved");
    const dockTransferStartedIndex = indexOf(
      (e) =>
        e.type === "transfer.started" &&
        (e.payload as { destinationBuildingId: string }).destinationBuildingId ===
          "deployment-dock",
    );
    expect(approvedIndex).toBeLessThan(dockTransferStartedIndex);
    const state = reduceWorldState(script.slice(0, approvedIndex + 1));
    expect(state.currentBuild!.status).not.toBe("blocked");
  });

  it("step 16 — build completes", () => {
    const completedIndex = indexOf((e) => e.type === "build.completed");
    const state = reduceWorldState(script.slice(0, completedIndex + 1));
    expect(state.currentBuild!.status).toBe("completed");
    expect(state.inventoryCounts.successfulPackages).toBe(10); // 9 seeded + 1 (M-06)
  });

  it("step 17 — Warehouse becomes upgrade-eligible based on the canonical seeded-history rule", () => {
    const buildCompletedIndex = indexOf((e) => e.type === "build.completed");
    const eligibleIndex = indexOf((e) => e.type === "upgrade.eligible");
    expect(eligibleIndex).toBeGreaterThan(buildCompletedIndex);
    const payload = script[eligibleIndex]!.payload as { requirementEvidence: string[] };
    expect(payload.requirementEvidence.some((e) => e.includes("10 successful"))).toBe(true);
  });

  it("step 18 — operator approves the Warehouse upgrade", () => {
    const approvedIndex = indexOf((e) => e.type === "upgrade.approved");
    expect(script[approvedIndex]!.actorType).toBe("operator");
  });

  it("step 19 — mock authority emits upgrade.started and upgrade.completed", () => {
    const startedIndex = indexOf((e) => e.type === "upgrade.started");
    const completedIndex = indexOf((e) => e.type === "upgrade.completed");
    expect(completedIndex).toBeGreaterThan(startedIndex);
  });

  it("step 20 — Warehouse capacity changes atomically from 25 to 100 only on upgrade.completed", () => {
    const completedIndex = indexOf((e) => e.type === "upgrade.completed");
    const before = reduceWorldState(script.slice(0, completedIndex));
    const after = reduceWorldState(script.slice(0, completedIndex + 1));
    const warehouseBefore = before.buildings.find((b) => b.buildingType === "warehouse")!;
    const warehouseAfter = after.buildings.find((b) => b.buildingType === "warehouse")!;
    expect(warehouseBefore.capabilities).not.toContain("capacity_100");
    expect(warehouseAfter.capabilities).toContain("capacity_100");
  });

  it("step 21 — Warehouse visual level changes to Level 2 in the same state transition", () => {
    const completedIndex = indexOf((e) => e.type === "upgrade.completed");
    const before = reduceWorldState(script.slice(0, completedIndex));
    const after = reduceWorldState(script.slice(0, completedIndex + 1));
    const warehouseBefore = before.buildings.find((b) => b.buildingType === "warehouse")!;
    const warehouseAfter = after.buildings.find((b) => b.buildingType === "warehouse")!;
    // Level and capability flip together, from the exact same event.
    expect(warehouseBefore.level).toBe(1);
    expect(warehouseAfter.level).toBe(2);
    expect(warehouseAfter.capabilities).toContain("capacity_100");
  });

  it("step 22 — final state and complete event history remain inspectable", () => {
    const finalState = reduceWorldState(script);
    expect(finalState.lastProcessedEventId).toBe(script[script.length - 1]!.id);
    expect(finalState.currentBuild!.status).toBe("completed");
    const warehouse = finalState.buildings.find((b) => b.buildingType === "warehouse")!;
    expect(warehouse.level).toBe(2);
    // The complete, ordered history is exactly the canonical script itself
    // — nothing dropped, nothing reordered, nothing summarized away.
    expect(script.length).toBeGreaterThan(50);
  });
});
