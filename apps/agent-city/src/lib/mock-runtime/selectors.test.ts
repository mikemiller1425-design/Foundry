import type { FoundryEvent } from "@foundry/event-types";
import { describe, expect, it } from "vitest";
import { buildApprovalRevisionRequestedEvents } from "./approvalActions";
import { createEventFactory } from "./eventFactory";
import { buildCanonicalScript } from "./script";
import {
  selectRequirementsByStage,
  selectStages,
  selectUpgradeInProgress,
} from "./selectors";

describe("selectStages", () => {
  it("returns all seven stages, in canonical order, with correct terminal statuses after a full run", () => {
    const seed = "selectors-stages";
    const script = buildCanonicalScript(seed);
    const stages = selectStages(script);

    expect(stages.map((s) => s.name)).toEqual([
      "planning",
      "scaffold",
      "frontend_implementation",
      "backend_implementation",
      "integration",
      "qa_validation",
      "deployment_package",
    ]);
    for (const stage of stages) {
      expect(stage.status).toBe("completed");
    }
  });

  it("reflects a stage as blocked immediately after the intentional requirement failure, before recovery", () => {
    const seed = "selectors-blocked";
    const script = buildCanonicalScript(seed);
    const blockedIndex = script.findIndex((e) => e.type === "stage.blocked");
    const stages = selectStages(script.slice(0, blockedIndex + 1));
    const frontend = stages.find((s) => s.name === "frontend_implementation")!;
    expect(frontend.status).toBe("blocked");
    expect(frontend.blockedReason).toBe("Mandatory requirement failed");
  });

  it("stages not yet created (revealed) don't appear at all, only stages seen so far do", () => {
    const seed = "selectors-unreached";
    const script = buildCanonicalScript(seed);
    const firstStageReady = script.findIndex((e) => e.type === "stage.ready");
    const stages = selectStages(script.slice(0, firstStageReady + 1));
    expect(stages.map((s) => s.name)).toEqual(["planning"]);
    expect(stages.find((s) => s.name === "deployment_package")).toBeUndefined();
  });

  it("FBL-021: records sourceBuildingId from stage.started, for deriving operational-building status", () => {
    const script = buildCanonicalScript("selectors-source-building");
    const stages = selectStages(script);
    const office = stages.find((s) => s.name === "frontend_implementation")!;
    expect(office.sourceBuildingId).toBe("construction-office");
    const qa = stages.find((s) => s.name === "qa_validation")!;
    expect(qa.sourceBuildingId).toBe("qa");
  });

  it("FBL-021: a Request Revision resolution flips the stage to revision_required then back to running", () => {
    const seed = "selectors-revision";
    const script = buildCanonicalScript(seed);
    // Splice in a revision flow right after qa_validation completes, as if
    // the operator had requested revision instead of approving (the same
    // approvalActions.ts builder the runtime uses for this non-happy path).
    const qaCompletedIndex = script.findIndex(
      (e) => e.type === "stage.completed" && e.entityId.includes("stage-qa"),
    );
    const qaStageId = script[qaCompletedIndex]!.entityId;
    const approvalRequestedIndex = script.findIndex((e) => e.type === "approval.requested");
    const approvalId = script[approvalRequestedIndex]!.entityId;
    const revisionEvents = buildApprovalRevisionRequestedEvents({
      seed,
      correlationId: approvalId,
      approvalId,
      stageId: qaStageId,
      resolvedBy: "operator-1",
      revisionId: "revision-test-1",
      reason: "Please add more evidence",
    });

    const upToRevisionRequested = [
      ...script.slice(0, approvalRequestedIndex + 1),
      revisionEvents[0]!,
      revisionEvents[1]!,
    ];
    const requiredStage = selectStages(upToRevisionRequested).find(
      (s) => s.name === "qa_validation",
    )!;
    expect(requiredStage.status).toBe("revision_required");

    const upToRevisionStarted = [...upToRevisionRequested, revisionEvents[2]!];
    const runningStage = selectStages(upToRevisionStarted).find(
      (s) => s.name === "qa_validation",
    )!;
    expect(runningStage.status).toBe("running");
  });
});

describe("selectUpgradeInProgress", () => {
  it("is false before any upgrade activity and after a full run's upgrade.completed", () => {
    const script = buildCanonicalScript("selectors-upgrade-full");
    expect(selectUpgradeInProgress([])).toBe(false);
    expect(selectUpgradeInProgress(script)).toBe(false);
  });

  it("is true strictly between upgrade.started and its terminal event", () => {
    const script = buildCanonicalScript("selectors-upgrade-progress");
    const startedIndex = script.findIndex((e) => e.type === "upgrade.started");
    const completedIndex = script.findIndex((e) => e.type === "upgrade.completed");
    expect(selectUpgradeInProgress(script.slice(0, startedIndex + 1))).toBe(true);
    expect(selectUpgradeInProgress(script.slice(0, completedIndex + 1))).toBe(false);
  });

  it("returns to false after upgrade.failed", () => {
    const seed = "selectors-upgrade-failed";
    const event = createEventFactory(seed, "upgrade-1");
    const events: FoundryEvent[] = [
      event({
        type: "upgrade.started",
        entityType: "Upgrade",
        entityId: "upgrade-1",
        actorType: "backend",
        actorId: "backend",
        payload: {},
      }),
      event({
        type: "upgrade.failed",
        entityType: "Upgrade",
        entityId: "upgrade-1",
        actorType: "backend",
        actorId: "backend",
        payload: {},
      }),
    ];
    expect(selectUpgradeInProgress(events)).toBe(false);
  });
});

describe("selectRequirementsByStage", () => {
  it("associates each requirement with the stage that was running when it fired", () => {
    const seed = "selectors-requirements";
    const script = buildCanonicalScript(seed);
    const byStage = selectRequirementsByStage(script);
    const stages = selectStages(script);

    const frontendStageId = stages.find((s) => s.name === "frontend_implementation")!.id;
    const frontendRequirements = byStage.get(frontendStageId) ?? [];
    // Create task, complete task, and delete task (which failed then passed
    // on retry) — three distinct requirements for frontend_implementation.
    expect(frontendRequirements).toHaveLength(3);
    expect(frontendRequirements.every((r) => r.status === "passed")).toBe(true);
  });

  it("clears the failure message once a requirement passes on retry — it does not read as still-failing", () => {
    const seed = "selectors-requirements-cleared";
    const script = buildCanonicalScript(seed);
    const byStage = selectRequirementsByStage(script);
    const allRequirements = [...byStage.values()].flat();
    const retried = allRequirements.find((r) => r.status === "passed" && r.stageId);
    expect(retried).toBeDefined();
    for (const req of allRequirements) {
      if (req.status === "passed") expect(req.message).toBeUndefined();
    }
  });

  it("the intentional failure is visible mid-stream before its retry resolves it", () => {
    const seed = "selectors-requirements-midstream";
    const script = buildCanonicalScript(seed);
    const failedIndex = script.findIndex((e) => e.type === "requirement.failed");
    const byStage = selectRequirementsByStage(script.slice(0, failedIndex + 1));
    const allRequirements = [...byStage.values()].flat();
    const failed = allRequirements.find((r) => r.status === "failed");
    expect(failed).toBeDefined();
    expect(failed?.message).toContain("error state");
  });
});
