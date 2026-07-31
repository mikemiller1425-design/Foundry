import { describe, expect, it } from "vitest";
import { buildCanonicalScript } from "./script";
import { selectRequirementsByStage, selectStages } from "./selectors";

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
