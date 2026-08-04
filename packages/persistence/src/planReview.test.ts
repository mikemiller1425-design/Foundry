import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILD_STAGE_SEQUENCE, planRevision, type BuildPlan } from "@foundry/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandHandler, type CommandActor } from "./commandHandler";
import { ObjectiveIntake } from "./objectiveIntake";
import { PersistenceService } from "./persistenceService";

/**
 * AC-108 — a plan becomes backend truth, and the operator's review of it
 * is a recorded governance act that authorizes nothing.
 */

const OPERATOR: CommandActor = {
  actorType: "operator",
  actorId: "operator-1",
  authenticated: true,
};
const AGENT: CommandActor = { actorType: "agent", actorId: "agent-builder", authenticated: true };
const ANON: CommandActor = { actorType: "frontend", actorId: "anonymous", authenticated: false };

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
    createdAt: "2026-08-03T00:00:00.000Z",
    stages: BUILD_STAGE_SEQUENCE.map((name, i) => ({
      name,
      sequence: i + 1,
      sourceBuildingId: "construction-office",
      destinationBuildingId: "construction-office",
      runtime: name === "backend_implementation" ? ("claude_code" as const) : ("mock" as const),
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

function planParams(plan: BuildPlan) {
  return {
    planId: plan.planId,
    planArtifactId: plan.planId,
    stageIds: BUILD_STAGE_SEQUENCE.map((n) => `${plan.planId}--${n}`),
    requirementCount: 7,
    plan,
  };
}

/** Submits an objective, returning the created ids. */
function submitObjective() {
  const intake = new ObjectiveIntake(handler, (kind) => `${kind}-1`);
  const result = intake.submit(
    { objective: OBJECTIVE, workspace: "foundry_managed", riskClass: "R2" },
    OPERATOR,
  );
  return { projectId: result.projectId!, buildId: result.buildId! };
}

function fullSnapshot() {
  return { events: persistence.getAllEvents(), worldState: persistence.getWorldStateSnapshot() };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "foundry-plan-review-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  handler = new CommandHandler(persistence);
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("Build.Plan — persisting a plan", () => {
  it("persists a schema-valid plan against the active build", () => {
    const { projectId, buildId } = submitObjective();
    const plan = planFor(buildId, projectId);
    const outcome = handler.submit(
      { commandType: "Build.Plan", entityId: buildId, params: planParams(plan) },
      OPERATOR,
    );
    expect(outcome.accepted).toBe(true);
    expect(persistence.getEntity("plans", "plan-1")).toMatchObject({
      revision: planRevision(plan),
      review: null,
    });
  });

  it("produces exactly one event per command", () => {
    const { projectId, buildId } = submitObjective();
    const before = persistence.getAllEvents().length;
    handler.submit(
      {
        commandType: "Build.Plan",
        entityId: buildId,
        params: planParams(planFor(buildId, projectId)),
      },
      OPERATOR,
    );
    expect(persistence.getAllEvents().length).toBe(before + 1);
    expect(persistence.getAllEvents().at(-1)?.type).toBe("build.planned");
  });

  it("schedules nothing — no stage, task, agent run, artifact, or approval", () => {
    const { projectId, buildId } = submitObjective();
    handler.submit(
      {
        commandType: "Build.Plan",
        entityId: buildId,
        params: planParams(planFor(buildId, projectId)),
      },
      OPERATOR,
    );
    for (const type of ["buildStages", "tasks", "agentRuns", "artifacts", "approvals"] as const) {
      expect(persistence.listEntities(type), type).toEqual([]);
    }
  });

  it("surfaces the plan in the WorldState projection the frontend reads", () => {
    const { projectId, buildId } = submitObjective();
    handler.submit(
      {
        commandType: "Build.Plan",
        entityId: buildId,
        params: planParams(planFor(buildId, projectId)),
      },
      OPERATOR,
    );
    const snapshot = persistence.getWorldStateSnapshot();
    expect(snapshot.currentPlan?.plan.planId).toBe("plan-1");
    expect(snapshot.currentPlan?.review).toBeNull();
  });

  it("survives a full replay — the plan is event-sourced, not in-memory", () => {
    const { projectId, buildId } = submitObjective();
    handler.submit(
      {
        commandType: "Build.Plan",
        entityId: buildId,
        params: planParams(planFor(buildId, projectId)),
      },
      OPERATOR,
    );
    const before = persistence.getWorldStateSnapshot();
    const dbPath = join(dir, "foundry.sqlite");
    persistence.close();
    persistence = new PersistenceService(dbPath);
    expect(persistence.getWorldStateSnapshot().currentPlan).toEqual(before.currentPlan);
  });
});

describe("Build.Plan — refusals are specific and mutate nothing", () => {
  it.each([
    [
      "a plan for a different build",
      (b: string, p: string) => planParams({ ...planFor(b, p), buildId: "other-build" }),
      /does not match entityId/i,
    ],
    [
      "a plan whose objective is not the build's",
      (b: string, p: string) =>
        planParams({ ...planFor(b, p), objective: "A different objective" }),
      /objectiveSnapshot/i,
    ],
    [
      "a plan with an invented stage",
      (b: string, p: string) => {
        const plan = planFor(b, p);
        (plan.stages[0] as { name: string }).name = "deploy_to_production";
        return planParams(plan);
      },
      /declared shape/i,
    ],
    [
      "a plan allocating Claude Code to the wrong stage",
      (b: string, p: string) => {
        const plan = planFor(b, p);
        plan.stages[1]!.runtime = "claude_code";
        return planParams(plan);
      },
      /declared shape/i,
    ],
  ])("refuses %s", (_label, makeParams, pattern) => {
    const { projectId, buildId } = submitObjective();
    const before = fullSnapshot();
    const outcome = handler.submit(
      { commandType: "Build.Plan", entityId: buildId, params: makeParams(buildId, projectId) },
      OPERATOR,
    );
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(pattern);
    expect(fullSnapshot()).toEqual(before);
  });

  it("refuses a plan for a build that does not exist", () => {
    const before = fullSnapshot();
    const outcome = handler.submit(
      {
        commandType: "Build.Plan",
        entityId: "no-such-build",
        params: planParams(planFor("no-such-build", "project-1")),
      },
      OPERATOR,
    );
    expect(outcome.accepted).toBe(false);
    expect(fullSnapshot()).toEqual(before);
  });

  it("refuses a second plan for the same build", () => {
    const { projectId, buildId } = submitObjective();
    handler.submit(
      {
        commandType: "Build.Plan",
        entityId: buildId,
        params: planParams(planFor(buildId, projectId)),
      },
      OPERATOR,
    );
    const before = fullSnapshot();
    const outcome = handler.submit(
      {
        commandType: "Build.Plan",
        entityId: buildId,
        params: planParams(planFor(buildId, projectId, "plan-2")),
      },
      OPERATOR,
    );
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/already has plan/i);
    expect(fullSnapshot()).toEqual(before);
  });
});

describe("Plan.Review — the operator's recorded decision", () => {
  function seedPlan() {
    const { projectId, buildId } = submitObjective();
    const plan = planFor(buildId, projectId);
    handler.submit(
      { commandType: "Build.Plan", entityId: buildId, params: planParams(plan) },
      OPERATOR,
    );
    return { plan, buildId, revision: planRevision(plan) };
  }

  function review(
    plan: BuildPlan,
    buildId: string,
    revision: string,
    decision: "proceed" | "rejected" | "revision_requested" = "proceed",
    actor: CommandActor = OPERATOR,
  ) {
    return handler.submit(
      {
        commandType: "Plan.Review",
        entityId: plan.planId,
        params: { planId: plan.planId, buildId, reviewedRevision: revision, decision },
      },
      actor,
    );
  }

  it("records the decision against the plan", () => {
    const { plan, buildId, revision } = seedPlan();
    expect(review(plan, buildId, revision).accepted).toBe(true);
    expect(persistence.getEntity("plans", plan.planId)).toMatchObject({
      review: { decision: "proceed", reviewedBy: "operator-1", reviewedRevision: revision },
    });
  });

  it("writes reviewedBy from the credential, never from the payload", () => {
    const { plan, buildId, revision } = seedPlan();
    handler.submit(
      {
        commandType: "Plan.Review",
        entityId: plan.planId,
        params: {
          planId: plan.planId,
          buildId,
          reviewedRevision: revision,
          decision: "proceed",
        },
      },
      { actorType: "operator", actorId: "operator-9", authenticated: true },
    );
    expect(
      (persistence.getEntity("plans", plan.planId) as { review: { reviewedBy: string } }).review
        .reviewedBy,
    ).toBe("operator-9");
  });

  it("authorizes nothing — proceed creates no stage, run, or artifact", () => {
    const { plan, buildId, revision } = seedPlan();
    review(plan, buildId, revision, "proceed");
    for (const type of ["buildStages", "tasks", "agentRuns", "artifacts", "approvals"] as const) {
      expect(persistence.listEntities(type), type).toEqual([]);
    }
  });

  it("refuses an agent and an anonymous caller, with zero mutation", () => {
    const { plan, buildId, revision } = seedPlan();
    for (const actor of [AGENT, ANON]) {
      const before = fullSnapshot();
      const outcome = review(plan, buildId, revision, "proceed", actor);
      expect(outcome.accepted).toBe(false);
      expect(outcome.reason).toMatch(/authenticated operator/i);
      expect(fullSnapshot()).toEqual(before);
    }
  });

  it("refuses a review of a plan that does not exist", () => {
    const { buildId } = seedPlan();
    const outcome = handler.submit(
      {
        commandType: "Plan.Review",
        entityId: "plan-missing",
        params: {
          planId: "plan-missing",
          buildId,
          reviewedRevision: "rev-x",
          decision: "proceed",
        },
      },
      OPERATOR,
    );
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/No Plan with id/i);
  });

  it("refuses a stale revision — a decision about a plan that changed", () => {
    const { plan, buildId } = seedPlan();
    const before = fullSnapshot();
    const outcome = review(plan, buildId, "rev-stale");
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/changed since it was read/i);
    expect(fullSnapshot()).toEqual(before);
  });

  it("is idempotent for a repeated identical decision", () => {
    const { plan, buildId, revision } = seedPlan();
    review(plan, buildId, revision, "proceed");
    const count = persistence.getAllEvents().length;
    const second = review(plan, buildId, revision, "proceed");
    expect(second.accepted).toBe(true);
    expect(second.reason).toMatch(/idempotent no-op/i);
    expect(persistence.getAllEvents().length).toBe(count);
  });

  it("refuses a conflicting second decision", () => {
    const { plan, buildId, revision } = seedPlan();
    review(plan, buildId, revision, "proceed");
    const before = fullSnapshot();
    const outcome = review(plan, buildId, revision, "rejected");
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/already reviewed/i);
    expect(fullSnapshot()).toEqual(before);
  });

  it("survives replay — the review is event-sourced", () => {
    const { plan, buildId, revision } = seedPlan();
    review(plan, buildId, revision, "revision_requested");
    const dbPath = join(dir, "foundry.sqlite");
    const before = persistence.getWorldStateSnapshot().currentPlan;
    persistence.close();
    persistence = new PersistenceService(dbPath);
    expect(persistence.getWorldStateSnapshot().currentPlan).toEqual(before);
    expect(persistence.getWorldStateSnapshot().currentPlan?.review?.decision).toBe(
      "revision_requested",
    );
  });
});

/**
 * Regressions for two defects live verification caught at AC-108.
 */
describe("AC-108 — defects found by live verification", () => {
  it("reports the plan's own id, not the build id it was addressed to", () => {
    // `Build.Plan` is addressed to the *build*, so returning the command's
    // `entityId` handed the caller a build id labelled as a plan id.
    const intake = new ObjectiveIntake(
      handler,
      (kind) => `${kind}-1`,
      ({ planId, projectId, buildId }) => {
        const plan = planFor(buildId, projectId, planId);
        return {
          plan,
          stageIds: BUILD_STAGE_SEQUENCE.map((n) => `${planId}--${n}`),
          requirementCount: 7,
        };
      },
    );
    const result = intake.submit(
      { objective: OBJECTIVE, workspace: "foundry_managed", riskClass: "R2" },
      OPERATOR,
    );
    expect(result.accepted).toBe(true);
    expect(result.planId).toBe("plan-1");
    expect(result.planId).not.toBe(result.buildId);
    expect(persistence.getEntity("plans", result.planId!)).toBeTruthy();
  });

  it("names the actual act in an operator-authorization refusal", () => {
    // A plan reviewer told "resolving an approval requires…" would go
    // looking for an approval that does not exist.
    const { projectId, buildId } = submitObjective();
    const plan = planFor(buildId, projectId);
    handler.submit(
      { commandType: "Build.Plan", entityId: buildId, params: planParams(plan) },
      OPERATOR,
    );
    const outcome = handler.submit(
      {
        commandType: "Plan.Review",
        entityId: plan.planId,
        params: {
          planId: plan.planId,
          buildId,
          reviewedRevision: planRevision(plan),
          decision: "proceed",
        },
      },
      AGENT,
    );
    expect(outcome.reason).toMatch(/Reviewing a plan requires an authenticated operator/i);
    expect(outcome.reason).not.toMatch(/approval/i);
  });

  it("still names approvals correctly for approval commands", () => {
    const outcome = handler.submit(
      { commandType: "Approval.Approve", entityId: "approval-1", params: {} },
      AGENT,
    );
    expect(outcome.reason).toMatch(/Resolving an approval requires an authenticated operator/i);
  });
});
