import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BUILD_STAGE_SEQUENCE,
  CLAUDE_CODE_STAGE,
  MAX_BUDGET_USD_CEILING,
  canonicalPlanContent,
  planRevision,
  plannedStageId,
  type BuildPlan,
  type BuildStageName,
  type PersistedPlan,
} from "@foundry/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandHandler, executionAuthorizationId, type CommandActor } from "./commandHandler";
import { evaluateExecutionGate, readExecutionGateInput } from "./executionGate";
import { ObjectiveIntake } from "./objectiveIntake";
import { PersistenceService } from "./persistenceService";
import { PLAN_CONTENT_HASH_PREFIX, planContentHash, plansContentHashEquals } from "./planContentHash";

/**
 * AC-110 — the execution authorization gate.
 *
 * Two properties carry this rung, and both are proven in both directions:
 * **no real execution is permitted without an explicit operator
 * authorization**, and that authorization is **single-use and bound to a
 * backend-generated SHA-256 over persisted plan content**.
 */

const OPERATOR: CommandActor = {
  actorType: "operator",
  actorId: "operator-1",
  authenticated: true,
};
const AGENT: CommandActor = { actorType: "agent", actorId: "agent-builder", authenticated: true };
const ANON: CommandActor = { actorType: "frontend", actorId: "anonymous", authenticated: false };
const BACKEND: CommandActor = { actorType: "backend", actorId: "backend", authenticated: true };

const OBJECTIVE = "Add a JSON task store module with a test suite";

let dir: string;
let persistence: PersistenceService;
let handler: CommandHandler;

function planFor(buildId: string, projectId: string, planId = "plan-1"): BuildPlan {
  return {
    planId,
    projectId,
    buildId,
    objective: OBJECTIVE,
    workspace: "foundry_managed",
    riskClass: "R2",
    createdAt: "2026-08-04T00:00:00.000Z",
    stages: BUILD_STAGE_SEQUENCE.map((name, i) => ({
      name,
      sequence: i + 1,
      sourceBuildingId: "construction-office",
      destinationBuildingId: "construction-office",
      runtime: name === CLAUDE_CODE_STAGE ? ("claude_code" as const) : ("mock" as const),
      required: true,
      requirements: [
        {
          name: `${name} complete`,
          description: "Stage work is done.",
          required: true,
          validatorType: "test",
          acceptanceCriteria: ["It completes with its stated work done."],
        },
      ],
    })),
  };
}

function seedPlannedBuild(): BuildPlan {
  const intake = new ObjectiveIntake(handler, (kind) => `${kind}-1`);
  const result = intake.submit(
    { objective: OBJECTIVE, workspace: "foundry_managed", riskClass: "R2" },
    OPERATOR,
  );
  const plan = planFor(result.buildId as string, result.projectId as string);
  expect(
    handler.submit(
      {
        commandType: "Build.Plan",
        entityId: plan.buildId,
        params: {
          planId: plan.planId,
          planArtifactId: plan.planId,
          stageIds: BUILD_STAGE_SEQUENCE.map((n) => plannedStageId(plan.planId, n)),
          requirementCount: 7,
          plan,
        },
      },
      OPERATOR,
    ).accepted,
  ).toBe(true);
  return plan;
}

function review(plan: BuildPlan, decision: "proceed" | "rejected" | "revision_requested") {
  return handler.submit(
    {
      commandType: "Plan.Review",
      entityId: plan.planId,
      params: {
        planId: plan.planId,
        buildId: plan.buildId,
        reviewedRevision: planRevision(plan),
        decision,
      },
    },
    OPERATOR,
  );
}

function persistedPlanFor(planId: string): PersistedPlan {
  return persistence.getEntity<PersistedPlan>("plans", planId) as PersistedPlan;
}

function authorize(
  plan: BuildPlan,
  overrides: Record<string, unknown> = {},
  actor: CommandActor = OPERATOR,
) {
  const persisted = persistedPlanFor(plan.planId);
  return handler.submit(
    {
      commandType: "Plan.Authorize",
      entityId: plan.planId,
      params: {
        planId: plan.planId,
        buildId: plan.buildId,
        stageName: CLAUDE_CODE_STAGE,
        maxBudgetUsd: 5,
        acknowledgedContentHash: persisted.contentHash,
        ...overrides,
      },
    },
    actor,
  );
}

/** A reviewed plan, ready to authorize. */
function seedReviewedPlan(): BuildPlan {
  const plan = seedPlannedBuild();
  expect(review(plan, "proceed").accepted).toBe(true);
  return plan;
}

function fullSnapshot() {
  return { events: persistence.getAllEvents(), world: persistence.getWorldStateSnapshot() };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "foundry-authorization-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  handler = new CommandHandler(persistence);
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("AC-110 planContentHash — the backend-generated binding (F-113a)", () => {
  it("is a SHA-256 over canonical plan content, announced by its prefix", () => {
    const plan = planFor("build-1", "project-1");
    const hash = planContentHash(plan);
    expect(hash.startsWith(PLAN_CONTENT_HASH_PREFIX)).toBe(true);
    expect(hash.slice(PLAN_CONTENT_HASH_PREFIX.length)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — a replay recomputes the identical binding", () => {
    const plan = planFor("build-1", "project-1");
    expect(planContentHash(plan)).toBe(planContentHash(planFor("build-1", "project-1")));
    expect(canonicalPlanContent(plan)).toBe(canonicalPlanContent(planFor("build-1", "project-1")));
  });

  it.each([
    ["the objective", (p: BuildPlan) => ({ ...p, objective: `${OBJECTIVE} and a README` })],
    ["a stage's runtime", (p: BuildPlan) => ({ ...p, stages: p.stages.map((s, i) => (i === 1 ? { ...s, runtime: "claude_code" as const } : s)) })],
    ["an acceptance criterion", (p: BuildPlan) => ({ ...p, stages: p.stages.map((s, i) => (i === 0 ? { ...s, requirements: [{ ...s.requirements[0]!, acceptanceCriteria: ["something else"] }] } : s)) })],
    ["a source building", (p: BuildPlan) => ({ ...p, stages: p.stages.map((s, i) => (i === 2 ? { ...s, sourceBuildingId: "warehouse" } : s)) })],
  ])("changes when %s changes", (_label, mutate) => {
    const plan = planFor("build-1", "project-1");
    expect(planContentHash(mutate(plan))).not.toBe(planContentHash(plan));
  });

  it("is never computable from the browser bundle — the producer is backend-only", () => {
    /**
     * `F-113a` requires the binding be backend-generated. `@foundry/contracts`
     * ships to the browser, so the only defensible way to guarantee that is
     * for the producer to be unreachable there.
     *
     * Asserted over **import statements**, not raw file text. A text search
     * matches the prose that documents this very boundary — the same way an
     * `AC-109` tripwire was defeated by its own module comment — so the
     * assertion has to be about what the module pulls in, not about what it
     * says about itself.
     */
    const importedModules = (source: string): string[] =>
      [...source.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1] as string);

    const contractsPlan = readFileSync(
      join(import.meta.dirname, "..", "..", "contracts", "src", "plan.ts"),
      "utf-8",
    );
    expect(importedModules(contractsPlan)).not.toContain("node:crypto");
    expect(importedModules(readFileSync(join(import.meta.dirname, "planContentHash.ts"), "utf-8"))).toContain(
      "node:crypto",
    );
  });

  it("compares equal hashes and rejects any difference, including length", () => {
    const a = planContentHash(planFor("build-1", "project-1"));
    expect(plansContentHashEquals(a, a)).toBe(true);
    expect(plansContentHashEquals(a, `${a}x`)).toBe(false);
    expect(plansContentHashEquals(a, a.replace(/.$/, "0") === a ? `${a.slice(0, -1)}1` : a.replace(/.$/, "0"))).toBe(false);
  });
});

describe("AC-110 the plan carries its binding", () => {
  it("stores a content hash on every persisted plan, matching a fresh computation", () => {
    const plan = seedPlannedBuild();
    const persisted = persistedPlanFor(plan.planId);
    expect(persisted.contentHash).toBe(planContentHash(plan));
    expect(persisted.authorization).toBeNull();
  });

  it("recomputes the identical hash after a restart", () => {
    const plan = seedPlannedBuild();
    const before = persistedPlanFor(plan.planId).contentHash;
    persistence.close();
    const reopened = new PersistenceService(join(dir, "foundry.sqlite"));
    try {
      expect(reopened.getEntity<PersistedPlan>("plans", plan.planId)?.contentHash).toBe(before);
    } finally {
      reopened.close();
      persistence = new PersistenceService(join(dir, "foundry.sqlite"));
    }
  });
});

describe("AC-110 Plan.Authorize — issuing the authorization", () => {
  it("records who, what, when, and against which plan (F-114)", () => {
    const plan = seedReviewedPlan();
    const outcome = authorize(plan);
    expect(outcome.accepted).toBe(true);

    const authorization = persistedPlanFor(plan.planId).authorization;
    expect(authorization).not.toBeNull();
    expect(authorization).toMatchObject({
      authorizationId: executionAuthorizationId(plan.planId),
      authorizedBy: "operator-1", // who
      stageName: CLAUDE_CODE_STAGE, // what
      planId: plan.planId, // against which plan
      planContentHash: planContentHash(plan), // …and against which content
      maxBudgetUsd: 5,
      singleUse: true,
    });
    expect(typeof authorization?.authorizedAt).toBe("string"); // when
  });

  it("writes the BACKEND's hash, not the caller's acknowledgement", () => {
    const plan = seedReviewedPlan();
    expect(authorize(plan).accepted).toBe(true);
    const event = persistence.getAllEvents().find((e) => e.type === "operator.execution_authorized");
    const payload = event?.payload as Record<string, unknown>;
    expect(payload.planContentHash).toBe(planContentHash(plan));
    // The client's field is consumed by the check and never carried onto
    // the record, so no later reader can confuse it for the binding.
    expect(payload).not.toHaveProperty("acknowledgedContentHash");
  });

  it("derives workspace, risk class, revision, and authorizer from truth, not the payload", () => {
    const plan = seedReviewedPlan();
    // A caller cannot even send these — `.strict()` refuses them.
    const smuggled = authorize(plan, { workspace: "foundry_managed", authorizedBy: "someone-else" });
    expect(smuggled.accepted).toBe(false);
    expect(smuggled.reason).toMatch(/do not match the declared shape/);

    expect(authorize(plan).accepted).toBe(true);
    const authorization = persistedPlanFor(plan.planId).authorization;
    expect(authorization?.workspace).toBe(plan.workspace);
    expect(authorization?.riskClass).toBe(plan.riskClass);
    expect(authorization?.planRevision).toBe(planRevision(plan));
    expect(authorization?.authorizedBy).toBe("operator-1");
  });

  it("creates nothing else — permission is not a run", () => {
    const plan = seedReviewedPlan();
    expect(authorize(plan).accepted).toBe(true);
    for (const type of ["buildStages", "tasks", "agentRuns", "artifacts", "transfers"] as const) {
      expect(persistence.listEntities(type)).toHaveLength(0);
    }
  });

  it("emits exactly one event", () => {
    const plan = seedReviewedPlan();
    const before = persistence.getAllEvents().length;
    expect(authorize(plan).accepted).toBe(true);
    expect(persistence.getAllEvents()).toHaveLength(before + 1);
  });

  it("survives a restart as backend truth", () => {
    const plan = seedReviewedPlan();
    expect(authorize(plan).accepted).toBe(true);
    persistence.close();
    const reopened = new PersistenceService(join(dir, "foundry.sqlite"));
    try {
      const authorization = reopened.getEntity<PersistedPlan>("plans", plan.planId)?.authorization;
      expect(authorization?.authorizationId).toBe(executionAuthorizationId(plan.planId));
      expect(authorization?.planContentHash).toBe(planContentHash(plan));
    } finally {
      reopened.close();
      persistence = new PersistenceService(join(dir, "foundry.sqlite"));
    }
  });
});

describe("AC-110 Plan.Authorize — every refusal, with zero mutation (F-114)", () => {
  it.each([
    ["an agent", AGENT],
    ["the backend itself", BACKEND],
    ["an unauthenticated caller", ANON],
  ])("refuses %s — authorizing is a human act (principle 14)", (_label, actor) => {
    const plan = seedReviewedPlan();
    const before = fullSnapshot();
    const outcome = authorize(plan, {}, actor);
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/Authorizing execution requires an authenticated operator/);
    expect(fullSnapshot()).toEqual(before);
  });

  it("refuses an unreviewed plan", () => {
    const plan = seedPlannedBuild();
    const outcome = authorize(plan);
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/has not been reviewed/i);
  });

  it.each(["rejected", "revision_requested"] as const)("refuses a plan reviewed as %s", (d) => {
    const plan = seedPlannedBuild();
    expect(review(plan, d).accepted).toBe(true);
    const outcome = authorize(plan);
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toContain(d);
  });

  it("refuses a stale acknowledged hash — the operator was reading something else", () => {
    const plan = seedReviewedPlan();
    const before = fullSnapshot();
    const outcome = authorize(plan, { acknowledgedContentHash: `${PLAN_CONTENT_HASH_PREFIX}${"0".repeat(64)}` });
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/changed since it was read/i);
    expect(fullSnapshot()).toEqual(before);
  });

  it("refuses a stage the plan runs with the mock — there is no real execution to authorize", () => {
    const plan = seedReviewedPlan();
    const outcome = authorize(plan, { stageName: "scaffold" });
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/no real execution to authorize/i);
    expect(outcome.correctiveAction).toContain(CLAUDE_CODE_STAGE);
  });

  it("refuses a stage that is not in the plan at all", () => {
    const plan = seedReviewedPlan();
    const outcome = authorize(plan, { stageName: "not_a_stage" });
    expect(outcome.accepted).toBe(false);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["over the $25 ceiling", MAX_BUDGET_USD_CEILING + 0.01],
    ["infinite", Number.POSITIVE_INFINITY],
  ])("refuses a %s budget (AC-107 decision 7)", (_label, maxBudgetUsd) => {
    const plan = seedReviewedPlan();
    const outcome = authorize(plan, { maxBudgetUsd });
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/do not match the declared shape/);
  });

  it("refuses an omitted budget — an unbudgeted authorization is unrepresentable", () => {
    const plan = seedReviewedPlan();
    const persisted = persistedPlanFor(plan.planId);
    const outcome = handler.submit(
      {
        commandType: "Plan.Authorize",
        entityId: plan.planId,
        params: {
          planId: plan.planId,
          buildId: plan.buildId,
          stageName: CLAUDE_CODE_STAGE,
          acknowledgedContentHash: persisted.contentHash,
        },
      },
      OPERATOR,
    );
    expect(outcome.accepted).toBe(false);
  });

  it("refuses a second authorization — single-use is not renewable (F-113)", () => {
    const plan = seedReviewedPlan();
    expect(authorize(plan).accepted).toBe(true);

    const before = fullSnapshot();
    const second = authorize(plan, { maxBudgetUsd: 25 });
    expect(second.accepted).toBe(false);
    expect(second.reason).toMatch(/already has execution authorization/i);
    expect(second.reason).toMatch(/single-use and is not reissued/i);
    expect(fullSnapshot()).toEqual(before);
  });

  it("refuses a mismatched buildId", () => {
    const plan = seedReviewedPlan();
    const outcome = authorize(plan, { buildId: "build-somewhere-else" });
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/does not match plan/i);
  });
});

describe("AC-110 the gate — proven in both directions", () => {
  const gate = (plan: BuildPlan, stage: BuildStageName = CLAUDE_CODE_STAGE) =>
    evaluateExecutionGate(readExecutionGateInput(persistence, plan.buildId, stage));

  it("PERMITS exactly when a valid authorization exists — and still starts nothing", () => {
    const plan = seedReviewedPlan();
    expect(authorize(plan).accepted).toBe(true);

    const decision = gate(plan);
    expect(decision.permitted).toBe(true);
    expect(decision.refusals).toEqual([]);
    expect(decision.authorization?.stageName).toBe(CLAUDE_CODE_STAGE);
    // The field exists precisely so `permitted` can never be read as "ran".
    expect(decision.executed).toBe(false);
    expect(persistence.listEntities("agentRuns")).toHaveLength(0);
  });

  it("REFUSES when there is no plan", () => {
    const decision = evaluateExecutionGate(
      readExecutionGateInput(persistence, "build-nothing", CLAUDE_CODE_STAGE),
    );
    expect(decision.permitted).toBe(false);
    expect(decision.refusals.map((r) => r.code)).toContain("no_plan");
  });

  it("REFUSES an unreviewed plan, and says so before mentioning the authorization", () => {
    const plan = seedPlannedBuild();
    const codes = gate(plan).refusals.map((r) => r.code);
    expect(codes[0]).toBe("plan_not_reviewed");
    expect(codes).toContain("no_authorization");
  });

  it("REFUSES a reviewed plan with no authorization — reviewing is not authorizing", () => {
    const plan = seedReviewedPlan();
    const decision = gate(plan);
    expect(decision.permitted).toBe(false);
    expect(decision.refusals.map((r) => r.code)).toEqual(["no_authorization"]);
    expect(decision.refusals[0]?.reason).toMatch(/A reviewed plan is not permission to run/);
  });

  it("REFUSES a stage the authorization does not name", () => {
    const plan = seedReviewedPlan();
    expect(authorize(plan).accepted).toBe(true);
    const decision = gate(plan, "integration");
    expect(decision.permitted).toBe(false);
    expect(decision.refusals.map((r) => r.code)).toContain("stage_not_authorized");
  });

  it("REFUSES once the plan's persisted content no longer hashes to the binding", () => {
    const plan = seedReviewedPlan();
    expect(authorize(plan).accepted).toBe(true);

    // The binding is checked against a hash recomputed from content. Feed
    // the gate a different current hash — exactly what an edited plan would
    // produce — and it must fail closed.
    const input = readExecutionGateInput(persistence, plan.buildId, CLAUDE_CODE_STAGE);
    const decision = evaluateExecutionGate({
      ...input,
      currentContentHash: `${PLAN_CONTENT_HASH_PREFIX}${"a".repeat(64)}`,
    });
    expect(decision.permitted).toBe(false);
    expect(decision.refusals.map((r) => r.code)).toContain("plan_content_hash_mismatch");
    expect(decision.refusals.find((r) => r.code === "plan_content_hash_mismatch")?.reason).toMatch(
      /A modified plan invalidates its authorization/,
    );
  });

  it("REFUSES when the binding cannot be recomputed at all — it fails closed", () => {
    const plan = seedReviewedPlan();
    expect(authorize(plan).accepted).toBe(true);
    const input = readExecutionGateInput(persistence, plan.buildId, CLAUDE_CODE_STAGE);
    const decision = evaluateExecutionGate({ ...input, currentContentHash: null });
    expect(decision.permitted).toBe(false);
    expect(decision.refusals.map((r) => r.code)).toContain("plan_content_hash_mismatch");
  });

  it("REFUSES a spent authorization — one never covers a second run (F-113)", () => {
    const plan = seedReviewedPlan();
    expect(authorize(plan).accepted).toBe(true);
    const input = readExecutionGateInput(persistence, plan.buildId, CLAUDE_CODE_STAGE);
    expect(evaluateExecutionGate(input).permitted).toBe(true);

    const spent = evaluateExecutionGate({ ...input, spentRunIds: ["run-already-happened"] });
    expect(spent.permitted).toBe(false);
    expect(spent.refusals.map((r) => r.code)).toContain("authorization_already_spent");
    expect(spent.refusals[0]?.correctiveAction).toMatch(/never restarted automatically/);
  });

  it("reports every refusal at once rather than stopping at the first", () => {
    const plan = seedPlannedBuild(); // unreviewed, unauthorized
    expect(gate(plan).refusals.length).toBeGreaterThan(1);
  });

  it("writes nothing, whatever it decides", () => {
    const plan = seedReviewedPlan();
    expect(authorize(plan).accepted).toBe(true);
    const before = fullSnapshot();
    gate(plan);
    gate(plan, "integration");
    evaluateExecutionGate(readExecutionGateInput(persistence, "build-nothing", CLAUDE_CODE_STAGE));
    expect(fullSnapshot()).toEqual(before);
  });

  it("has no write primitive in its code (structural, comments stripped)", () => {
    const source = readFileSync(join(import.meta.dirname, "executionGate.ts"), "utf-8");
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(code).not.toContain("appendEvent");
    expect(code).not.toContain("CommandHandler");
    // It reads persistence in the adapter, and only through list/get.
    expect(code).not.toContain("submit(");
  });
});
