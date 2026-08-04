import { describe, expect, it } from "vitest";
import { BUILD_STAGE_SEQUENCE, buildStageSequenceNumber } from "./entities/buildStage";
import {
  BuildPlanSchema,
  CLAUDE_CODE_STAGE,
  PlannedStageSchema,
  planRevision,
  type BuildPlan,
} from "./plan";

/**
 * AC-107 / F-107 — the plan boundary is explicit and fail-closed before an
 * Architect exists. An unknown stage name, a short stage set, a reordering,
 * a disallowed workspace, and an R3+ risk class must each be rejected.
 */

function stage(name: (typeof BUILD_STAGE_SEQUENCE)[number], sequence: number) {
  return {
    name,
    sequence,
    sourceBuildingId: "construction-office",
    destinationBuildingId: "construction-office",
    runtime: "mock" as const,
    required: true,
    requirements: [
      {
        name: "Compiles",
        description: "The module builds without errors.",
        required: true,
        validatorType: "build",
        acceptanceCriteria: ["`pnpm build` exits zero."],
      },
    ],
  };
}

function validPlan(): BuildPlan {
  return {
    planId: "plan-1",
    projectId: "project-1",
    buildId: "build-1",
    objective: "Add a JSON task store module with a test suite",
    workspace: "foundry_managed",
    riskClass: "R2",
    stages: BUILD_STAGE_SEQUENCE.map((name, i) => stage(name, i + 1)),
    createdAt: "2026-08-03T00:00:00.000Z",
  };
}

describe("BuildPlanSchema — the accepted shape", () => {
  it("accepts exactly the seven authoritative stages in sequence", () => {
    expect(BuildPlanSchema.safeParse(validPlan()).success).toBe(true);
  });

  it("accepts a stage with no requirements — planning them is AC-108's job", () => {
    const plan = validPlan();
    plan.stages[1]!.requirements = [];
    expect(BuildPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("accepts each permitted risk class", () => {
    for (const riskClass of ["R0", "R1", "R2"] as const) {
      expect(BuildPlanSchema.safeParse({ ...validPlan(), riskClass }).success, riskClass).toBe(
        true,
      );
    }
  });
});

describe("BuildPlanSchema — the stage set is fixed, ordered, and complete", () => {
  it("rejects an unknown stage name", () => {
    const plan = validPlan();
    (plan.stages[0] as { name: string }).name = "deploy_to_production";
    const parsed = BuildPlanSchema.safeParse(plan);
    expect(parsed.success).toBe(false);
  });

  it("rejects a plan missing a stage", () => {
    const plan = validPlan();
    plan.stages = plan.stages.slice(0, 6);
    const parsed = BuildPlanSchema.safeParse(plan);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toMatch(/exactly the 7 named stages/i);
  });

  it("rejects an extra stage, even a duplicate of a valid one", () => {
    const plan = validPlan();
    plan.stages = [...plan.stages, stage("planning", 8)];
    expect(BuildPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("rejects the seven stages in the wrong order", () => {
    const plan = validPlan();
    [plan.stages[0], plan.stages[1]] = [plan.stages[1]!, plan.stages[0]!];
    const parsed = BuildPlanSchema.safeParse(plan);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toMatch(/must be `planning`/);
  });

  it("rejects a stage whose declared sequence contradicts its position", () => {
    const plan = validPlan();
    plan.stages[3]!.sequence = 99;
    const parsed = BuildPlanSchema.safeParse(plan);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toMatch(/must carry sequence 4/);
  });

  it("names the offending stage index, so a reviewer knows which to fix", () => {
    const plan = validPlan();
    (plan.stages[4] as { name: string }).name = "integration_v2";
    const parsed = BuildPlanSchema.safeParse(plan);
    expect(parsed.error?.issues.some((i) => i.path.includes(4))).toBe(true);
  });
});

describe("BuildPlanSchema — a plan cannot widen workspace or risk", () => {
  it("rejects any workspace but the Foundry-managed one", () => {
    for (const workspace of ["/Users/operator/project", "repository", "operator_nominated", ""]) {
      expect(BuildPlanSchema.safeParse({ ...validPlan(), workspace }).success, workspace).toBe(
        false,
      );
    }
  });

  it("rejects R3, R4, and R5 — they remain unrepresentable", () => {
    for (const riskClass of ["R3", "R4", "R5"] as const) {
      expect(BuildPlanSchema.safeParse({ ...validPlan(), riskClass }).success, riskClass).toBe(
        false,
      );
    }
  });

  it("rejects an objective outside the bounded envelope", () => {
    expect(BuildPlanSchema.safeParse({ ...validPlan(), objective: "no" }).success).toBe(false);
    expect(BuildPlanSchema.safeParse({ ...validPlan(), objective: "x".repeat(501) }).success).toBe(
      false,
    );
  });

  it("rejects an unknown field rather than dropping it", () => {
    expect(BuildPlanSchema.safeParse({ ...validPlan(), autoExecute: true }).success).toBe(false);
  });
});

describe("PlannedStageSchema — a stage cannot name a runtime that does not exist", () => {
  it("accepts only mock and claude_code", () => {
    expect(PlannedStageSchema.safeParse(stage("planning", 1)).success).toBe(true);
    expect(
      PlannedStageSchema.safeParse({ ...stage("planning", 1), runtime: "claude_code" }).success,
    ).toBe(true);
    for (const runtime of ["shell", "docker", "python", ""]) {
      expect(
        PlannedStageSchema.safeParse({ ...stage("planning", 1), runtime }).success,
        runtime,
      ).toBe(false);
    }
  });

  it("requires at least one acceptance criterion per requirement", () => {
    const bad = stage("planning", 1);
    bad.requirements[0]!.acceptanceCriteria = [];
    expect(PlannedStageSchema.safeParse(bad).success).toBe(false);
  });
});

describe("BUILD_STAGE_SEQUENCE — transcribed from v1-scope.md", () => {
  it("is exactly the seven names, in the documented order", () => {
    expect([...BUILD_STAGE_SEQUENCE]).toEqual([
      "planning",
      "scaffold",
      "frontend_implementation",
      "backend_implementation",
      "integration",
      "qa_validation",
      "deployment_package",
    ]);
  });

  it("reports a 1-based position for a known stage and nothing for an unknown one", () => {
    expect(buildStageSequenceNumber("planning")).toBe(1);
    expect(buildStageSequenceNumber("deployment_package")).toBe(7);
    expect(buildStageSequenceNumber("deploy_to_production")).toBeUndefined();
  });
});

describe("planRevision — a change indicator, not the execution binding", () => {
  it("is stable for the same plan", () => {
    expect(planRevision(validPlan())).toBe(planRevision(validPlan()));
  });

  it("does not depend on the order object keys were built in", () => {
    const a = validPlan();
    const b: BuildPlan = {
      createdAt: a.createdAt,
      stages: a.stages,
      riskClass: a.riskClass,
      workspace: a.workspace,
      objective: a.objective,
      buildId: a.buildId,
      projectId: a.projectId,
      planId: a.planId,
    };
    expect(planRevision(b)).toBe(planRevision(a));
  });

  it.each([
    ["the objective", (p: BuildPlan) => (p.objective = "A different bounded objective entirely")],
    ["the risk class", (p: BuildPlan) => (p.riskClass = "R0")],
    ["a requirement's text", (p: BuildPlan) => (p.stages[0]!.requirements[0]!.description = "x")],
    [
      "whether a requirement is mandatory",
      (p: BuildPlan) => (p.stages[0]!.requirements[0]!.required = false),
    ],
    [
      "an acceptance criterion",
      (p: BuildPlan) => (p.stages[2]!.requirements[0]!.acceptanceCriteria = ["different"]),
    ],
    ["a stage runtime", (p: BuildPlan) => (p.stages[3]!.runtime = "claude_code")],
    ["a stage destination", (p: BuildPlan) => (p.stages[4]!.destinationBuildingId = "warehouse")],
    ["the plan id", (p: BuildPlan) => (p.planId = "plan-2")],
  ])("changes when %s changes", (_label, mutate) => {
    const before = validPlan();
    const after = validPlan();
    mutate(after);
    expect(planRevision(after)).not.toBe(planRevision(before));
  });

  it("is a short, printable, prefixed token", () => {
    expect(planRevision(validPlan())).toMatch(/^rev-[0-9a-f]{16}$/);
  });
});

/**
 * AC-107 operator-review correction 3 — Claude Code allocation.
 *
 * The authoritative rule is narrower than "at most one": `domain-model.md`
 * → AgentRun invariants names the stage — "exactly one `AgentRun` in V1
 * uses `runtimeType: claude_code` (the `backend_implementation` stage)".
 */
describe("BuildPlanSchema — Claude Code allocation boundary", () => {
  function planWithClaudeCodeOn(...names: (typeof BUILD_STAGE_SEQUENCE)[number][]) {
    const plan = validPlan();
    for (const name of names) {
      const target = plan.stages.find((s) => s.name === name);
      if (target) target.runtime = "claude_code";
    }
    return plan;
  }

  it("names backend_implementation as the one permitted stage", () => {
    expect(CLAUDE_CODE_STAGE).toBe("backend_implementation");
  });

  it("accepts a plan allocating claude_code to backend_implementation", () => {
    expect(BuildPlanSchema.safeParse(planWithClaudeCodeOn("backend_implementation")).success).toBe(
      true,
    );
  });

  it("accepts a plan allocating no claude_code stage at all", () => {
    expect(BuildPlanSchema.safeParse(validPlan()).success).toBe(true);
  });

  it("REFUSES a plan with two Claude Code stages", () => {
    const parsed = BuildPlanSchema.safeParse(
      planWithClaudeCodeOn("backend_implementation", "frontend_implementation"),
    );
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toMatch(/at most one stage/i);
  });

  it("REFUSES a plan with every stage set to Claude Code", () => {
    const parsed = BuildPlanSchema.safeParse(planWithClaudeCodeOn(...BUILD_STAGE_SEQUENCE));
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toMatch(/at most one stage/i);
  });

  it.each(
    BUILD_STAGE_SEQUENCE.filter((n) => n !== "backend_implementation").map((n) => [n] as const),
  )("REFUSES claude_code on `%s`, even as the only such stage", (name) => {
    const parsed = BuildPlanSchema.safeParse(planWithClaudeCodeOn(name));
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toMatch(/may use the `claude_code` runtime/);
  });

  it("names the offending stage index so a reviewer can find it", () => {
    const parsed = BuildPlanSchema.safeParse(planWithClaudeCodeOn("qa_validation"));
    const qaIndex = BUILD_STAGE_SEQUENCE.indexOf("qa_validation");
    expect(parsed.error?.issues.some((i) => i.path.includes(qaIndex))).toBe(true);
  });

  it("reports the allocation violation even when the plan is also misordered", () => {
    const plan = planWithClaudeCodeOn("scaffold");
    [plan.stages[0], plan.stages[1]] = [plan.stages[1]!, plan.stages[0]!];
    const parsed = BuildPlanSchema.safeParse(plan);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toMatch(/may use the `claude_code` runtime/);
  });
});
