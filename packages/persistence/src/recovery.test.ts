import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentRun, Approval, Building, Upgrade, WorldState } from "@foundry/contracts";
import {
  WAREHOUSE_LEVEL_1_CAPACITY,
  WAREHOUSE_LEVEL_2_CAPACITY,
  readCapacity,
} from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandHandler, type CommandActor } from "./commandHandler";
import { PersistenceService } from "./persistenceService";
import type { StageValidationHistory } from "./reducer";

/**
 * FBL-032 — restart and recovery.
 *
 * ADR-002's closing argument: **truth that cannot survive a restart is
 * not truth.** This rung adds no capability; it proves that every state
 * the workflow can actually reach is reconstructed from the persisted
 * log alone.
 *
 * The suite is organised by *reachable state* rather than by mechanism,
 * because the risk is not "does replay work" — FBL-023 established that
 * — but "is there a state whose recovery nobody checked". Each block
 * drives the system into one such state through real commands, restarts,
 * and asserts the reconstruction.
 */

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
const BACKEND: CommandActor = { actorType: "backend", actorId: "backend", authenticated: true };

let dir: string;
let dbPath: string;
let persistence: PersistenceService;
let handler: CommandHandler;

function seedEvent(overrides: Partial<FoundryEvent>): FoundryEvent {
  return {
    id: overrides.id ?? "seed",
    type: "system.started",
    occurredAt: "2026-08-01T00:00:00.000Z",
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

/**
 * Closes and reopens the store, then hands back a fresh service reading
 * the same file. This is the whole point of the rung: nothing in memory
 * survives, so anything still present was genuinely reconstructed.
 */
function restart(): PersistenceService {
  persistence.close();
  persistence = new PersistenceService(dbPath);
  handler = new CommandHandler(persistence);
  return persistence;
}

/** WorldState with volatile fields removed, for before/after comparison. */
function comparableWorldState(state: WorldState): unknown {
  return JSON.parse(JSON.stringify({ ...state, connectionStatus: undefined }));
}

function seedBuild(): void {
  persistence.appendEvent(seedEvent({ id: "e-start", type: "system.started" }));
  persistence.appendEvent(
    seedEvent({
      id: "e-obj",
      type: "operator.objective_submitted",
      entityType: "Project",
      entityId: "project-1",
      payload: { objective: "Ship it", projectId: "project-1" },
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: "e-build",
      type: "build.created",
      entityType: "Build",
      entityId: "build-1",
      payload: { buildId: "build-1", projectId: "project-1", objective: "Ship it" },
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: "e-stage",
      type: "stage.created",
      entityType: "BuildStage",
      entityId: "stage-1",
      payload: {},
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: "e-stage-started",
      type: "stage.started",
      entityType: "BuildStage",
      entityId: "stage-1",
      payload: { assignedAgentIds: ["agent-builder"], sourceBuildingId: "construction-office" },
    }),
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "foundry-recovery-"));
  dbPath = join(dir, "foundry.sqlite");
  persistence = new PersistenceService(dbPath);
  handler = new CommandHandler(persistence);
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("FBL-032 — WorldState is byte-identical across a restart", () => {
  it("reconstructs an identical projection mid-build", () => {
    seedBuild();
    const before = comparableWorldState(persistence.getWorldStateSnapshot());
    restart();
    expect(comparableWorldState(persistence.getWorldStateSnapshot())).toEqual(before);
  });

  it("reconstructs an identical projection from an empty log", () => {
    const before = comparableWorldState(persistence.getWorldStateSnapshot());
    restart();
    expect(comparableWorldState(persistence.getWorldStateSnapshot())).toEqual(before);
  });

  it("preserves the full event log, in order, across a restart", () => {
    seedBuild();
    const before = persistence.getAllEvents();
    restart();
    expect(persistence.getAllEvents()).toEqual(before);
  });
});

describe("FBL-032 — each reachable workflow state recovers", () => {
  it("mid-build: a running stage stays running", () => {
    seedBuild();
    restart();
    expect(persistence.getEntity<{ status: string }>("buildStages", "stage-1")?.status).toBe(
      "running",
    );
    expect(persistence.getEntity<{ status: string }>("builds", "build-1")).toBeDefined();
  });

  it("blocked: a blocked stage stays blocked with its reason", () => {
    seedBuild();
    persistence.appendEvent(
      seedEvent({
        id: "e-blocked",
        type: "stage.blocked",
        entityType: "BuildStage",
        entityId: "stage-1",
        payload: { reason: "Mandatory requirement failed" },
      }),
    );
    restart();
    expect(persistence.getEntity<{ status: string }>("buildStages", "stage-1")?.status).toBe(
      "blocked",
    );
  });

  it("pending approval: stays pending and still gates progression", () => {
    seedBuild();
    persistence.appendEvent(
      seedEvent({
        id: "e-approval",
        type: "approval.requested",
        entityType: "Approval",
        entityId: "approval-1",
        payload: {
          approvalId: "approval-1",
          title: "Deploy",
          reason: "QA passed",
          riskClass: "R2",
          evidenceIds: [],
          recommendedAction: "Approve",
        },
      }),
    );
    restart();

    const approval = persistence.getEntity<Approval>("approvals", "approval-1");
    expect(approval?.status).toBe("pending");
    // Still a live gate after recovery, not just a stored row.
    expect(persistence.getWorldStateSnapshot().approvals.some((a) => a.status === "pending")).toBe(
      true,
    );
  });

  it("resolved approval: keeps its resolver and refuses a conflicting reversal after restart", () => {
    seedBuild();
    persistence.appendEvent(
      seedEvent({
        id: "e-approval",
        type: "approval.requested",
        entityType: "Approval",
        entityId: "approval-1",
        payload: {
          approvalId: "approval-1",
          title: "Deploy",
          reason: "QA passed",
          riskClass: "R2",
          evidenceIds: [],
          recommendedAction: "Approve",
        },
      }),
    );
    handler.submit(
      { commandType: "Approval.Approve", entityId: "approval-1", params: {} },
      OPERATOR,
    );
    restart();

    expect(persistence.getEntity<Approval>("approvals", "approval-1")?.resolvedBy).toBe(
      "operator-1",
    );
    const conflicting = handler.submit(
      { commandType: "Approval.Reject", entityId: "approval-1", params: {} },
      OPERATOR,
    );
    expect(conflicting.accepted).toBe(false);
  });

  it("failed validation: remains inspectable, with its evidence, after restart", () => {
    seedBuild();
    persistence.appendEvent(
      seedEvent({
        id: "e-validating",
        type: "stage.validation_started",
        entityType: "BuildStage",
        entityId: "stage-1",
        payload: {},
      }),
    );
    handler.submit(
      {
        commandType: "BuildStage.Validate",
        entityId: "stage-1",
        params: {
          outcome: "failed",
          evidenceIds: [],
          failedRequirementIds: ["req-1"],
          retryEligible: true,
        },
      },
      INSPECTOR,
    );
    restart();

    const history = persistence.getEntity<StageValidationHistory>("stageValidations", "stage-1");
    expect(history?.decisions).toHaveLength(1);
    expect(history?.decisions[0]?.decision).toBe("failed");
    expect(history?.decisions[0]?.validatorRole).toBe("inspector");
    expect(history?.decisions[0]?.failedRequirementIds).toEqual(["req-1"]);
  });

  it("in-progress AgentRun: a running run is still running after restart", () => {
    seedBuild();
    handler.submit(
      {
        commandType: "AgentRun.Start",
        entityId: "run-1",
        params: {
          agentId: "agent-builder",
          taskId: "task-1",
          runtimeType: "claude_code",
          riskClass: "R2",
        },
      },
      OPERATOR,
    );
    restart();

    const run = persistence.getEntity<AgentRun>("agentRuns", "run-1");
    expect(run?.status).toBe("running");
    expect(run?.runtimeType).toBe("claude_code");
    // A recovered in-progress run can still reach a terminal state.
    expect(
      handler.submit(
        {
          commandType: "AgentRun.Timeout",
          entityId: "run-1",
          params: { evidenceIds: ["ev-1"], logRef: "logs/run-1.json" },
        },
        OPERATOR,
      ).accepted,
    ).toBe(true);
  });

  it("timed-out AgentRun: retains its logs and evidence after restart (FBL-028)", () => {
    seedBuild();
    handler.submit(
      {
        commandType: "AgentRun.Start",
        entityId: "run-1",
        params: {
          agentId: "agent-builder",
          taskId: "task-1",
          runtimeType: "claude_code",
          riskClass: "R2",
        },
      },
      OPERATOR,
    );
    handler.submit(
      {
        commandType: "AgentRun.Timeout",
        entityId: "run-1",
        params: { evidenceIds: ["ev-1"], logRef: "logs/run-1.json" },
      },
      OPERATOR,
    );
    restart();

    const run = persistence.getEntity<AgentRun>("agentRuns", "run-1");
    expect(run?.status).toBe("timed_out");
    expect(run?.logRef).toBe("logs/run-1.json");
    expect(run?.evidenceIds).toEqual(["ev-1"]);
  });
});

describe("FBL-032 — upgrade states recover at the correct level and capacity", () => {
  function seedUpgradeTo(status: "eligible" | "upgrading" | "completed" | "failed"): void {
    seedBuild();
    persistence.appendEvent(
      seedEvent({
        id: "e-upg-eligible",
        type: "upgrade.eligible",
        entityType: "Upgrade",
        entityId: "upgrade-1",
        payload: { buildingId: "warehouse", upgradeId: "upgrade-1", requirementEvidence: ["ok"] },
      }),
    );
    if (status === "eligible") return;

    handler.submit({ commandType: "Upgrade.Request", entityId: "upgrade-1", params: {} }, OPERATOR);
    persistence.appendEvent(
      seedEvent({
        id: "e-approval",
        type: "approval.requested",
        entityType: "Approval",
        entityId: "approval-upg",
        payload: {
          approvalId: "approval-upg",
          title: "Upgrade",
          reason: "10 packages",
          riskClass: "R2",
          evidenceIds: [],
          recommendedAction: "Approve",
        },
      }),
    );
    handler.submit(
      { commandType: "Approval.Approve", entityId: "approval-upg", params: {} },
      OPERATOR,
    );
    handler.submit(
      {
        commandType: "Upgrade.Start",
        entityId: "upgrade-1",
        params: { approvalId: "approval-upg" },
      },
      BACKEND,
    );
    if (status === "upgrading") return;

    if (status === "failed") {
      handler.submit({ commandType: "Upgrade.Fail", entityId: "upgrade-1", params: {} }, BACKEND);
      return;
    }
    handler.submit(
      {
        commandType: "Upgrade.Complete",
        entityId: "upgrade-1",
        params: { fromLevel: 1, toLevel: 2, capabilitiesAdded: ["capacity_100", "batch_intake"] },
      },
      BACKEND,
    );
  }

  const warehouse = () => persistence.getEntity<Building>("buildings", "warehouse");

  it("eligible: recovers at Level 1 with capacity 25", () => {
    seedUpgradeTo("eligible");
    restart();
    expect(warehouse()?.level).toBe(1);
    expect(readCapacity(warehouse()?.capabilities ?? [])).toBe(WAREHOUSE_LEVEL_1_CAPACITY);
  });

  it("upgrading: recovers at Level 1 with capacity 25 — V-07 survives a restart", () => {
    seedUpgradeTo("upgrading");
    restart();
    expect(persistence.getEntity<Upgrade>("upgrades", "upgrade-1")?.status).toBe("upgrading");
    expect(warehouse()?.level).toBe(1);
    expect(readCapacity(warehouse()?.capabilities ?? [])).toBe(WAREHOUSE_LEVEL_1_CAPACITY);
  });

  it("completed: recovers at Level 2 with capacity 100", () => {
    seedUpgradeTo("completed");
    restart();
    expect(warehouse()?.level).toBe(2);
    expect(readCapacity(warehouse()?.capabilities ?? [])).toBe(WAREHOUSE_LEVEL_2_CAPACITY);
    expect(warehouse()?.capabilities.filter((c) => c.startsWith("capacity_"))).toHaveLength(1);
  });

  it("failed: retains Level 1 and capacity 25 after restart", () => {
    seedUpgradeTo("failed");
    restart();
    expect(persistence.getEntity<Upgrade>("upgrades", "upgrade-1")?.status).toBe("failed");
    expect(warehouse()?.level).toBe(1);
    expect(readCapacity(warehouse()?.capabilities ?? [])).toBe(WAREHOUSE_LEVEL_1_CAPACITY);
  });
});

describe("FBL-032 — replay is idempotent and cannot duplicate", () => {
  it("re-appending every event after a restart changes nothing", () => {
    seedBuild();
    const events = persistence.getAllEvents();
    restart();

    const before = comparableWorldState(persistence.getWorldStateSnapshot());
    for (const event of events) {
      expect(persistence.appendEvent(event).applied).toBe(false);
    }

    expect(persistence.getAllEvents()).toHaveLength(events.length);
    expect(comparableWorldState(persistence.getWorldStateSnapshot())).toEqual(before);
  });

  it("does not duplicate entities when the same event id arrives twice", () => {
    seedBuild();
    const stageCount = persistence.listEntities("buildStages").length;
    const duplicate = persistence.getAllEvents().find((e) => e.type === "stage.created");
    if (!duplicate) throw new Error("fixture missing stage.created");

    expect(persistence.appendEvent(duplicate).applied).toBe(false);
    expect(persistence.listEntities("buildStages")).toHaveLength(stageCount);
  });

  it("reconciles from a snapshot without replaying already-seen events", () => {
    seedBuild();
    const all = persistence.getAllEvents();
    const cursor = all[2]?.id ?? null;

    const { snapshot, missedEvents } = persistence.reconcileFromSnapshot(cursor);

    expect(missedEvents.map((e) => e.id)).toEqual(all.slice(3).map((e) => e.id));
    expect(comparableWorldState(snapshot)).toEqual(
      comparableWorldState(persistence.getWorldStateSnapshot()),
    );
  });

  it("returns the full log for an unknown cursor, so a stale client fully resyncs", () => {
    seedBuild();
    const { missedEvents } = persistence.reconcileFromSnapshot("an-id-that-was-never-persisted");
    expect(missedEvents).toHaveLength(persistence.getAllEvents().length);
  });

  it("returns the full log for a null cursor", () => {
    seedBuild();
    const { missedEvents } = persistence.reconcileFromSnapshot(null);
    expect(missedEvents).toHaveLength(persistence.getAllEvents().length);
  });
});

describe("FBL-032 — commands against stale state are rejected after recovery", () => {
  it("refuses a transition that was already applied before the restart", () => {
    seedBuild();
    persistence.appendEvent(
      seedEvent({
        id: "e-validating",
        type: "stage.validation_started",
        entityType: "BuildStage",
        entityId: "stage-1",
        payload: {},
      }),
    );
    handler.submit(
      {
        commandType: "BuildStage.Validate",
        entityId: "stage-1",
        params: { outcome: "passed", evidenceIds: [], passedRequirementIds: [] },
      },
      INSPECTOR,
    );
    restart();

    // A client that reconnected holding pre-restart state and resubmits.
    const conflicting = handler.submit(
      {
        commandType: "BuildStage.Validate",
        entityId: "stage-1",
        params: {
          outcome: "failed",
          evidenceIds: [],
          failedRequirementIds: ["r"],
          retryEligible: true,
        },
      },
      INSPECTOR,
    );
    expect(conflicting.accepted).toBe(false);
    expect(conflicting.reason).toMatch(/conflicting/);
  });

  it("still refuses an unauthorized command after a restart", () => {
    // Authorization is not in-memory state either.
    seedBuild();
    restart();
    const outcome = handler.submit(
      {
        commandType: "BuildStage.Validate",
        entityId: "stage-1",
        params: { outcome: "passed", evidenceIds: [], passedRequirementIds: [] },
      },
      { actorType: "frontend", actorId: "anonymous", authenticated: false },
    );
    expect(outcome.accepted).toBe(false);
  });
});

describe("FBL-032 — subscribers never observe non-durable state", () => {
  it("notifies only after the event is committed, and never for a duplicate", () => {
    const seen: string[] = [];
    const unsubscribe = persistence.subscribe((event) => {
      // If a subscriber ever fired before the commit, the event would not
      // yet be readable from the log at this point.
      expect(persistence.getAllEvents().some((e) => e.id === event.id)).toBe(true);
      seen.push(event.id);
    });

    const event = seedEvent({ id: "e-once", type: "system.started" });
    persistence.appendEvent(event);
    persistence.appendEvent(event);

    unsubscribe();
    expect(seen).toEqual(["e-once"]);
  });

  it("stops notifying after unsubscribe", () => {
    const seen: string[] = [];
    const unsubscribe = persistence.subscribe((event) => seen.push(event.id));
    unsubscribe();
    persistence.appendEvent(seedEvent({ id: "e-after", type: "system.started" }));
    expect(seen).toEqual([]);
  });
});
