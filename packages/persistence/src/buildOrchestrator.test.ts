import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BUILD_STAGE_SEQUENCE,
  COMMAND_TYPES,
  planRevision,
  plannedStageId,
  type BuildPlan,
  type PersistedPlan,
} from "@foundry/contracts";
import { FoundryEventSchema } from "@foundry/event-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  APPROVAL_GATED_STAGE,
  BuildOrchestrator,
  ORCHESTRATED_STAGES,
  defaultOrchestratorActors,
  gateApprovalId,
  planOrchestration,
  stageEntityIds,
  type OrchestratorActors,
} from "./buildOrchestrator";
import { CommandHandler, type CommandActor } from "./commandHandler";
import { ObjectiveIntake } from "./objectiveIntake";
import { PersistenceService } from "./persistenceService";

/**
 * AC-109 — backend orchestration of a build with the mock executor.
 *
 * The properties under test are the rung's whole point: the orchestrator
 * only ever asks `CommandHandler`, stage order is fixed, nothing real
 * executes, and the run stops at the approval gate rather than through it.
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
let actors: OrchestratorActors;

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
      sourceBuildingId: name === "qa_validation" ? "qa" : "construction-office",
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

/** Objective → Project → Build → persisted plan. Returns the plan. */
function seedPlannedBuild(): BuildPlan {
  const intake = new ObjectiveIntake(handler, (kind) => `${kind}-1`);
  const result = intake.submit(
    { objective: OBJECTIVE, workspace: "foundry_managed", riskClass: "R2" },
    OPERATOR,
  );
  const plan = planFor(result.buildId as string, result.projectId as string);
  const planned = handler.submit(
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
  );
  expect(planned.accepted).toBe(true);
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

function persistedPlanFor(plan: BuildPlan): PersistedPlan {
  return persistence.getEntity<PersistedPlan>("plans", plan.planId) as PersistedPlan;
}

/** A reviewed, startable build. */
function seedReviewedBuild(): { plan: BuildPlan; persisted: PersistedPlan } {
  const plan = seedPlannedBuild();
  expect(review(plan, "proceed").accepted).toBe(true);
  return { plan, persisted: persistedPlanFor(plan) };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "foundry-orchestrator-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  handler = new CommandHandler(persistence);
  actors = defaultOrchestratorActors(OPERATOR);
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("AC-109 orchestration program — fixed order, closed vocabulary", () => {
  it("is deterministic: the same plan produces the identical step list", () => {
    const plan = planFor("build-1", "project-1");
    expect(planOrchestration(plan)).toEqual(planOrchestration(plan));
  });

  it("uses only commands from the closed V1 vocabulary", () => {
    const known = new Set<string>(COMMAND_TYPES);
    for (const step of planOrchestration(planFor("build-1", "project-1"))) {
      expect(known.has(step.request.commandType)).toBe(true);
    }
  });

  it("starts the build first, then walks the six stages in the fixed sequence", () => {
    const steps = planOrchestration(planFor("build-1", "project-1"));
    expect(steps[0]?.request.commandType).toBe("Build.Start");

    // The order the stages are *first* touched is the plan's order.
    const order: string[] = [];
    for (const step of steps) {
      if (step.stage && !order.includes(step.stage)) order.push(step.stage);
    }
    expect(order).toEqual([...ORCHESTRATED_STAGES]);
  });

  it("stops before the approval-gated stage and ends by requesting the approval", () => {
    const steps = planOrchestration(planFor("build-1", "project-1"));
    expect(steps.some((step) => step.stage === APPROVAL_GATED_STAGE)).toBe(false);

    const last = steps.at(-1);
    expect(last?.request.commandType).toBe("Approval.Request");
    expect(last?.request.entityId).toBe(gateApprovalId("plan-1"));
  });

  it("creates no transfer, requests no upgrade, and resolves no approval", () => {
    const commandTypes = planOrchestration(planFor("build-1", "project-1")).map(
      (step) => step.request.commandType,
    );
    for (const forbidden of commandTypes) {
      expect(forbidden.startsWith("Transfer.")).toBe(false);
      expect(forbidden.startsWith("Upgrade.")).toBe(false);
    }
    expect(commandTypes).not.toContain("Approval.Approve");
    expect(commandTypes).not.toContain("Approval.Reject");
    expect(commandTypes).not.toContain("Approval.RequestRevision");
    expect(commandTypes).not.toContain("Build.Complete");
  });

  it("runs the claude_code-allocated stage with the mock runtime, and says so", () => {
    const plan = planFor("build-1", "project-1");
    expect(plan.stages.find((s) => s.name === "backend_implementation")?.runtime).toBe(
      "claude_code",
    );

    const runtimes = planOrchestration(plan)
      .filter((step) => step.request.commandType === "AgentRun.Start")
      .map((step) => step.request.params.runtimeType);
    expect(runtimes).toHaveLength(ORCHESTRATED_STAGES.length);
    expect(new Set(runtimes)).toEqual(new Set(["mock"]));
  });

  it("uses the plan's own stage ids, so the reviewed plan and the run are the same list", () => {
    const plan = planFor("build-1", "project-1");
    const created = planOrchestration(plan)
      .filter((step) => step.request.commandType === "BuildStage.Create")
      .map((step) => step.request.entityId);
    expect(created).toEqual(ORCHESTRATED_STAGES.map((name) => plannedStageId(plan.planId, name)));
  });
});

describe("AC-109 orchestrated run — reaches the approval gate through the backend alone", () => {
  it("advances six stages, requests the approval, and stops (F-110)", async () => {
    const { plan, persisted } = seedReviewedBuild();
    const result = await new BuildOrchestrator(handler).run(persisted, actors);

    expect(result.status).toBe("reached_approval_gate");
    expect(result.refusedAt).toBeUndefined();
    expect(result.simulated).toBe(true);
    expect(result.executor).toBe("mock");
    expect(result.results.every((entry) => entry.outcome.accepted)).toBe(true);

    // The build reached the state F-110 names.
    const build = persistence.getEntity<{ status: string }>("builds", plan.buildId);
    expect(build?.status).toBe("waiting_for_approval");

    // Six stages, all completed, and no seventh.
    const stages = persistence.listEntities<{ id: string; name: string; status: string }>(
      "buildStages",
    );
    expect(stages).toHaveLength(ORCHESTRATED_STAGES.length);
    expect(stages.map((stage) => stage.name)).toEqual([...ORCHESTRATED_STAGES]);
    expect(stages.every((stage) => stage.status === "completed")).toBe(true);
    expect(stages.some((stage) => stage.name === APPROVAL_GATED_STAGE)).toBe(false);

    // One pending approval, unresolved.
    const approvals = persistence.listEntities<{ id: string; status: string }>("approvals");
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.status).toBe("pending");
    expect(approvals[0]?.id).toBe(gateApprovalId(plan.planId));
  });

  it("nothing real executed: every run is mock, and no transfer or upgrade exists", async () => {
    const { persisted } = seedReviewedBuild();
    await new BuildOrchestrator(handler).run(persisted, actors);

    const runs = persistence.listEntities<{ runtimeType: string; status: string }>("agentRuns");
    expect(runs).toHaveLength(ORCHESTRATED_STAGES.length);
    expect(runs.every((run) => run.runtimeType === "mock")).toBe(true);
    expect(runs.some((run) => run.runtimeType === "claude_code")).toBe(false);

    expect(persistence.listEntities("transfers")).toHaveLength(0);
    expect(persistence.listEntities("upgrades")).toHaveLength(0);
    expect(persistence.listEntities("revisions")).toHaveLength(0);
  });

  it("emits stage.started events in the plan's order, and one per stage", async () => {
    const { plan, persisted } = seedReviewedBuild();
    await new BuildOrchestrator(handler).run(persisted, actors);

    const started = persistence
      .getAllEvents()
      .filter((event) => event.type === "stage.started")
      .map((event) => event.entityId);
    expect(started).toEqual(ORCHESTRATED_STAGES.map((name) => plannedStageId(plan.planId, name)));
  });

  it("every event it produced is schema-valid and carries a declared type", async () => {
    const { persisted } = seedReviewedBuild();
    await new BuildOrchestrator(handler).run(persisted, actors);
    for (const event of persistence.getAllEvents()) {
      expect(FoundryEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it("survives a restart: the projection replays to the same truth (F-122 direction)", async () => {
    const { plan, persisted } = seedReviewedBuild();
    await new BuildOrchestrator(handler).run(persisted, actors);
    const before = persistence.getWorldStateSnapshot();

    persistence.close();
    const reopened = new PersistenceService(join(dir, "foundry.sqlite"));
    try {
      expect(reopened.getWorldStateSnapshot()).toEqual(before);
      expect(reopened.getEntity<{ status: string }>("builds", plan.buildId)?.status).toBe(
        "waiting_for_approval",
      );
      expect(reopened.listEntities("buildStages")).toHaveLength(ORCHESTRATED_STAGES.length);
    } finally {
      reopened.close();
      persistence = new PersistenceService(join(dir, "foundry.sqlite"));
    }
  });
});

describe("AC-109 refusals — every illegal start is rejected with its own reason (F-112)", () => {
  it("refuses a build with no plan", () => {
    const intake = new ObjectiveIntake(handler, (kind) => `${kind}-1`);
    const created = intake.submit(
      { objective: OBJECTIVE, workspace: "foundry_managed", riskClass: "R2" },
      OPERATOR,
    );
    const outcome = handler.submit(
      { commandType: "Build.Start", entityId: created.buildId as string, params: {} },
      OPERATOR,
    );
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/has no plan/i);
  });

  it("refuses an unreviewed plan", () => {
    const plan = seedPlannedBuild();
    const outcome = handler.submit(
      { commandType: "Build.Start", entityId: plan.buildId, params: {} },
      OPERATOR,
    );
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/has not been reviewed/i);
  });

  it.each(["rejected", "revision_requested"] as const)("refuses a plan reviewed as %s", (decision) => {
    const plan = seedPlannedBuild();
    expect(review(plan, decision).accepted).toBe(true);
    const outcome = handler.submit(
      { commandType: "Build.Start", entityId: plan.buildId, params: {} },
      OPERATOR,
    );
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toContain(decision);
  });

  it("refuses a plan that changed after it was reviewed", () => {
    const plan = seedPlannedBuild();

    // Constructed directly rather than through the handler: the handler
    // writes `planRevision` from persisted state, so a stale review is
    // unreachable through the command surface. Appending the event is how
    // the state under test is reached, not how the product produces it.
    persistence.appendEvent(
      FoundryEventSchema.parse({
        id: "stale-review-1",
        type: "operator.plan_reviewed",
        occurredAt: "2026-08-03T00:00:01.000Z",
        actorType: "operator",
        actorId: "operator-1",
        entityType: "Plan",
        entityId: plan.planId,
        correlationId: plan.planId,
        severity: "info",
        schemaVersion: 1,
        payload: {
          planId: plan.planId,
          buildId: plan.buildId,
          decision: "proceed",
          reviewedBy: "operator-1",
          planRevision: "rev-deadbeefdeadbeef",
        },
      }),
    );

    const outcome = handler.submit(
      { commandType: "Build.Start", entityId: plan.buildId, params: {} },
      OPERATOR,
    );
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/changed after it was reviewed/i);
  });

  it("refuses a duplicate start, and the second run advances nothing", async () => {
    const { persisted } = seedReviewedBuild();
    const orchestrator = new BuildOrchestrator(handler);
    await orchestrator.run(persisted, actors);

    const eventsAfterFirst = persistence.getAllEvents().length;
    const second = await orchestrator.run(persisted, actors);

    expect(second.status).toBe("not_startable");
    expect(second.refusedAt?.commandType).toBe("Build.Start");
    expect(second.refusedAt?.reason).toMatch(/not planned|already/i);
    expect(persistence.getAllEvents()).toHaveLength(eventsAfterFirst);
  });

  it.each([
    ["an agent", AGENT],
    ["an unauthenticated caller", ANON],
  ])("refuses a start from %s (principle 14)", (_label, actor) => {
    const { plan } = seedReviewedBuild();
    const outcome = handler.submit(
      { commandType: "Build.Start", entityId: plan.buildId, params: {} },
      actor,
    );
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/Starting a build requires an authenticated operator/);
  });

  it("a refused start writes nothing at all", () => {
    const plan = seedPlannedBuild(); // unreviewed
    const before = {
      events: persistence.getAllEvents(),
      world: persistence.getWorldStateSnapshot(),
    };
    expect(
      handler.submit({ commandType: "Build.Start", entityId: plan.buildId, params: {} }, OPERATOR)
        .accepted,
    ).toBe(false);
    expect({
      events: persistence.getAllEvents(),
      world: persistence.getWorldStateSnapshot(),
    }).toEqual(before);
  });

  it("stops at the first refused step rather than routing around it", async () => {
    const { plan, persisted } = seedReviewedBuild();

    // Start the build out from under the orchestrator, then hand it a run
    // whose second step (`BuildStage.Create`) is fine but whose first is
    // not. The refusal is reported; nothing later is attempted.
    expect(
      handler.submit({ commandType: "Build.Start", entityId: plan.buildId, params: {} }, OPERATOR)
        .accepted,
    ).toBe(true);
    const eventsAfterStart = persistence.getAllEvents().length;

    const result = await new BuildOrchestrator(handler).run(persisted, actors);
    expect(result.status).toBe("not_startable");
    expect(result.results).toHaveLength(1);
    expect(persistence.getAllEvents()).toHaveLength(eventsAfterStart);
  });
});

describe("AC-109 independence — the orchestrator cannot self-certify (F-05, F-118 direction)", () => {
  it("refuses the validation when it is submitted by the backend rather than the Inspector", async () => {
    const { plan, persisted } = seedReviewedBuild();
    await new BuildOrchestrator(handler).run(persisted, actors);

    const qa = stageEntityIds(plan.planId, "qa_validation");
    const outcome = handler.submit(
      {
        commandType: "BuildStage.Validate",
        entityId: qa.stageId,
        params: { outcome: "passed", evidenceIds: [], passedRequirementIds: [] },
      },
      { actorType: "backend", actorId: "backend", authenticated: true },
    );
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/independent Inspector-role agent/);
  });

  it("refuses an Inspector validating evidence the Inspector itself produced", () => {
    const { plan } = seedReviewedBuild();
    const qa = stageEntityIds(plan.planId, "qa_validation");
    const inspector: CommandActor = {
      actorType: "agent",
      actorId: "agent-inspector",
      authenticated: true,
    };

    // A stage, running, with an artifact the Inspector created itself.
    expect(
      handler.submit({ commandType: "Build.Start", entityId: plan.buildId, params: {} }, OPERATOR)
        .accepted,
    ).toBe(true);
    expect(
      handler.submit({ commandType: "BuildStage.Create", entityId: qa.stageId, params: {} }, actors.backend)
        .accepted,
    ).toBe(true);
    expect(
      handler.submit(
        {
          commandType: "BuildStage.Start",
          entityId: qa.stageId,
          params: { assignedAgentIds: ["agent-inspector"], sourceBuildingId: "qa" },
        },
        actors.backend,
      ).accepted,
    ).toBe(true);
    expect(
      handler.submit(
        {
          commandType: "Artifact.Create",
          entityId: qa.artifactId,
          params: {
            artifactId: qa.artifactId,
            artifactType: "test_report",
            name: "Self-authored report",
            checksumStatus: "pending",
          },
        },
        inspector,
      ).accepted,
    ).toBe(true);

    const outcome = handler.submit(
      {
        commandType: "BuildStage.Validate",
        entityId: qa.stageId,
        params: { outcome: "passed", evidenceIds: [qa.artifactId], passedRequirementIds: [] },
      },
      inspector,
    );
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/independent Inspector-role agent/);
  });
});

describe("AC-109 structural — the orchestrator has no second write path (F-111)", () => {
  it("works when given a CommandHandler and nothing else", async () => {
    // The constructor takes no PersistenceService, so the orchestrator has
    // no `appendEvent`, no reducer, and no database handle to reach for.
    // Asserted the way it is enforced: by what is reachable.
    const { persisted } = seedReviewedBuild();
    const isolated = new BuildOrchestrator(new CommandHandler(persistence));
    const result = await isolated.run(persisted, actors);
    expect(result.status).toBe("reached_approval_gate");
  });

  it("writes nothing at all when its CommandHandler refuses everything", async () => {
    const { persisted } = seedReviewedBuild();
    const refusing = {
      submit: () => ({
        accepted: false as const,
        commandType: "Build.Start" as const,
        reason: "refused",
      }),
    } as unknown as CommandHandler;

    const before = {
      events: persistence.getAllEvents(),
      world: persistence.getWorldStateSnapshot(),
    };
    const result = await new BuildOrchestrator(refusing).run(persisted, actors);
    expect(result.status).toBe("not_startable");
    expect({
      events: persistence.getAllEvents(),
      world: persistence.getWorldStateSnapshot(),
    }).toEqual(before);
  });

  it("names no write primitive anywhere in its code (F-111, asserted literally)", () => {
    const source = readFileSync(join(import.meta.dirname, "buildOrchestrator.ts"), "utf-8");

    // Comments are stripped first, and that is not a loophole — it is the
    // difference between the assertion being about the code and being
    // about the prose. The module comment *documents* that there is no
    // `appendEvent` path, which would otherwise trip a naive text search
    // and make the test pass or fail on how the file is described rather
    // than on what it does.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

    // F-111 asks for this assertion by name. The reachability tests above
    // are the stronger proof; this one is the tripwire that fails loudly
    // the moment someone reaches for a shortcut.
    for (const forbidden of [
      "appendEvent",
      "PersistenceService",
      "persistenceService",
      "reduceEntities",
      "better-sqlite3",
      "node:sqlite",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });
});
