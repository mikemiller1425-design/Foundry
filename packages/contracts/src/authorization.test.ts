import { describe, expect, it } from "vitest";
import {
  ExecutionAuthorizationDraftSchema,
  ExecutionAuthorizationSchema,
  MAX_BUDGET_USD_CEILING,
  authorizesPlan,
  isExecutionAuthorization,
  type ExecutionAuthorization,
} from "./authorization";
import { BUILD_STAGE_SEQUENCE } from "./entities/buildStage";
import { planRevision, type BuildPlan } from "./plan";

function validPlan(): BuildPlan {
  return {
    planId: "plan-1",
    projectId: "project-1",
    buildId: "build-1",
    objective: "Add a JSON task store module with a test suite",
    workspace: "foundry_managed",
    riskClass: "R2",
    stages: BUILD_STAGE_SEQUENCE.map((name, i) => ({
      name,
      sequence: i + 1,
      sourceBuildingId: "construction-office",
      destinationBuildingId: "construction-office",
      runtime: "mock" as const,
      required: true,
      requirements: [],
    })),
    createdAt: "2026-08-03T00:00:00.000Z",
  };
}

function validAuthorization(plan = validPlan()): ExecutionAuthorization {
  return {
    authorizationId: "auth-1",
    planId: plan.planId,
    planRevision: planRevision(plan),
    projectId: plan.projectId,
    buildId: plan.buildId,
    stageName: "backend_implementation",
    workspace: plan.workspace,
    riskClass: plan.riskClass,
    maxBudgetUsd: 5,
    authorizedBy: "operator-1",
    authorizedAt: "2026-08-03T00:00:00.000Z",
    singleUse: true,
  };
}

describe("ExecutionAuthorizationSchema — the accepted shape", () => {
  it("accepts a well-formed single-use authorization", () => {
    expect(ExecutionAuthorizationSchema.safeParse(validAuthorization()).success).toBe(true);
  });

  it("REJECTS an omitted budget — every issued authorization is budgeted", () => {
    // Corrected at the operator AC-107 review: the field was optional
    // while the contract claimed an absent budget was unrepresentable.
    const { maxBudgetUsd: _omitted, ...rest } = validAuthorization();
    expect(ExecutionAuthorizationSchema.safeParse(rest).success).toBe(false);
  });
});

describe("ExecutionAuthorizationSchema — single-use is a property of the type", () => {
  it("rejects singleUse: false — a multi-use authorization is unrepresentable", () => {
    expect(
      ExecutionAuthorizationSchema.safeParse({ ...validAuthorization(), singleUse: false }).success,
    ).toBe(false);
  });

  it("requires singleUse to be present at all", () => {
    const { singleUse: _omitted, ...rest } = validAuthorization();
    expect(ExecutionAuthorizationSchema.safeParse(rest).success).toBe(false);
  });

  it("authorizes exactly one named stage, never a build-wide wildcard", () => {
    for (const stageName of ["*", "all", "", "deploy_to_production"]) {
      expect(
        ExecutionAuthorizationSchema.safeParse({ ...validAuthorization(), stageName }).success,
        stageName,
      ).toBe(false);
    }
  });
});

describe("ExecutionAuthorizationSchema — it cannot widen the boundary", () => {
  it("rejects R3+ risk", () => {
    for (const riskClass of ["R3", "R4", "R5"] as const) {
      expect(
        ExecutionAuthorizationSchema.safeParse({ ...validAuthorization(), riskClass }).success,
        riskClass,
      ).toBe(false);
    }
  });

  it("rejects a workspace other than the Foundry-managed one", () => {
    expect(
      ExecutionAuthorizationSchema.safeParse({
        ...validAuthorization(),
        workspace: "/Users/operator/real-project",
      }).success,
    ).toBe(false);
  });

  it("rejects an unbounded, zero, negative, or over-ceiling budget", () => {
    for (const maxBudgetUsd of [0, -1, Number.POSITIVE_INFINITY, MAX_BUDGET_USD_CEILING + 1]) {
      expect(
        ExecutionAuthorizationSchema.safeParse({ ...validAuthorization(), maxBudgetUsd }).success,
        String(maxBudgetUsd),
      ).toBe(false);
    }
  });

  it("rejects an unknown field rather than dropping it", () => {
    expect(
      ExecutionAuthorizationSchema.safeParse({ ...validAuthorization(), allowNetwork: true })
        .success,
    ).toBe(false);
  });

  it("requires an authorizing operator and a timestamp", () => {
    for (const field of ["authorizedBy", "authorizedAt", "planRevision", "maxBudgetUsd"] as const) {
      const input: Record<string, unknown> = { ...validAuthorization() };
      delete input[field];
      expect(ExecutionAuthorizationSchema.safeParse(input).success, field).toBe(false);
    }
  });
});

/**
 * F-113: "a modified plan invalidates it, and one authorization cannot
 * cover a second run."
 */
describe("authorizesPlan — plan-bound", () => {
  it("accepts the authorization against the plan it was granted for", () => {
    const plan = validPlan();
    expect(authorizesPlan(validAuthorization(plan), plan)).toEqual({
      valid: true,
      mismatches: [],
    });
  });

  it("refuses once the plan is modified in any reviewed detail", () => {
    const plan = validPlan();
    const authorization = validAuthorization(plan);

    const edited = validPlan();
    edited.stages[3]!.runtime = "claude_code";

    const check = authorizesPlan(authorization, edited);
    expect(check.valid).toBe(false);
    expect(check.mismatches).toContain("plan_modified");
  });

  it("refuses a different plan id, build, or project", () => {
    const plan = validPlan();
    expect(
      authorizesPlan(validAuthorization(plan), { ...plan, planId: "plan-2" }).mismatches,
    ).toContain("plan_id_mismatch");
    expect(
      authorizesPlan(validAuthorization(plan), { ...plan, buildId: "build-2" }).mismatches,
    ).toContain("build_mismatch");
    expect(
      authorizesPlan(validAuthorization(plan), { ...plan, projectId: "project-2" }).mismatches,
    ).toContain("project_mismatch");
  });

  it("refuses when the authorized stage is not in the plan", () => {
    const plan = validPlan();
    const authorization = validAuthorization(plan);
    const shortened: BuildPlan = { ...plan, stages: plan.stages.slice(0, 2) };
    expect(authorizesPlan(authorization, shortened).mismatches).toContain("stage_not_in_plan");
  });

  it("refuses when workspace or risk class drifted from the plan", () => {
    const plan = validPlan();
    const authorization = validAuthorization(plan);
    expect(authorizesPlan({ ...authorization, riskClass: "R0" }, plan).mismatches).toContain(
      "risk_class_mismatch",
    );
  });

  it("reports every mismatch at once rather than stopping at the first", () => {
    const plan = validPlan();
    const authorization = validAuthorization(plan);
    const other: BuildPlan = {
      ...validPlan(),
      planId: "plan-9",
      buildId: "build-9",
      riskClass: "R0",
    };
    const check = authorizesPlan(authorization, other);
    expect(check.mismatches.length).toBeGreaterThan(2);
    expect(check.valid).toBe(false);
  });
});

/**
 * AC-107 operator-review corrections.
 */
describe("ExecutionAuthorizationSchema — the budget is required and capped (correction 1)", () => {
  it("caps V1.1 spend at $25", () => {
    expect(MAX_BUDGET_USD_CEILING).toBe(25);
  });

  it("accepts a positive finite amount at or below the ceiling", () => {
    for (const maxBudgetUsd of [0.01, 1, 24.99, MAX_BUDGET_USD_CEILING]) {
      expect(
        ExecutionAuthorizationSchema.safeParse({ ...validAuthorization(), maxBudgetUsd }).success,
        String(maxBudgetUsd),
      ).toBe(true);
    }
  });

  it("rejects anything above the ceiling, including the previous $100 limit", () => {
    for (const maxBudgetUsd of [25.01, 26, 100]) {
      expect(
        ExecutionAuthorizationSchema.safeParse({ ...validAuthorization(), maxBudgetUsd }).success,
        String(maxBudgetUsd),
      ).toBe(false);
    }
  });

  it("rejects non-finite, zero, and negative amounts", () => {
    for (const maxBudgetUsd of [0, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(
        ExecutionAuthorizationSchema.safeParse({ ...validAuthorization(), maxBudgetUsd }).success,
        String(maxBudgetUsd),
      ).toBe(false);
    }
  });
});

describe("ExecutionAuthorizationDraftSchema — a draft can never authorize (correction 1)", () => {
  function validDraft() {
    return {
      kind: "execution_authorization_draft" as const,
      planId: "plan-1",
      projectId: "project-1",
      buildId: "build-1",
      workspace: "foundry_managed" as const,
      riskClass: "R2" as const,
    };
  }

  it("accepts an incomplete draft — no stage, no budget, no operator", () => {
    expect(ExecutionAuthorizationDraftSchema.safeParse(validDraft()).success).toBe(true);
  });

  it("a draft does NOT parse as an ExecutionAuthorization", () => {
    expect(ExecutionAuthorizationSchema.safeParse(validDraft()).success).toBe(false);
  });

  it("a complete draft still does NOT parse as an ExecutionAuthorization", () => {
    const filled = {
      ...validDraft(),
      stageName: "backend_implementation" as const,
      planRevision: "rev-abc",
      maxBudgetUsd: 5,
    };
    expect(ExecutionAuthorizationDraftSchema.safeParse(filled).success).toBe(true);
    expect(ExecutionAuthorizationSchema.safeParse(filled).success).toBe(false);
  });

  it("an ExecutionAuthorization does NOT parse as a draft", () => {
    expect(ExecutionAuthorizationDraftSchema.safeParse(validAuthorization()).success).toBe(false);
  });

  it("no object satisfies both schemas", () => {
    const candidates: unknown[] = [validDraft(), validAuthorization()];
    for (const candidate of candidates) {
      const asDraft = ExecutionAuthorizationDraftSchema.safeParse(candidate).success;
      const asAuth = ExecutionAuthorizationSchema.safeParse(candidate).success;
      expect(asDraft && asAuth).toBe(false);
    }
  });

  it("isExecutionAuthorization refuses every draft", () => {
    expect(isExecutionAuthorization(validDraft())).toBe(false);
    expect(isExecutionAuthorization({ ...validDraft(), singleUse: true })).toBe(false);
    expect(isExecutionAuthorization(validAuthorization())).toBe(true);
  });
});
