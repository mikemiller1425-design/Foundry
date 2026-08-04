import { BUILD_STAGE_SEQUENCE, BuildPlanSchema, CLAUDE_CODE_STAGE } from "@foundry/contracts";
import { describe, expect, it } from "vitest";
import { buildPlanForObjective, planRequirementCount, planStageIds } from "./planBuild";

const INPUTS = {
  planId: "plan-1",
  projectId: "project-1",
  buildId: "build-1",
  objective: "Add a JSON task store module with a test suite",
  workspace: "foundry_managed" as const,
  riskClass: "R2" as const,
  createdAt: "2026-08-03T00:00:00.000Z",
};

describe("buildPlanForObjective — the Architect step (AC-108)", () => {
  it("produces a plan the contract accepts", () => {
    const parsed = BuildPlanSchema.safeParse(buildPlanForObjective(INPUTS));
    expect(parsed.success).toBe(true);
  });

  it("uses exactly the seven authoritative stages, in order", () => {
    const plan = buildPlanForObjective(INPUTS);
    expect(plan.stages.map((s) => s.name)).toEqual([...BUILD_STAGE_SEQUENCE]);
    expect(plan.stages.map((s) => s.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("carries the operator's objective through verbatim", () => {
    expect(buildPlanForObjective(INPUTS).objective).toBe(INPUTS.objective);
  });

  it("allocates claude_code to exactly one stage, and only backend_implementation", () => {
    const plan = buildPlanForObjective(INPUTS);
    const claude = plan.stages.filter((s) => s.runtime === "claude_code");
    expect(claude).toHaveLength(1);
    expect(claude[0]!.name).toBe(CLAUDE_CODE_STAGE);
  });

  it("stays inside the Foundry-managed workspace and the submitted risk class", () => {
    for (const riskClass of ["R0", "R1", "R2"] as const) {
      const plan = buildPlanForObjective({ ...INPUTS, riskClass });
      expect(plan.workspace).toBe("foundry_managed");
      expect(plan.riskClass).toBe(riskClass);
      expect(BuildPlanSchema.safeParse(plan).success).toBe(true);
    }
  });

  it("is deterministic — the same inputs produce an identical plan", () => {
    expect(buildPlanForObjective(INPUTS)).toEqual(buildPlanForObjective(INPUTS));
  });

  it("gives every requirement at least one plain-text acceptance criterion", () => {
    for (const stage of buildPlanForObjective(INPUTS).stages) {
      for (const requirement of stage.requirements) {
        expect(requirement.acceptanceCriteria.length).toBeGreaterThan(0);
        for (const criterion of requirement.acceptanceCriteria) {
          expect(typeof criterion).toBe("string");
          expect(criterion.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("states that the Claude Code stage is validated independently", () => {
    const stage = buildPlanForObjective(INPUTS).stages.find((s) => s.name === CLAUDE_CODE_STAGE);
    const criteria = stage!.requirements.flatMap((r) => r.acceptanceCriteria).join(" ");
    expect(criteria).toMatch(/independent tests the Builder did not write/i);
  });

  it("invents no budget, no runtime state, and no execution field", () => {
    const serialised = JSON.stringify(buildPlanForObjective(INPUTS));
    for (const forbidden of ["maxBudgetUsd", "authorization", "status", "startedAt", "agentRun"]) {
      expect(serialised, forbidden).not.toContain(forbidden);
    }
  });

  it("names one planned stage id per authoritative stage, deterministically", () => {
    expect(planStageIds("plan-1")).toEqual(planStageIds("plan-1"));
    expect(planStageIds("plan-1")).toHaveLength(BUILD_STAGE_SEQUENCE.length);
    expect(planStageIds("plan-1")[0]).toContain("planning");
  });

  it("counts every planned requirement", () => {
    const plan = buildPlanForObjective(INPUTS);
    expect(planRequirementCount(plan)).toBe(
      plan.stages.reduce((n, s) => n + s.requirements.length, 0),
    );
  });
});
