import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Building, Upgrade } from "@foundry/contracts";
import {
  WAREHOUSE_LEVEL_1_CAPACITY,
  WAREHOUSE_LEVEL_2_CAPACITY,
  capacityCapability,
  readCapacity,
} from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandHandler, type CommandActor } from "./commandHandler";
import { PersistenceService } from "./persistenceService";

/**
 * FBL-031 — capability-based Warehouse upgrade.
 *
 * Principle 20: "Upgrades require evidence and real capability changes."
 * The two halves are tested separately, because each fails differently —
 * evidence without a capability change is cosmetic, and a capability
 * change without evidence is unearned.
 *
 * V-07 is the sharpest requirement: the visual level must not move before
 * `upgrade.completed`, and level and capacity must move *together*.
 */

const WAREHOUSE = "warehouse";
const UPGRADE = "upgrade-1";
const APPROVAL = "approval-upgrade";

const OPERATOR: CommandActor = {
  actorType: "operator",
  actorId: "operator-1",
  authenticated: true,
};
const BUILDER: CommandActor = { actorType: "agent", actorId: "agent-builder", authenticated: true };
const FRONTEND: CommandActor = {
  actorType: "frontend",
  actorId: "anonymous",
  authenticated: false,
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

const warehouse = () => persistence.getEntity<Building>("buildings", WAREHOUSE);
const capacity = () => readCapacity(warehouse()?.capabilities ?? []);

/** Brings the world to the point where the tenth package has been processed. */
function seedTenSuccessfulPackages(): void {
  persistence.appendEvent(seedEvent({ id: "evt-start", type: "system.started" }));
  persistence.appendEvent(
    seedEvent({
      id: "evt-objective",
      type: "operator.objective_submitted",
      entityType: "Project",
      entityId: "project-1",
      payload: { objective: "Ship it", projectId: "project-1" },
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: "evt-build",
      type: "build.created",
      entityType: "Build",
      entityId: "build-1",
      payload: { buildId: "build-1", projectId: "project-1", objective: "Ship it" },
    }),
  );
  // The tenth package: the seeded history of 9 plus this build's one
  // (domain-model.md counting rule, M-06).
  persistence.appendEvent(
    seedEvent({
      id: "evt-build-completed",
      type: "build.completed",
      entityType: "Build",
      entityId: "build-1",
      payload: { finalArtifactIds: ["artifact-package"], completedAt: "2026-08-01T01:00:00.000Z" },
    }),
  );
}

function seedEligibleUpgrade(): void {
  persistence.appendEvent(
    seedEvent({
      id: "evt-upgrade-eligible",
      type: "upgrade.eligible",
      entityType: "Upgrade",
      entityId: UPGRADE,
      payload: {
        buildingId: WAREHOUSE,
        upgradeId: UPGRADE,
        requirementEvidence: ["10 packages processed", "no unresolved critical event"],
      },
    }),
  );
}

function seedApprovedApproval(): void {
  persistence.appendEvent(
    seedEvent({
      id: "evt-approval-requested",
      type: "approval.requested",
      entityType: "Approval",
      entityId: APPROVAL,
      payload: {
        approvalId: APPROVAL,
        title: "Upgrade the Warehouse to Level 2",
        reason: "10 packages processed",
        riskClass: "R2",
        evidenceIds: [],
        recommendedAction: "Approve",
      },
    }),
  );
  handler.submit({ commandType: "Approval.Approve", entityId: APPROVAL, params: {} }, OPERATOR);
}

/**
 * Drives the documented lifecycle `eligible → awaiting_approval →
 * upgrading` (domain-model.md → Upgrade). `Upgrade.Start` cannot be
 * reached directly from `eligible`: the request/approve step is what
 * records that a human was asked.
 */
function startUpgrade(): ReturnType<CommandHandler["submit"]> {
  handler.submit({ commandType: "Upgrade.Request", entityId: UPGRADE, params: {} }, OPERATOR);
  handler.submit({ commandType: "Upgrade.Approve", entityId: UPGRADE, params: {} }, OPERATOR);
  return handler.submit(
    { commandType: "Upgrade.Start", entityId: UPGRADE, params: { approvalId: APPROVAL } },
    BACKEND,
  );
}

function completeUpgrade(): ReturnType<CommandHandler["submit"]> {
  return handler.submit(
    {
      commandType: "Upgrade.Complete",
      entityId: UPGRADE,
      params: {
        fromLevel: 1,
        toLevel: 2,
        capabilitiesAdded: [capacityCapability(WAREHOUSE_LEVEL_2_CAPACITY), "batch_intake"],
      },
    },
    BACKEND,
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "foundry-upgrade-"));
  dbPath = join(dir, "foundry.sqlite");
  persistence = new PersistenceService(dbPath);
  handler = new CommandHandler(persistence);
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("FBL-031 — the Warehouse starts at Level 1 with capacity 25", () => {
  it("declares its Level 1 capacity from world initialization", () => {
    expect(warehouse()?.level).toBe(1);
    expect(capacity()).toBe(WAREHOUSE_LEVEL_1_CAPACITY);
  });

  it("gives no other building a capacity — only the Warehouse upgrades in V1", () => {
    const others = persistence
      .listEntities<Building>("buildings")
      .filter((b) => b.buildingType !== "warehouse");
    expect(others.every((b) => readCapacity(b.capabilities) === null)).toBe(true);
  });
});

describe("FBL-031 — eligibility comes from real persisted metrics", () => {
  const evaluate = (actor: CommandActor = OPERATOR) =>
    handler.submit(
      {
        commandType: "Upgrade.EvaluateEligibility",
        entityId: UPGRADE,
        params: {
          buildingId: WAREHOUSE,
          upgradeId: UPGRADE,
          requirementEvidence: ["evidence"],
        },
      },
      actor,
    );

  it("refuses while fewer than ten packages have been processed", () => {
    persistence.appendEvent(seedEvent({ id: "evt-start", type: "system.started" }));
    const outcome = evaluate();
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/9\/10 successful packages/);
  });

  it("accepts once the tenth package is processed", () => {
    seedTenSuccessfulPackages();
    expect(evaluate().accepted).toBe(true);
  });

  it("refuses while an unresolved critical event exists", () => {
    seedTenSuccessfulPackages();
    persistence.appendEvent(
      seedEvent({
        id: "evt-critical",
        type: "system.health_changed",
        entityType: "System",
        entityId: "neighborhood-1",
        severity: "critical",
        payload: {
          previousHealth: "healthy",
          newHealth: "critical",
          reasons: ["runtime_unavailable"],
        },
      }),
    );
    const outcome = evaluate();
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/critical/);
  });

  it("refuses when the validation pass rate after retries is below 90%", () => {
    seedTenSuccessfulPackages();
    // Ten stages, two of which finally failed → 80%.
    for (let i = 0; i < 10; i += 1) {
      const stageId = `stage-${i}`;
      persistence.appendEvent(
        seedEvent({
          id: `c-${i}`,
          type: "stage.created",
          entityType: "BuildStage",
          entityId: stageId,
          payload: {},
        }),
      );
      // Built as two distinct literals rather than one conditional: the
      // event union cannot narrow when the discriminant and the payload
      // are both ternaries, which `typecheck` catches even though the
      // values are correct at runtime.
      persistence.appendEvent(
        i < 2
          ? seedEvent({
              id: `v-${i}`,
              type: "stage.validation_failed",
              entityType: "BuildStage",
              entityId: stageId,
              actorType: "agent",
              actorId: "agent-inspector",
              payload: { failedRequirementIds: ["r"], evidenceIds: [], retryEligible: false },
            })
          : seedEvent({
              id: `v-${i}`,
              type: "stage.validation_passed",
              entityType: "BuildStage",
              entityId: stageId,
              actorType: "agent",
              actorId: "agent-inspector",
              payload: { evidenceIds: [], passedRequirementIds: ["r"] },
            }),
      );
    }

    const outcome = evaluate();
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/pass rate/);
  });

  it("counts a repaired stage by its final decision, not its first", () => {
    // "≥90% after retries" — a stage that failed and was then repaired
    // must count as a pass, or the workflow V1 demonstrates would itself
    // block the upgrade it is meant to earn.
    seedTenSuccessfulPackages();
    persistence.appendEvent(
      seedEvent({
        id: "c-r",
        type: "stage.created",
        entityType: "BuildStage",
        entityId: "stage-r",
        payload: {},
      }),
    );
    persistence.appendEvent(
      seedEvent({
        id: "v-r-fail",
        type: "stage.validation_failed",
        entityType: "BuildStage",
        entityId: "stage-r",
        actorType: "agent",
        actorId: "agent-inspector",
        payload: { failedRequirementIds: ["r"], evidenceIds: [], retryEligible: true },
      }),
    );
    persistence.appendEvent(
      seedEvent({
        id: "v-r-pass",
        type: "stage.validation_passed",
        entityType: "BuildStage",
        entityId: "stage-r",
        actorType: "agent",
        actorId: "agent-inspector",
        payload: { evidenceIds: [], passedRequirementIds: ["r"] },
      }),
    );

    expect(evaluate().accepted).toBe(true);
  });
});

describe("FBL-031 — the upgrade is approval-gated", () => {
  beforeEach(() => {
    seedTenSuccessfulPackages();
    seedEligibleUpgrade();
  });

  it("refuses to start without an approved Approval", () => {
    const outcome = handler.submit(
      { commandType: "Upgrade.Start", entityId: UPGRADE, params: {} },
      BACKEND,
    );
    expect(outcome.accepted).toBe(false);
    expect(warehouse()?.level).toBe(1);
    expect(capacity()).toBe(WAREHOUSE_LEVEL_1_CAPACITY);
  });

  it("refuses to start while the Approval is still pending", () => {
    persistence.appendEvent(
      seedEvent({
        id: "evt-approval-requested",
        type: "approval.requested",
        entityType: "Approval",
        entityId: APPROVAL,
        payload: {
          approvalId: APPROVAL,
          title: "Upgrade",
          reason: "10 packages",
          riskClass: "R2",
          evidenceIds: [],
          recommendedAction: "Approve",
        },
      }),
    );
    const outcome = handler.submit(
      { commandType: "Upgrade.Start", entityId: UPGRADE, params: { approvalId: APPROVAL } },
      BACKEND,
    );
    expect(outcome.accepted).toBe(false);
    expect(capacity()).toBe(WAREHOUSE_LEVEL_1_CAPACITY);
  });

  it("permits the start once the operator has approved", () => {
    seedApprovedApproval();
    expect(startUpgrade().accepted).toBe(true);
  });

  it("requires an authenticated operator to request or approve the upgrade", () => {
    for (const actor of [BUILDER, FRONTEND]) {
      expect(
        handler.submit({ commandType: "Upgrade.Request", entityId: UPGRADE, params: {} }, actor)
          .accepted,
      ).toBe(false);
      expect(
        handler.submit({ commandType: "Upgrade.Approve", entityId: UPGRADE, params: {} }, actor)
          .accepted,
      ).toBe(false);
    }
  });
});

describe("FBL-031 — V-07: nothing visible changes before completion", () => {
  beforeEach(() => {
    seedTenSuccessfulPackages();
    seedEligibleUpgrade();
    seedApprovedApproval();
  });

  it("leaves level and capacity untouched while merely eligible", () => {
    expect(persistence.getEntity<Upgrade>("upgrades", UPGRADE)?.status).toBe("eligible");
    expect(warehouse()?.level).toBe(1);
    expect(capacity()).toBe(WAREHOUSE_LEVEL_1_CAPACITY);
  });

  it("leaves level and capacity untouched during `upgrading`", () => {
    const started = startUpgrade();
    expect(started.accepted).toBe(true);
    expect(persistence.getEntity<Upgrade>("upgrades", UPGRADE)?.status).toBe("upgrading");

    // The critical assertion of V-07.
    expect(warehouse()?.level).toBe(1);
    expect(capacity()).toBe(WAREHOUSE_LEVEL_1_CAPACITY);
  });

  it("changes level and capacity together, only on completion", () => {
    startUpgrade();
    expect(completeUpgrade().accepted).toBe(true);

    const building = warehouse();
    expect(building?.level).toBe(2);
    expect(readCapacity(building?.capabilities ?? [])).toBe(WAREHOUSE_LEVEL_2_CAPACITY);
    // The old capacity is replaced, not accumulated beside the new one.
    expect(building?.capabilities.filter((c) => c.startsWith("capacity_"))).toHaveLength(1);
    expect(building?.capabilities).toContain("batch_intake");
  });

  it("retains Level 1 and capacity 25 when the upgrade fails", () => {
    startUpgrade();
    const failed = handler.submit(
      { commandType: "Upgrade.Fail", entityId: UPGRADE, params: {} },
      BACKEND,
    );
    expect(failed.accepted).toBe(true);

    expect(persistence.getEntity<Upgrade>("upgrades", UPGRADE)?.status).toBe("failed");
    expect(warehouse()?.level).toBe(1);
    expect(capacity()).toBe(WAREHOUSE_LEVEL_1_CAPACITY);
  });
});

describe("FBL-031 — completion is applied exactly once", () => {
  beforeEach(() => {
    seedTenSuccessfulPackages();
    seedEligibleUpgrade();
    seedApprovedApproval();
    startUpgrade();
    expect(completeUpgrade().accepted).toBe(true);
  });

  it("treats a duplicate completion as an idempotent no-op", () => {
    const eventsAfterFirst = persistence.getAllEvents().length;
    const repeat = completeUpgrade();

    expect(repeat.accepted).toBe(true);
    expect(repeat.reason).toMatch(/idempotent/);
    expect(persistence.getAllEvents()).toHaveLength(eventsAfterFirst);
  });

  it("does not double-apply the capability change", () => {
    completeUpgrade();
    completeUpgrade();

    const building = warehouse();
    expect(building?.level).toBe(2);
    expect(readCapacity(building?.capabilities ?? [])).toBe(WAREHOUSE_LEVEL_2_CAPACITY);
    expect(building?.capabilities.filter((c) => c.startsWith("capacity_"))).toHaveLength(1);
    expect(building?.capabilities.filter((c) => c === "batch_intake")).toHaveLength(1);
  });

  it("reconstructs Level 2 and capacity 100 after a restart", () => {
    persistence.close();
    const reopened = new PersistenceService(dbPath);
    try {
      const building = reopened.getEntity<Building>("buildings", WAREHOUSE);
      expect(building?.level).toBe(2);
      expect(readCapacity(building?.capabilities ?? [])).toBe(WAREHOUSE_LEVEL_2_CAPACITY);
      expect(reopened.getEntity<Upgrade>("upgrades", UPGRADE)?.status).toBe("completed");
    } finally {
      reopened.close();
      persistence = new PersistenceService(dbPath);
    }
  });
});

describe("FBL-031 — capacity capability helpers", () => {
  it("round-trips a capacity", () => {
    expect(readCapacity([capacityCapability(25)])).toBe(25);
    expect(readCapacity([capacityCapability(100)])).toBe(100);
  });

  it("reads the capacity from among unrelated capabilities", () => {
    expect(readCapacity(["batch_intake", "capacity_100", "something_else"])).toBe(100);
  });

  it("returns null when no capacity is declared", () => {
    expect(readCapacity(["batch_intake"])).toBeNull();
    expect(readCapacity([])).toBeNull();
  });
});
