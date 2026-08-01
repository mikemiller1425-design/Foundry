import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Approval, Revision } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandHandler, type CommandActor } from "./commandHandler";
import { PersistenceService } from "./persistenceService";
import { PrincipalRegistry } from "./principals";

/**
 * FBL-030 — the human approval gate.
 *
 * Principle 14 ("Humans govern") is only real if the gate cannot be
 * resolved by the things it exists to constrain. So the tests here are
 * mostly about *who may decide*, and about the decision being immutable
 * once made.
 */

const APPROVAL = "approval-1";
const STAGE = "stage-deployment";

const OPERATOR: CommandActor = {
  actorType: "operator",
  actorId: "operator-1",
  authenticated: true,
};
/** Authenticated, but an agent — the gate constrains agents. */
const INSPECTOR: CommandActor = {
  actorType: "agent",
  actorId: "agent-inspector",
  authenticated: true,
};
const BUILDER: CommandActor = { actorType: "agent", actorId: "agent-builder", authenticated: true };
/** An unauthenticated HTTP caller — i.e. the browser. */
const FRONTEND: CommandActor = {
  actorType: "frontend",
  actorId: "anonymous",
  authenticated: false,
};
/** The pre-FBL-030 attack: operator authority asserted, not proven. */
const SPOOFED_OPERATOR: CommandActor = {
  actorType: "operator",
  actorId: "operator-1",
  authenticated: false,
};

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

function seedPendingApproval(): void {
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
  persistence.appendEvent(
    seedEvent({
      id: "evt-stage",
      type: "stage.created",
      entityType: "BuildStage",
      entityId: STAGE,
      payload: {},
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: "evt-stage-started",
      type: "stage.started",
      entityType: "BuildStage",
      entityId: STAGE,
      payload: { assignedAgentIds: ["agent-builder"], sourceBuildingId: "qa" },
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: "evt-approval",
      type: "approval.requested",
      entityType: "Approval",
      entityId: APPROVAL,
      payload: {
        approvalId: APPROVAL,
        title: "Deploy to the dock",
        reason: "QA validation passed",
        riskClass: "R2",
        evidenceIds: ["artifact-build-package"],
        recommendedAction: "Approve to permit the QA → Deployment Dock transfer",
      },
    }),
  );
}

const resolve = (
  command: "Approve" | "Reject" | "RequestRevision",
  actor: CommandActor,
  params = {},
) =>
  handler.submit(
    { commandType: `Approval.${command}` as never, entityId: APPROVAL, params },
    actor,
  );

function snapshot() {
  return {
    events: persistence.getAllEvents(),
    approvals: persistence.listEntities("approvals"),
    revisions: persistence.listEntities("revisions"),
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "foundry-approval-"));
  dbPath = join(dir, "foundry.sqlite");
  persistence = new PersistenceService(dbPath);
  handler = new CommandHandler(persistence);
  seedPendingApproval();
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("FBL-030 — only an authenticated operator may resolve", () => {
  it("accepts an authenticated operator", () => {
    const outcome = resolve("Approve", OPERATOR);
    expect(outcome.accepted).toBe(true);
    expect(outcome.event?.type).toBe("approval.approved");
  });

  it("rejects an unauthenticated caller claiming to be the operator", () => {
    const before = snapshot();
    const outcome = resolve("Approve", SPOOFED_OPERATOR);
    expect(outcome.accepted).toBe(false);
    expect(snapshot()).toEqual(before);
  });

  it("rejects the frontend", () => {
    expect(resolve("Approve", FRONTEND).accepted).toBe(false);
  });

  it("rejects an authenticated agent — the gate constrains agents", () => {
    expect(resolve("Approve", INSPECTOR).accepted).toBe(false);
    expect(resolve("Approve", BUILDER).accepted).toBe(false);
  });

  it("rejects every resolution verb from an unauthorized caller", () => {
    for (const command of ["Approve", "Reject", "RequestRevision"] as const) {
      expect(resolve(command, BUILDER).accepted).toBe(false);
      expect(resolve(command, FRONTEND).accepted).toBe(false);
    }
    expect(persistence.getEntity<Approval>("approvals", APPROVAL)?.status).toBe("pending");
  });

  it("gives every refused caller the same reason", () => {
    const reasons = new Set(
      [BUILDER, FRONTEND, INSPECTOR, SPOOFED_OPERATOR].map(
        (actor) => resolve("Approve", actor).reason,
      ),
    );
    expect(reasons.size).toBe(1);
  });

  it("refuses before revealing whether the approval exists", () => {
    const real = resolve("Approve", FRONTEND);
    const imaginary = handler.submit(
      { commandType: "Approval.Approve", entityId: "approval-does-not-exist", params: {} },
      FRONTEND,
    );
    expect(imaginary.reason).toBe(real.reason);
    expect(real.reason).not.toMatch(/No Approval/);
  });

  it("accepts a resolution presented with a real operator credential", () => {
    const registry = new PrincipalRegistry();
    const token = registry.issueOperatorCredential("operator-1");
    const outcome = handler.submit(
      { commandType: "Approval.Approve", entityId: APPROVAL, params: {} },
      registry.resolve(token),
    );
    expect(outcome.accepted).toBe(true);
  });

  it("refuses an agent credential even though it is genuinely authenticated", () => {
    const registry = new PrincipalRegistry();
    const token = registry.issueAgentCredential("agent-inspector");
    const outcome = handler.submit(
      { commandType: "Approval.Approve", entityId: APPROVAL, params: {} },
      registry.resolve(token),
    );
    expect(outcome.accepted).toBe(false);
  });
});

describe("FBL-030 — resolvedBy comes from the credential, not the payload", () => {
  it("records the authenticated operator as the resolver", () => {
    resolve("Approve", OPERATOR);
    const approval = persistence.getEntity<Approval>("approvals", APPROVAL);
    expect(approval?.resolvedBy).toBe("operator-1");
  });

  it("rejects a payload asserting a different resolver rather than silently overriding it", () => {
    const outcome = resolve("Approve", OPERATOR, { resolvedBy: "someone-else" });
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/does not match the authenticated operator/);
    expect(persistence.getEntity<Approval>("approvals", APPROVAL)?.status).toBe("pending");
  });

  it("accepts a payload resolver that agrees with the credential", () => {
    expect(resolve("Approve", OPERATOR, { resolvedBy: "operator-1" }).accepted).toBe(true);
  });
});

describe("FBL-030 — duplicate, conflicting, and stale resolutions", () => {
  it("treats a repeated identical resolution as an idempotent no-op", () => {
    expect(resolve("Approve", OPERATOR).accepted).toBe(true);
    const eventsAfterFirst = persistence.getAllEvents().length;
    const resolvedAt = persistence.getEntity<Approval>("approvals", APPROVAL)?.resolvedAt;

    const repeat = resolve("Approve", OPERATOR);
    expect(repeat.accepted).toBe(true);
    expect(repeat.reason).toMatch(/idempotent/);
    expect(persistence.getAllEvents()).toHaveLength(eventsAfterFirst);
    // The original decision stands, with its original timestamp.
    expect(persistence.getEntity<Approval>("approvals", APPROVAL)?.resolvedAt).toBe(resolvedAt);
  });

  it("rejects a conflicting resolution after an approval", () => {
    expect(resolve("Approve", OPERATOR).accepted).toBe(true);
    const before = snapshot();

    const conflicting = resolve("Reject", OPERATOR);
    expect(conflicting.accepted).toBe(false);
    expect(conflicting.reason).toMatch(/conflicting/);
    expect(snapshot()).toEqual(before);
  });

  it("rejects a conflicting resolution after a rejection", () => {
    expect(resolve("Reject", OPERATOR).accepted).toBe(true);
    expect(resolve("Approve", OPERATOR).accepted).toBe(false);
    expect(persistence.getEntity<Approval>("approvals", APPROVAL)?.status).toBe("rejected");
  });

  it("rejects a revision request after the approval was already granted", () => {
    expect(resolve("Approve", OPERATOR).accepted).toBe(true);
    expect(resolve("RequestRevision", OPERATOR).accepted).toBe(false);
  });
});

describe("FBL-030 — protected progression", () => {
  const markTransferReady = () =>
    handler.submit(
      {
        commandType: "Transfer.MarkReady",
        entityId: "transfer-1",
        params: {
          producingStageId: STAGE,
          leg: "qa_to_deployment_dock",
          buildId: "build-1",
        },
      },
      OPERATOR,
    );

  beforeEach(() => {
    persistence.appendEvent(
      seedEvent({
        id: "evt-stage-complete",
        type: "stage.completed",
        entityType: "BuildStage",
        entityId: STAGE,
        payload: { artifactIds: [], completedAt: "2026-08-01T00:10:00.000Z" },
      }),
    );
    // `transfer.created` carries an empty payload by design — the
    // reducer derives the transfer's fields from the current build and
    // stage (event-model.md: per-leg preconditions are enforced, not
    // carried as payload fields).
    persistence.appendEvent(
      seedEvent({
        id: "evt-transfer",
        type: "transfer.created",
        entityType: "Transfer",
        entityId: "transfer-1",
        payload: {},
      }),
    );
  });

  it("pauses the approval-gated transfer while the approval is pending", () => {
    expect(persistence.getEntity<Approval>("approvals", APPROVAL)?.status).toBe("pending");
    const blocked = markTransferReady();
    expect(blocked.accepted).toBe(false);
  });

  it("permits the gated transition once approved", () => {
    expect(resolve("Approve", OPERATOR).accepted).toBe(true);
    expect(markTransferReady().accepted).toBe(true);
  });

  it("leaves the gated transition stopped after a rejection", () => {
    expect(resolve("Reject", OPERATOR).accepted).toBe(true);
    const blocked = markTransferReady();
    expect(blocked.accepted).toBe(false);
  });

  it("leaves the gated transition stopped after a revision request", () => {
    expect(resolve("RequestRevision", OPERATOR).accepted).toBe(true);
    expect(markTransferReady().accepted).toBe(false);
  });
});

describe("FBL-030 — revision_requested returns work to the revision path", () => {
  it("creates a Revision linked to the approval and reopens the stage", () => {
    expect(
      resolve("RequestRevision", OPERATOR, { resolutionNote: "Needs a rollback plan" }).accepted,
    ).toBe(true);

    const revisions = persistence.listEntities<Revision>("revisions");
    expect(revisions).toHaveLength(1);
    const revision = revisions[0];

    // event-model.md: "creates a Revision record ... linking back to the
    // stage via sourceApprovalId; the stage moves to revision_required".
    expect(revision?.sourceApprovalId).toBe(APPROVAL);
    expect(revision?.stageId).toBe(STAGE);
    expect(revision?.requestedBy).toBe("approval");
    expect(revision?.status).toBe("requested");
    expect(revision?.reason).toBe("Needs a rollback plan");
    expect(persistence.getEntity<{ status: string }>("buildStages", STAGE)?.status).toBe(
      "revision_required",
    );
  });

  it("creates at most one open Revision per stage", () => {
    resolve("RequestRevision", OPERATOR);
    // A second approval on the same stage must not open a second Revision.
    persistence.appendEvent(
      seedEvent({
        id: "evt-approval-2",
        type: "approval.requested",
        entityType: "Approval",
        entityId: "approval-2",
        payload: {
          approvalId: "approval-2",
          title: "Second gate",
          reason: "Another look",
          riskClass: "R1",
          evidenceIds: [],
          recommendedAction: "Approve",
        },
      }),
    );
    handler.submit(
      { commandType: "Approval.RequestRevision", entityId: "approval-2", params: {} },
      OPERATOR,
    );

    expect(persistence.listEntities<Revision>("revisions")).toHaveLength(1);
  });

  it("derives the Revision deterministically, so a replay reconstructs it identically", () => {
    resolve("RequestRevision", OPERATOR, { resolutionNote: "Needs a rollback plan" });
    const before = persistence.listEntities<Revision>("revisions");
    persistence.close();

    const reopened = new PersistenceService(dbPath);
    try {
      expect(reopened.listEntities<Revision>("revisions")).toEqual(before);
    } finally {
      reopened.close();
      persistence = new PersistenceService(dbPath);
    }
  });
});

describe("FBL-030 — audit completeness and durability", () => {
  it("records actor, timestamp, evidence, decision, stage, build, and resulting state", () => {
    resolve("Approve", OPERATOR, { resolutionNote: "Looks good" });
    const approval = persistence.getEntity<Approval>("approvals", APPROVAL);

    expect(approval?.resolvedBy).toBe("operator-1");
    expect(approval?.resolvedAt).toBeTruthy();
    expect(approval?.resolutionNote).toBe("Looks good");
    expect(approval?.status).toBe("approved");
    expect(approval?.stageId).toBe(STAGE);
    expect(approval?.buildId).toBe("build-1");
    expect(approval?.evidenceIds).toEqual(["artifact-build-package"]);
    expect(approval?.riskClass).toBe("R2");
    expect(approval?.requestedAt).toBeTruthy();

    // The event envelope carries the actor type the entity does not.
    const event = persistence.getAllEvents().find((e) => e.type === "approval.approved");
    expect(event?.actorType).toBe("operator");
    expect(event?.actorId).toBe("operator-1");
  });

  it("keeps a pending approval pending across a backend restart", () => {
    persistence.close();
    const reopened = new PersistenceService(dbPath);
    try {
      expect(reopened.getEntity<Approval>("approvals", APPROVAL)?.status).toBe("pending");
    } finally {
      reopened.close();
      persistence = new PersistenceService(dbPath);
    }
  });

  it("keeps a resolved approval and its resolver across a backend restart", () => {
    resolve("Approve", OPERATOR, { resolutionNote: "Ship it" });
    persistence.close();

    const reopened = new PersistenceService(dbPath);
    try {
      const approval = reopened.getEntity<Approval>("approvals", APPROVAL);
      expect(approval?.status).toBe("approved");
      expect(approval?.resolvedBy).toBe("operator-1");
      expect(approval?.resolutionNote).toBe("Ship it");
    } finally {
      reopened.close();
      persistence = new PersistenceService(dbPath);
    }
  });

  it("still refuses a conflicting resolution after a restart", () => {
    resolve("Approve", OPERATOR);
    persistence.close();

    persistence = new PersistenceService(dbPath);
    handler = new CommandHandler(persistence);
    expect(resolve("Reject", OPERATOR).accepted).toBe(false);
  });

  it("never auto-approves: an untouched approval stays pending indefinitely", () => {
    // Nothing but an explicit operator command may resolve the gate.
    for (let i = 0; i < 5; i += 1) {
      persistence.appendEvent(
        seedEvent({ id: `noise-${i}`, type: "system.started", entityId: "neighborhood-1" }),
      );
    }
    expect(persistence.getEntity<Approval>("approvals", APPROVAL)?.status).toBe("pending");
  });
});
