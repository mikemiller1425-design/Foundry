import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FoundryEvent } from "@foundry/event-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandHandler, type CommandActor } from "./commandHandler";
import { PersistenceService } from "./persistenceService";

const OPERATOR: CommandActor = {
  actorType: "operator",
  actorId: "operator-1",
  authenticated: true,
};
const INSPECTOR: CommandActor = {
  actorType: "agent",
  actorId: "agent-inspector",
  authenticated: true,
};
const BUILDER: CommandActor = { actorType: "agent", actorId: "agent-builder", authenticated: true };

let dir: string;
let persistence: PersistenceService;
let handler: CommandHandler;

function seedEvent(overrides: Partial<FoundryEvent>): FoundryEvent {
  return {
    id: overrides.id ?? "seed-1",
    type: "system.started",
    occurredAt: "2026-07-30T00:00:00.000Z",
    actorType: "backend",
    actorId: "backend",
    entityType: "System",
    entityId: "neighborhood-1",
    correlationId: "corr-1",
    severity: "info",
    schemaVersion: 1,
    payload: { serviceVersion: "1.0.0", neighborhoodId: "neighborhood-1" },
    ...overrides,
  } as FoundryEvent;
}

function fullSnapshot() {
  return {
    events: persistence.getAllEvents(),
    worldState: persistence.getWorldStateSnapshot(),
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "foundry-command-handler-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  handler = new CommandHandler(persistence);
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

function seedProjectAndBuild() {
  persistence.appendEvent(
    seedEvent({
      id: "evt-objective",
      type: "operator.objective_submitted",
      entityType: "Project",
      entityId: "project-1",
      payload: { objective: "Build a thing", projectId: "project-1" },
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: "evt-build-created",
      type: "build.created",
      entityType: "Build",
      entityId: "build-1",
      payload: { projectId: "project-1", buildId: "build-1", objective: "Build a thing" },
    }),
  );
}

describe("CommandHandler — generic deny-by-default fallback", () => {
  it("denies commands with no backing V1 event (Task/Vehicle/system-only) and mutates nothing", () => {
    for (const commandType of ["Task.Queue", "Vehicle.Assign", "Building.ChangeState"] as const) {
      const before = fullSnapshot();
      const outcome = handler.submit({ commandType, params: {} }, OPERATOR);
      expect(outcome.accepted).toBe(false);
      expect(typeof outcome.reason).toBe("string");
      expect(fullSnapshot()).toEqual(before);
    }
  });
});

describe("CommandHandler — Agent", () => {
  it("allows Agent.Assign from idle and rejects a second Assign before the agent returns to idle", () => {
    const first = handler.submit(
      {
        commandType: "Agent.Assign",
        entityId: "agent-architect",
        params: {
          taskId: "task-1",
          stageId: "stage-1",
          destinationBuildingId: "construction-office",
        },
      },
      OPERATOR,
    );
    expect(first.accepted).toBe(true);
    expect(persistence.getAgent("agent-architect")?.status).toBe("assigned");

    const before = fullSnapshot();
    const second = handler.submit(
      {
        commandType: "Agent.Assign",
        entityId: "agent-architect",
        params: {
          taskId: "task-2",
          stageId: "stage-1",
          destinationBuildingId: "construction-office",
        },
      },
      OPERATOR,
    );
    expect(second.accepted).toBe(false);
    expect(fullSnapshot()).toEqual(before);
  });

  it("rejects Agent.Depart on an agent that was never assigned, with zero mutation", () => {
    const before = fullSnapshot();
    const outcome = handler.submit(
      {
        commandType: "Agent.Depart",
        entityId: "agent-builder",
        params: { sourceBuildingId: "home-builder", destinationBuildingId: "construction-office" },
      },
      OPERATOR,
    );
    expect(outcome.accepted).toBe(false);
    expect(fullSnapshot()).toEqual(before);
  });
});

describe("CommandHandler — BuildStage / F-04 mandatory requirements", () => {
  it("blocks BuildStage.Complete while a mandatory requirement has not passed, then allows it once passed", () => {
    seedProjectAndBuild();
    persistence.appendEvent(
      seedEvent({
        id: "evt-stage-created",
        type: "stage.created",
        entityType: "BuildStage",
        entityId: "stage-1",
        payload: {},
      }),
    );
    persistence.appendEvent(
      seedEvent({
        id: "evt-stage-started",
        type: "stage.started",
        entityType: "BuildStage",
        entityId: "stage-1",
        payload: { assignedAgentIds: [], sourceBuildingId: "construction-office" },
      }),
    );
    persistence.appendEvent(
      seedEvent({
        id: "evt-req-started",
        type: "requirement.started",
        entityType: "Requirement",
        entityId: "req-1",
        payload: {},
      }),
    );

    const before = fullSnapshot();
    const blocked = handler.submit(
      { commandType: "BuildStage.Complete", entityId: "stage-1", params: {} },
      OPERATOR,
    );
    expect(blocked.accepted).toBe(false);
    expect(blocked.reason).toMatch(/F-04/);
    expect(fullSnapshot()).toEqual(before);

    const passed = handler.submit(
      {
        commandType: "Requirement.Pass",
        entityId: "req-1",
        params: { evidenceIds: [], validatorType: "test" },
      },
      OPERATOR,
    );
    expect(passed.accepted).toBe(true);

    const completed = handler.submit(
      { commandType: "BuildStage.Complete", entityId: "stage-1", params: { artifactIds: [] } },
      OPERATOR,
    );
    expect(completed.accepted).toBe(true);
    expect(persistence.getEntity("buildStages", "stage-1")).toMatchObject({ status: "completed" });
  });
});

describe("CommandHandler — F-05 Builder self-certification rejected", () => {
  it("rejects BuildStage.Validate(outcome: passed) from a Builder and accepts it from the Inspector", () => {
    seedProjectAndBuild();
    persistence.appendEvent(
      seedEvent({
        id: "evt-stage-created",
        type: "stage.created",
        entityType: "BuildStage",
        entityId: "stage-qa",
        payload: {},
      }),
    );
    persistence.appendEvent(
      seedEvent({
        id: "evt-stage-started",
        type: "stage.started",
        entityType: "BuildStage",
        entityId: "stage-qa",
        payload: { assignedAgentIds: ["agent-inspector"], sourceBuildingId: "qa" },
      }),
    );
    persistence.appendEvent(
      seedEvent({
        id: "evt-validation-started",
        type: "stage.validation_started",
        entityType: "BuildStage",
        entityId: "stage-qa",
        payload: {},
      }),
    );

    const before = fullSnapshot();
    const byBuilder = handler.submit(
      { commandType: "BuildStage.Validate", entityId: "stage-qa", params: { outcome: "passed" } },
      BUILDER,
    );
    expect(byBuilder.accepted).toBe(false);
    expect(byBuilder.reason).toMatch(/F-05/);
    expect(fullSnapshot()).toEqual(before);

    const byInspector = handler.submit(
      {
        commandType: "BuildStage.Validate",
        entityId: "stage-qa",
        params: { outcome: "passed", evidenceIds: [], passedRequirementIds: [] },
      },
      INSPECTOR,
    );
    expect(byInspector.accepted).toBe(true);
    expect(byInspector.event?.type).toBe("stage.validation_passed");
  });
});

describe("CommandHandler — invariant 8: completed stage cannot silently return to running", () => {
  it("rejects reopening a completed stage without a Revision, and allows it once a Revision is in_progress", () => {
    seedProjectAndBuild();
    persistence.appendEvent(
      seedEvent({
        id: "evt-sc",
        type: "stage.created",
        entityType: "BuildStage",
        entityId: "stage-1",
        payload: {},
      }),
    );
    persistence.appendEvent(
      seedEvent({
        id: "evt-ss",
        type: "stage.started",
        entityType: "BuildStage",
        entityId: "stage-1",
        payload: { assignedAgentIds: [], sourceBuildingId: "construction-office" },
      }),
    );
    persistence.appendEvent(
      seedEvent({
        id: "evt-scomp",
        type: "stage.completed",
        entityType: "BuildStage",
        entityId: "stage-1",
        payload: { artifactIds: [], completedAt: "2026-07-30T00:05:00.000Z" },
      }),
    );
    expect(persistence.getEntity("buildStages", "stage-1")).toMatchObject({ status: "completed" });

    const before = fullSnapshot();
    const illegalReopen = handler.submit(
      {
        commandType: "BuildStage.Start",
        entityId: "stage-1",
        params: { assignedAgentIds: [], sourceBuildingId: "construction-office" },
      },
      OPERATOR,
    );
    expect(illegalReopen.accepted).toBe(false);
    expect(fullSnapshot()).toEqual(before);

    const revisionRequest = handler.submit(
      {
        commandType: "BuildStage.RequestRevision",
        entityId: "revision-1",
        params: {
          revisionId: "revision-1",
          stageId: "stage-1",
          reason: "Found a defect",
          requestedBy: "inspector",
        },
      },
      INSPECTOR,
    );
    expect(revisionRequest.accepted).toBe(true);

    const revisionStart = handler.submit(
      {
        commandType: "Revision.Start",
        entityId: "revision-1",
        params: { revisionId: "revision-1" },
      },
      OPERATOR,
    );
    expect(revisionStart.accepted).toBe(true);

    const legalReopen = handler.submit(
      {
        commandType: "BuildStage.Start",
        entityId: "stage-1",
        params: { assignedAgentIds: [], sourceBuildingId: "construction-office" },
      },
      OPERATOR,
    );
    expect(legalReopen.accepted).toBe(true);
    expect(persistence.getEntity("buildStages", "stage-1")).toMatchObject({ status: "running" });
  });
});

describe("CommandHandler — idempotency (F-09)", () => {
  it("a second identical successful command is naturally rejected by the transition graph, not silently duplicated", () => {
    const first = handler.submit(
      {
        commandType: "Agent.Assign",
        entityId: "agent-architect",
        params: {
          taskId: "task-1",
          stageId: "stage-1",
          destinationBuildingId: "construction-office",
        },
      },
      OPERATOR,
    );
    expect(first.accepted).toBe(true);
    const eventCountAfterFirst = persistence.getAllEvents().length;

    const second = handler.submit(
      {
        commandType: "Agent.Assign",
        entityId: "agent-architect",
        params: {
          taskId: "task-1",
          stageId: "stage-1",
          destinationBuildingId: "construction-office",
        },
      },
      OPERATOR,
    );
    expect(second.accepted).toBe(false);
    expect(persistence.getAllEvents().length).toBe(eventCountAfterFirst);
  });
});

describe("CommandHandler — one allowed and one prohibited transition per remaining entity", () => {
  it("Project: Create is allowed once, prohibited again for the same id", () => {
    const first = handler.submit(
      {
        commandType: "Project.Create",
        entityId: "project-1",
        params: { objective: "Build a thing", projectId: "project-1" },
      },
      OPERATOR,
    );
    expect(first.accepted).toBe(true);
    const second = handler.submit(
      {
        commandType: "Project.Create",
        entityId: "project-1",
        params: { objective: "Build a thing again", projectId: "project-1" },
      },
      OPERATOR,
    );
    expect(second.accepted).toBe(false);
  });

  describe("Project.Create — the objective must be bounded (AC-103)", () => {
    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["below the length floor", "too short"],
      ["over-long", "x".repeat(501)],
      ["multi-line", "line one\nline two"],
    ])("rejects a %s objective with zero mutation", (_label, objective) => {
      const before = fullSnapshot();
      const outcome = handler.submit(
        { commandType: "Project.Create", entityId: "project-1", params: { objective } },
        OPERATOR,
      );
      expect(outcome.accepted).toBe(false);
      expect(outcome.reason).toMatch(/bounded objective/i);
      expect(fullSnapshot()).toEqual(before);
    });

    it("persists the trimmed objective rather than the submitted whitespace", () => {
      handler.submit(
        {
          commandType: "Project.Create",
          entityId: "project-1",
          params: { objective: "   Build a bounded thing   ", projectId: "project-1" },
        },
        OPERATOR,
      );
      expect(persistence.getEntity<{ objective: string }>("projects", "project-1")?.objective).toBe(
        "Build a bounded thing",
      );
    });

    it("refuses a second project while one is still open (V1 limit: one active project)", () => {
      expect(
        handler.submit(
          {
            commandType: "Project.Create",
            entityId: "project-1",
            params: { objective: "Build a bounded thing", projectId: "project-1" },
          },
          OPERATOR,
        ).accepted,
      ).toBe(true);

      const before = fullSnapshot();
      const outcome = handler.submit(
        {
          commandType: "Project.Create",
          entityId: "project-2",
          params: { objective: "Build a different thing", projectId: "project-2" },
        },
        OPERATOR,
      );
      expect(outcome.accepted).toBe(false);
      expect(outcome.reason).toMatch(/one active project/i);
      expect(fullSnapshot()).toEqual(before);
    });
  });

  describe("Build.Create — must be coherent with its Project (AC-103)", () => {
    function createProject(objective = "Build a bounded thing") {
      return handler.submit(
        {
          commandType: "Project.Create",
          entityId: "project-1",
          params: { objective, projectId: "project-1" },
        },
        OPERATOR,
      );
    }

    it("creates the Build when entityId, buildId, project, and objective all agree", () => {
      createProject();
      const outcome = handler.submit(
        {
          commandType: "Build.Create",
          entityId: "build-1",
          params: {
            projectId: "project-1",
            buildId: "build-1",
            objective: "Build a bounded thing",
          },
        },
        OPERATOR,
      );
      expect(outcome.accepted).toBe(true);
      expect(persistence.getWorldStateSnapshot().currentBuild?.id).toBe("build-1");
    });

    it("rejects a buildId that disagrees with entityId, which would create an invisible Build", () => {
      createProject();
      const before = fullSnapshot();
      const outcome = handler.submit(
        {
          commandType: "Build.Create",
          entityId: "build-1",
          params: {
            projectId: "project-1",
            buildId: "build-2",
            objective: "Build a bounded thing",
          },
        },
        OPERATOR,
      );
      expect(outcome.accepted).toBe(false);
      expect(outcome.reason).toMatch(/must equal entityId/i);
      expect(fullSnapshot()).toEqual(before);
    });

    it("rejects a Build whose project does not exist", () => {
      const before = fullSnapshot();
      const outcome = handler.submit(
        {
          commandType: "Build.Create",
          entityId: "build-1",
          params: { projectId: "no-such-project", buildId: "build-1", objective: "Build a thing" },
        },
        OPERATOR,
      );
      expect(outcome.accepted).toBe(false);
      expect(outcome.reason).toMatch(/existing Project/i);
      expect(fullSnapshot()).toEqual(before);
    });

    it("rejects an objectiveSnapshot that is not a snapshot of the project's objective", () => {
      createProject();
      const before = fullSnapshot();
      const outcome = handler.submit(
        {
          commandType: "Build.Create",
          entityId: "build-1",
          params: {
            projectId: "project-1",
            buildId: "build-1",
            objective: "Something the operator never asked for",
          },
        },
        OPERATOR,
      );
      expect(outcome.accepted).toBe(false);
      expect(outcome.reason).toMatch(/does not match/i);
      expect(fullSnapshot()).toEqual(before);
    });

    it("refuses a second build while one is still open (V1 limit: one active build)", () => {
      createProject();
      handler.submit(
        {
          commandType: "Build.Create",
          entityId: "build-1",
          params: {
            projectId: "project-1",
            buildId: "build-1",
            objective: "Build a bounded thing",
          },
        },
        OPERATOR,
      );

      const before = fullSnapshot();
      const outcome = handler.submit(
        {
          commandType: "Build.Create",
          entityId: "build-2",
          params: {
            projectId: "project-1",
            buildId: "build-2",
            objective: "Build a bounded thing",
          },
        },
        OPERATOR,
      );
      expect(outcome.accepted).toBe(false);
      expect(outcome.reason).toMatch(/one active build/i);
      expect(fullSnapshot()).toEqual(before);
    });
  });

  it("Building: Select is always allowed; ChangeState is always denied (system-only)", () => {
    const select = handler.submit(
      {
        commandType: "Building.Select",
        entityId: "warehouse",
        params: { buildingId: "warehouse" },
      },
      OPERATOR,
    );
    expect(select.accepted).toBe(true);
    const changeState = handler.submit(
      { commandType: "Building.ChangeState", entityId: "warehouse", params: {} },
      OPERATOR,
    );
    expect(changeState.accepted).toBe(false);
  });

  it("Build: Start is allowed from planned, prohibited immediately after (already running)", () => {
    seedProjectAndBuild();
    const start = handler.submit(
      { commandType: "Build.Start", entityId: "build-1", params: {} },
      OPERATOR,
    );
    expect(start.accepted).toBe(true);
    const startAgain = handler.submit(
      { commandType: "Build.Start", entityId: "build-1", params: {} },
      OPERATOR,
    );
    expect(startAgain.accepted).toBe(false);
  });

  it("Requirement: Start is allowed (lazy-created pending), prohibited immediately after (already running)", () => {
    const start = handler.submit(
      { commandType: "Requirement.Start", entityId: "req-1", params: {} },
      OPERATOR,
    );
    expect(start.accepted).toBe(true);
    const startAgain = handler.submit(
      { commandType: "Requirement.Start", entityId: "req-1", params: {} },
      OPERATOR,
    );
    expect(startAgain.accepted).toBe(false);
  });

  it("AgentRun: Start is allowed once, prohibited for the same id again (already exists)", () => {
    const start = handler.submit(
      {
        commandType: "AgentRun.Start",
        entityId: "run-1",
        params: {
          agentId: "agent-builder",
          taskId: "task-1",
          runtimeType: "mock",
          riskClass: "R0",
        },
      },
      OPERATOR,
    );
    expect(start.accepted).toBe(true);
    const startAgain = handler.submit(
      {
        commandType: "AgentRun.Start",
        entityId: "run-1",
        params: {
          agentId: "agent-builder",
          taskId: "task-1",
          runtimeType: "mock",
          riskClass: "R0",
        },
      },
      OPERATOR,
    );
    expect(startAgain.accepted).toBe(false);
  });

  it("Artifact: Create is allowed, MarkReady is prohibited before Validate", () => {
    const create = handler.submit(
      {
        commandType: "Artifact.Create",
        entityId: "artifact-1",
        params: {
          artifactId: "artifact-1",
          artifactType: "source_code",
          name: "Thing",
          checksumStatus: "pending",
        },
      },
      OPERATOR,
    );
    expect(create.accepted).toBe(true);
    const markReadyTooSoon = handler.submit(
      { commandType: "Artifact.MarkReady", entityId: "artifact-1", params: {} },
      OPERATOR,
    );
    expect(markReadyTooSoon.accepted).toBe(false);
  });

  it("Transfer: Create is allowed; MarkReady is prohibited without a completed producing stage", () => {
    const create = handler.submit(
      { commandType: "Transfer.Create", entityId: "transfer-1", params: {} },
      OPERATOR,
    );
    expect(create.accepted).toBe(true);
    const markReady = handler.submit(
      {
        commandType: "Transfer.MarkReady",
        entityId: "transfer-1",
        params: { producingStageId: "stage-not-completed" },
      },
      OPERATOR,
    );
    expect(markReady.accepted).toBe(false);
    expect(markReady.reason).toMatch(/invariant 3/);
  });

  it("Approval: Request is allowed; Approve is prohibited on an unknown id", () => {
    const request = handler.submit(
      {
        commandType: "Approval.Request",
        entityId: "approval-1",
        params: {
          approvalId: "approval-1",
          title: "Approve deployment",
          reason: "QA passed",
          riskClass: "R1",
          evidenceIds: [],
          recommendedAction: "approve",
        },
      },
      OPERATOR,
    );
    expect(request.accepted).toBe(true);
    const approveUnknown = handler.submit(
      {
        commandType: "Approval.Approve",
        entityId: "does-not-exist",
        params: { resolvedBy: "operator-1" },
      },
      OPERATOR,
    );
    expect(approveUnknown.accepted).toBe(false);
  });

  it("Upgrade: EvaluateEligibility is prohibited below 10 successful packages, allowed once at 10", () => {
    const tooFew = handler.submit(
      {
        commandType: "Upgrade.EvaluateEligibility",
        entityId: "upgrade-1",
        params: { buildingId: "warehouse", upgradeId: "upgrade-1", requirementEvidence: [] },
      },
      OPERATOR,
    );
    expect(tooFew.accepted).toBe(false);
    expect(tooFew.reason).toMatch(/invariant 9/);

    for (let i = 0; i < 10; i += 1) {
      persistence.appendEvent(
        seedEvent({
          id: `evt-build-completed-${i}`,
          type: "build.completed",
          entityType: "Build",
          entityId: "build-1",
          payload: { finalArtifactIds: [], completedAt: "2026-07-30T00:00:00.000Z" },
        }),
      );
    }
    const enough = handler.submit(
      {
        commandType: "Upgrade.EvaluateEligibility",
        entityId: "upgrade-1",
        params: { buildingId: "warehouse", upgradeId: "upgrade-1", requirementEvidence: [] },
      },
      OPERATOR,
    );
    expect(enough.accepted).toBe(true);
  });

  it("Revision: Complete is prohibited before Start (only requested, not in_progress)", () => {
    const request = handler.submit(
      {
        commandType: "Revision.Request",
        entityId: "revision-2",
        params: {
          revisionId: "revision-2",
          stageId: "stage-x",
          reason: "defect",
          requestedBy: "inspector",
        },
      },
      INSPECTOR,
    );
    expect(request.accepted).toBe(true);
    const completeTooSoon = handler.submit(
      {
        commandType: "Revision.Complete",
        entityId: "revision-2",
        params: { revisionId: "revision-2", resultingStageStatus: "running" },
      },
      OPERATOR,
    );
    expect(completeTooSoon.accepted).toBe(false);
  });
});

describe("CommandHandler — full canonical workflow remains valid through enforcement", () => {
  it("the FBL-023 canonical-run replay (direct appendEvent, bypassing CommandHandler) is unaffected by FBL-025", () => {
    seedProjectAndBuild();
    const snapshot = persistence.getWorldStateSnapshot();
    expect(snapshot.currentBuild?.id).toBe("build-1");
  });
});
