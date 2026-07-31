import { describe, expect, it } from "vitest";
import { buildCanonicalScript } from "./script";
import { createInitialWorldState, reduceWorldState } from "./worldStateReducer";

describe("createInitialWorldState — M-06 seeded history", () => {
  it("seeds exactly 9 previously successful packages at world init", () => {
    const state = createInitialWorldState();
    expect(state.inventoryCounts.successfulPackages).toBe(9);
  });
});

describe("reduceWorldState — idempotent duplicate handling", () => {
  it("applying the same event twice does not double-count the upgrade eligibility increment", () => {
    const script = buildCanonicalScript("dup-check");
    const once = reduceWorldState(script);
    const buildCompleted = script.find((e) => e.type === "build.completed")!;
    const withDuplicate = [...script, buildCompleted]; // re-deliver the same event id
    const twice = reduceWorldState(withDuplicate);
    expect(twice.inventoryCounts.successfulPackages).toBe(once.inventoryCounts.successfulPackages);
    expect(once.inventoryCounts.successfulPackages).toBe(10); // 9 seeded + 1 (M-06)
  });

  it("duplicate delivery never duplicates an active transfer entry", () => {
    const script = buildCanonicalScript("dup-transfer");
    const transferCreated = script.find((e) => e.type === "transfer.created")!;
    const state = reduceWorldState([transferCreated, transferCreated, transferCreated]);
    expect(state.activeTransfers).toHaveLength(1);
  });

  it("reduceWorldState over the full script twice from scratch produces identical WorldState", () => {
    const script = buildCanonicalScript("determinism-state");
    const a = reduceWorldState(script);
    const b = reduceWorldState(buildCanonicalScript("determinism-state"));
    expect(a).toEqual(b);
  });

  it("lastProcessedEventId reflects the last event applied, not skipped by a duplicate", () => {
    const script = buildCanonicalScript("last-id");
    const first = script[0]!;
    const state = reduceWorldState([first, first]);
    expect(state.lastProcessedEventId).toBe(first.id);
  });
});

describe("reduceWorldState — blocked progression", () => {
  it("reflects the build as blocked immediately after the intentional requirement failure", () => {
    const script = buildCanonicalScript("blocked-check");
    const blockedIndex = script.findIndex((e) => e.type === "stage.blocked");
    expect(blockedIndex).toBeGreaterThan(0);
    const state = reduceWorldState(script.slice(0, blockedIndex + 1));
    expect(state.currentBuild?.status).toBe("blocked");
  });

  it("build progresses out of blocked once the retried requirement passes and later stages run", () => {
    const script = buildCanonicalScript("unblock-check");
    const finalState = reduceWorldState(script);
    expect(finalState.currentBuild?.status).toBe("completed");
  });

  it("build status recovers from 'blocked' well before completion — it does not stay stuck for the rest of the run", () => {
    // Regression: reaching build.completed always overwrites status, which
    // previously masked a bug where nothing ever cleared "blocked" in
    // between — the build showed as permanently blocked through backend
    // implementation, integration, and QA validation.
    const script = buildCanonicalScript("unblock-midstream-check");
    const qaValidationPassedIndex = script.findIndex((e) => e.type === "stage.validation_passed");
    expect(qaValidationPassedIndex).toBeGreaterThan(0);
    const state = reduceWorldState(script.slice(0, qaValidationPassedIndex + 1));
    expect(state.currentBuild?.status).not.toBe("blocked");
  });
});

describe("reduceWorldState — approval gating", () => {
  it("the deployment approval is recorded as approved by the end of the canonical run", () => {
    const script = buildCanonicalScript("approval-check");
    const state = reduceWorldState(script);
    expect(state.approvals).toHaveLength(1);
    expect(state.approvals[0]?.status).toBe("approved");
  });

  it("the approval exists as pending immediately after approval.requested, before approval.approved", () => {
    const script = buildCanonicalScript("approval-pending-check");
    const requestedIndex = script.findIndex((e) => e.type === "approval.requested");
    const state = reduceWorldState(script.slice(0, requestedIndex + 1));
    expect(state.approvals).toHaveLength(1);
    expect(state.approvals[0]?.status).toBe("pending");
  });
});

describe("reduceWorldState — upgrade sequence", () => {
  it("the Warehouse remains level 1 until upgrade.completed, then becomes level 2", () => {
    const script = buildCanonicalScript("upgrade-check");
    const upgradeStartedIndex = script.findIndex((e) => e.type === "upgrade.started");
    const beforeCompletion = reduceWorldState(script.slice(0, upgradeStartedIndex + 1));
    const warehouseBefore = beforeCompletion.buildings.find((b) => b.buildingType === "warehouse");
    expect(warehouseBefore?.level).toBe(1);

    const finalState = reduceWorldState(script);
    const warehouseAfter = finalState.buildings.find((b) => b.buildingType === "warehouse");
    expect(warehouseAfter?.level).toBe(2);
  });
});

describe("reduceWorldState — agent lifecycle", () => {
  it("an agent that has returned home ends idle at its home building", () => {
    const script = buildCanonicalScript("agent-lifecycle");
    const state = reduceWorldState(script);
    const architect = state.agents.find((a) => a.role === "architect");
    expect(architect?.status).toBe("idle");
    expect(architect?.currentBuildingId).toBe(architect?.homeBuildingId);
  });
});
