import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentRun } from "@foundry/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandHandler, type CommandActor } from "./commandHandler";
import { PersistenceService } from "./persistenceService";

/**
 * FBL-028 durability requirements for the controlled Claude Code stage.
 *
 * The controlled run is the one place in V1 where a real external
 * process does real work, so two properties matter more here than
 * anywhere else: the record of that run must survive a restart, and a
 * resubmitted request must never quietly start a second one.
 *
 * Both are properties of the persisted event log (FBL-023) and the
 * transition enforcement in front of it (FBL-025), which is why they are
 * asserted here against real storage rather than against the adapter.
 */

const OPERATOR: CommandActor = { actorType: "operator", actorId: "operator-1" };

const START_PARAMS = {
  agentId: "agent-builder",
  taskId: "task-backend-implementation",
  runtimeType: "claude_code" as const,
  riskClass: "R2" as const,
};

let dir: string;
let dbPath: string;
let persistence: PersistenceService;
let handler: CommandHandler;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "foundry-agentrun-"));
  dbPath = join(dir, "foundry.sqlite");
  persistence = new PersistenceService(dbPath);
  handler = new CommandHandler(persistence);
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("controlled AgentRun durability (FBL-028)", () => {
  it("persists a claude_code AgentRun across a full backend restart", () => {
    const started = handler.submit(
      { commandType: "AgentRun.Start", entityId: "agentrun-fbl-028", params: START_PARAMS },
      OPERATOR,
    );
    expect(started.accepted).toBe(true);

    const completed = handler.submit(
      {
        commandType: "AgentRun.Complete",
        entityId: "agentrun-fbl-028",
        params: {
          exitCode: 0,
          outputArtifactIds: ["artifact-task-store"],
          evidenceIds: ["evidence-fbl-028"],
        },
      },
      OPERATOR,
    );
    expect(completed.accepted).toBe(true);

    // Close the service entirely, then reopen the same database file —
    // state must be rebuilt from the log, not from anything in memory.
    persistence.close();
    const reopened = new PersistenceService(dbPath);

    try {
      const run = reopened.getEntity<AgentRun>("agentRuns", "agentrun-fbl-028");
      expect(run).toBeDefined();
      expect(run?.runtimeType).toBe("claude_code");
      expect(run?.status).toBe("completed");
      expect(run?.riskClass).toBe("R2");
      expect(run?.exitCode).toBe(0);
      expect(run?.evidenceIds).toEqual(["evidence-fbl-028"]);
      expect(run?.outputArtifactIds).toEqual(["artifact-task-store"]);
      expect(reopened.getAllEvents()).toHaveLength(2);
    } finally {
      reopened.close();
      persistence = new PersistenceService(dbPath);
    }
  });

  it("retains a timed-out run's evidence and log reference across a restart", () => {
    handler.submit(
      { commandType: "AgentRun.Start", entityId: "agentrun-timeout", params: START_PARAMS },
      OPERATOR,
    );
    const timedOut = handler.submit(
      {
        commandType: "AgentRun.Timeout",
        entityId: "agentrun-timeout",
        params: { evidenceIds: ["evidence-timeout"], logRef: "logs/agentrun-timeout.json" },
      },
      OPERATOR,
    );
    expect(timedOut.accepted).toBe(true);

    persistence.close();
    const reopened = new PersistenceService(dbPath);

    try {
      const run = reopened.getEntity<AgentRun>("agentRuns", "agentrun-timeout");
      // A timed-out run terminates safely and keeps its logs
      // (domain-model.md → AgentRun invariants).
      expect(run?.status).toBe("timed_out");
      expect(run?.logRef).toBe("logs/agentrun-timeout.json");
      expect(run?.evidenceIds).toEqual(["evidence-timeout"]);
    } finally {
      reopened.close();
      persistence = new PersistenceService(dbPath);
    }
  });

  it("refuses a duplicate start for the same AgentRun id, leaving state unchanged", () => {
    const first = handler.submit(
      { commandType: "AgentRun.Start", entityId: "agentrun-fbl-028", params: START_PARAMS },
      OPERATOR,
    );
    expect(first.accepted).toBe(true);

    const eventsBefore = persistence.getAllEvents();
    const runBefore = persistence.getEntity<AgentRun>("agentRuns", "agentrun-fbl-028");

    const duplicate = handler.submit(
      { commandType: "AgentRun.Start", entityId: "agentrun-fbl-028", params: START_PARAMS },
      OPERATOR,
    );

    expect(duplicate.accepted).toBe(false);
    expect(duplicate.reason).toContain("already exists");
    // Zero mutation on the rejection path, asserted rather than assumed.
    expect(persistence.getAllEvents()).toEqual(eventsBefore);
    expect(persistence.getEntity<AgentRun>("agentRuns", "agentrun-fbl-028")).toEqual(runBefore);
    expect(persistence.listEntities("agentRuns")).toHaveLength(1);
  });

  it("refuses a duplicate start even after the first run has completed", () => {
    handler.submit(
      { commandType: "AgentRun.Start", entityId: "agentrun-fbl-028", params: START_PARAMS },
      OPERATOR,
    );
    handler.submit(
      {
        commandType: "AgentRun.Complete",
        entityId: "agentrun-fbl-028",
        params: { exitCode: 0, outputArtifactIds: [], evidenceIds: ["e1"] },
      },
      OPERATOR,
    );

    // A retry arriving after completion must not re-run the stage.
    const retry = handler.submit(
      { commandType: "AgentRun.Start", entityId: "agentrun-fbl-028", params: START_PARAMS },
      OPERATOR,
    );

    expect(retry.accepted).toBe(false);
    expect(persistence.listEntities("agentRuns")).toHaveLength(1);
    expect(persistence.getEntity<AgentRun>("agentRuns", "agentrun-fbl-028")?.status).toBe(
      "completed",
    );
  });

  it("survives a duplicate start attempt across a restart", () => {
    handler.submit(
      { commandType: "AgentRun.Start", entityId: "agentrun-fbl-028", params: START_PARAMS },
      OPERATOR,
    );
    persistence.close();

    // A restarted backend rebuilds from the log, so it still knows the
    // run exists — duplicate protection is not in-memory state.
    persistence = new PersistenceService(dbPath);
    handler = new CommandHandler(persistence);

    const duplicate = handler.submit(
      { commandType: "AgentRun.Start", entityId: "agentrun-fbl-028", params: START_PARAMS },
      OPERATOR,
    );

    expect(duplicate.accepted).toBe(false);
    expect(persistence.listEntities("agentRuns")).toHaveLength(1);
  });

  it("rejects an AgentRun declaring a risk class above R2", () => {
    const denied = handler.submit(
      {
        commandType: "AgentRun.Start",
        entityId: "agentrun-too-risky",
        params: { ...START_PARAMS, riskClass: "R4" },
      },
      OPERATOR,
    );

    expect(denied.accepted).toBe(false);
    expect(persistence.listEntities("agentRuns")).toHaveLength(0);
  });
});
