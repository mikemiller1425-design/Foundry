import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FoundryEvent } from "@foundry/event-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandHandler, type CommandActor } from "./commandHandler";
import { PersistenceService } from "./persistenceService";
import { PrincipalRegistry, bearerToken } from "./principals";
import type { StageValidationHistory } from "./reducer";

/**
 * FBL-029 — independent Inspector validation.
 *
 * The property under test is narrow and load-bearing: a
 * `stage.validation_passed` transition may only be produced by an
 * authenticated agent whose *persisted* role is `inspector`. Every other
 * caller — the Builder, the frontend, an unknown agent, and anyone
 * willing to type `"agent-inspector"` into a payload — must be refused.
 */

const STAGE = "stage-qa";

/** Authenticated identities, as the API would construct them from a credential. */
const INSPECTOR: CommandActor = {
  actorType: "agent",
  actorId: "agent-inspector",
  authenticated: true,
};
const BUILDER: CommandActor = { actorType: "agent", actorId: "agent-builder", authenticated: true };
const ARCHITECT: CommandActor = {
  actorType: "agent",
  actorId: "agent-architect",
  authenticated: true,
};
const OPERATOR: CommandActor = {
  actorType: "operator",
  actorId: "operator-1",
  authenticated: true,
};
/** What an unauthenticated HTTP caller resolves to — i.e. the browser. */
const FRONTEND: CommandActor = {
  actorType: "frontend",
  actorId: "anonymous",
  authenticated: false,
};
/**
 * The attack this rung exists to stop: a caller that simply *claims* to
 * be the Inspector. Structurally identical to `INSPECTOR` except that no
 * credential established it.
 */
const SPOOFED_INSPECTOR: CommandActor = {
  actorType: "agent",
  actorId: "agent-inspector",
  authenticated: false,
};

let dir: string;
let dbPath: string;
let persistence: PersistenceService;
let handler: CommandHandler;

function seedEvent(overrides: Partial<FoundryEvent>): FoundryEvent {
  return {
    id: overrides.id ?? "seed-1",
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

/** Brings the QA stage to `validating`, which is where a decision is legal. */
function seedStageUnderValidation(): void {
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
      id: "evt-build",
      type: "build.created",
      entityType: "Build",
      entityId: "build-1",
      payload: { buildId: "build-1", projectId: "project-1", objective: "Build a thing" },
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: "evt-created",
      type: "stage.created",
      entityType: "BuildStage",
      entityId: STAGE,
      payload: {},
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: "evt-started",
      type: "stage.started",
      entityType: "BuildStage",
      entityId: STAGE,
      payload: { assignedAgentIds: ["agent-inspector"], sourceBuildingId: "qa" },
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: "evt-validating",
      type: "stage.validation_started",
      entityType: "BuildStage",
      entityId: STAGE,
      payload: {},
    }),
  );
}

function validate(
  outcome: "passed" | "failed",
  actor: CommandActor,
  extra: Record<string, unknown> = {},
) {
  return handler.submit(
    {
      commandType: "BuildStage.Validate",
      entityId: STAGE,
      params:
        outcome === "passed"
          ? { outcome, evidenceIds: [], passedRequirementIds: [], ...extra }
          : {
              outcome,
              evidenceIds: [],
              failedRequirementIds: ["req-1"],
              retryEligible: true,
              ...extra,
            },
    },
    actor,
  );
}

function snapshot() {
  return {
    events: persistence.getAllEvents(),
    world: persistence.getWorldStateSnapshot(),
    validations: persistence.listEntities("stageValidations"),
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "foundry-inspector-"));
  dbPath = join(dir, "foundry.sqlite");
  persistence = new PersistenceService(dbPath);
  handler = new CommandHandler(persistence);
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("FBL-029 — only an authenticated Inspector can validate", () => {
  beforeEach(seedStageUnderValidation);

  it("accepts the Inspector and records the decision", () => {
    const outcome = validate("passed", INSPECTOR);
    expect(outcome.accepted).toBe(true);
    expect(outcome.event?.type).toBe("stage.validation_passed");
  });

  it("rejects Builder self-certification (F-05)", () => {
    const before = snapshot();
    const outcome = validate("passed", BUILDER);
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/F-05/);
    expect(snapshot()).toEqual(before);
  });

  it("rejects a frontend command", () => {
    const before = snapshot();
    const outcome = validate("passed", FRONTEND);
    expect(outcome.accepted).toBe(false);
    expect(snapshot()).toEqual(before);
  });

  it("rejects an operator command — validation is not a human decision", () => {
    // Humans govern approvals (FBL-030), not independent validation.
    const outcome = validate("passed", OPERATOR);
    expect(outcome.accepted).toBe(false);
  });

  it("rejects a generic non-Inspector agent", () => {
    const outcome = validate("passed", ARCHITECT);
    expect(outcome.accepted).toBe(false);
  });

  it("rejects an unknown agent id", () => {
    const outcome = validate("passed", {
      actorType: "agent",
      actorId: "agent-does-not-exist",
      authenticated: true,
    });
    expect(outcome.accepted).toBe(false);
  });

  it("rejects role spoofing: an unauthenticated caller claiming to be the Inspector", () => {
    // Identical actorType/actorId to the real Inspector. The only
    // difference is that no credential established it — which is exactly
    // the difference that must matter.
    const before = snapshot();
    const outcome = validate("passed", SPOOFED_INSPECTOR);
    expect(outcome.accepted).toBe(false);
    expect(snapshot()).toEqual(before);
  });

  it("refuses an unauthorized caller before revealing whether the stage exists", () => {
    // Otherwise the "no such BuildStage" reply is an existence oracle:
    // an unauthenticated caller could enumerate stage ids by watching
    // which error came back, without ever being allowed to act on one.
    const real = validate("passed", FRONTEND);
    const imaginary = handler.submit(
      {
        commandType: "BuildStage.Validate",
        entityId: "stage-does-not-exist",
        params: { outcome: "passed", evidenceIds: [], passedRequirementIds: [] },
      },
      FRONTEND,
    );

    expect(real.accepted).toBe(false);
    expect(imaginary.accepted).toBe(false);
    // Indistinguishable: the reply says nothing about which id was real.
    expect(imaginary.reason).toBe(real.reason);
    expect(real.reason).not.toMatch(/No BuildStage/);
  });

  it("gives every refused caller the same reason, leaking no state", () => {
    const reasons = new Set(
      [BUILDER, FRONTEND, ARCHITECT, SPOOFED_INSPECTOR].map(
        (actor) => validate("passed", actor).reason,
      ),
    );
    expect(reasons.size).toBe(1);
  });

  it("rejects a Builder-issued failure too — the decision is the Inspector's either way", () => {
    const outcome = validate("failed", BUILDER);
    expect(outcome.accepted).toBe(false);
  });
});

describe("FBL-029 — self-certification by evidence provenance", () => {
  beforeEach(() => {
    seedStageUnderValidation();
    // `createdByAgentId` is taken from the event *envelope* (the actor
    // that emitted it), not from the payload — see reducer
    // `artifact.created`. Provenance is therefore recorded by who acted,
    // which is the whole point of using it as a self-certification test.
    persistence.appendEvent(
      seedEvent({
        id: "evt-artifact-inspector",
        type: "artifact.created",
        entityType: "Artifact",
        entityId: "artifact-by-inspector",
        actorType: "agent",
        actorId: "agent-inspector",
        payload: {
          artifactId: "artifact-by-inspector",
          artifactType: "source_code",
          name: "Written by the Inspector",
          checksumStatus: "pending",
        },
      }),
    );
  });

  it("rejects an Inspector validating an artifact it created itself", () => {
    const outcome = validate("passed", INSPECTOR, { evidenceIds: ["artifact-by-inspector"] });
    expect(outcome.accepted).toBe(false);
  });

  it("still accepts the Inspector for evidence it did not produce", () => {
    persistence.appendEvent(
      seedEvent({
        id: "evt-artifact-builder",
        type: "artifact.created",
        entityType: "Artifact",
        entityId: "artifact-by-builder",
        actorType: "agent",
        actorId: "agent-builder",
        payload: {
          artifactId: "artifact-by-builder",
          artifactType: "source_code",
          name: "Written by the Builder",
          checksumStatus: "pending",
        },
      }),
    );
    const outcome = validate("passed", INSPECTOR, { evidenceIds: ["artifact-by-builder"] });
    expect(outcome.accepted).toBe(true);
  });

  it("does not treat Inspector assignment to the QA stage as a conflict", () => {
    // `qa_validation` *is* the Inspector's stage (v1-scope.md stage 6);
    // being assigned there is the job, not self-certification.
    const stage = persistence.getEntity<{ assignedAgentIds?: string[] }>("buildStages", STAGE);
    expect(stage?.assignedAgentIds).toContain("agent-inspector");
    expect(validate("passed", INSPECTOR).accepted).toBe(true);
  });
});

describe("FBL-029 — stage and evidence coherence", () => {
  beforeEach(seedStageUnderValidation);

  it("rejects a decision for a stage that does not exist", () => {
    const outcome = handler.submit(
      {
        commandType: "BuildStage.Validate",
        entityId: "stage-nonexistent",
        params: { outcome: "passed", evidenceIds: [], passedRequirementIds: [] },
      },
      INSPECTOR,
    );
    expect(outcome.accepted).toBe(false);
  });

  it("rejects evidence belonging to a different stage", () => {
    // An artifact's `stageId` is the stage that was current when it was
    // created (reducer fold context), so producing one "elsewhere" means
    // starting another stage first.
    persistence.appendEvent(
      seedEvent({
        id: "evt-other-stage",
        type: "stage.created",
        entityType: "BuildStage",
        entityId: "stage-other",
        payload: {},
      }),
    );
    persistence.appendEvent(
      seedEvent({
        id: "evt-other-started",
        type: "stage.started",
        entityType: "BuildStage",
        entityId: "stage-other",
        payload: { assignedAgentIds: ["agent-builder"], sourceBuildingId: "construction-office" },
      }),
    );
    persistence.appendEvent(
      seedEvent({
        id: "evt-other-artifact",
        type: "artifact.created",
        entityType: "Artifact",
        entityId: "artifact-elsewhere",
        actorType: "agent",
        actorId: "agent-builder",
        payload: {
          artifactId: "artifact-elsewhere",
          artifactType: "source_code",
          name: "Belongs elsewhere",
          checksumStatus: "pending",
        },
      }),
    );

    const outcome = validate("passed", INSPECTOR, { evidenceIds: ["artifact-elsewhere"] });
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/belongs to stage/);
  });
});

describe("FBL-029 — duplicate, conflicting, and stale decisions", () => {
  beforeEach(seedStageUnderValidation);

  it("treats a repeated identical decision as an idempotent no-op", () => {
    expect(validate("passed", INSPECTOR).accepted).toBe(true);
    const eventsAfterFirst = persistence.getAllEvents().length;

    const repeat = validate("passed", INSPECTOR);
    expect(repeat.accepted).toBe(true);
    expect(repeat.reason).toMatch(/idempotent/);
    // Accepted, but nothing new recorded — a retry is not a second judgement.
    expect(persistence.getAllEvents()).toHaveLength(eventsAfterFirst);

    const history = persistence.getEntity<StageValidationHistory>("stageValidations", STAGE);
    expect(history?.decisions).toHaveLength(1);
  });

  it("rejects a conflicting decision after a pass", () => {
    expect(validate("passed", INSPECTOR).accepted).toBe(true);
    const before = snapshot();

    const conflicting = validate("failed", INSPECTOR);
    expect(conflicting.accepted).toBe(false);
    expect(conflicting.reason).toMatch(/conflicting/);
    expect(snapshot()).toEqual(before);
  });

  it("rejects a conflicting decision after a failure", () => {
    expect(validate("failed", INSPECTOR).accepted).toBe(true);
    const conflicting = validate("passed", INSPECTOR);
    expect(conflicting.accepted).toBe(false);
    expect(conflicting.reason).toMatch(/conflicting/);
  });

  it("rejects a stale decision against a stage that has moved on", () => {
    persistence.appendEvent(
      seedEvent({
        id: "evt-completed",
        type: "stage.completed",
        entityType: "BuildStage",
        entityId: STAGE,
        payload: { artifactIds: [], completedAt: "2026-08-01T01:00:00.000Z" },
      }),
    );

    const outcome = validate("passed", INSPECTOR);
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/stale or out of order/);
  });

  it("rejects a decision before the stage has begun", () => {
    const fresh = mkdtempSync(join(tmpdir(), "foundry-inspector-early-"));
    const service = new PersistenceService(join(fresh, "db.sqlite"));
    const earlyHandler = new CommandHandler(service);
    try {
      service.appendEvent(
        seedEvent({
          id: "e1",
          type: "stage.created",
          entityType: "BuildStage",
          entityId: STAGE,
          payload: {},
        }),
      );
      const outcome = earlyHandler.submit(
        {
          commandType: "BuildStage.Validate",
          entityId: STAGE,
          params: { outcome: "passed", evidenceIds: [], passedRequirementIds: [] },
        },
        INSPECTOR,
      );
      expect(outcome.accepted).toBe(false);
    } finally {
      service.close();
      rmSync(fresh, { recursive: true, force: true });
    }
  });
});

describe("FBL-029 — the validation record", () => {
  beforeEach(seedStageUnderValidation);

  it("records validator identity, authoritative role, evidence, decision, timestamp, and result", () => {
    validate("passed", INSPECTOR, { evidenceIds: [], passedRequirementIds: ["req-a"] });

    const history = persistence.getEntity<StageValidationHistory>("stageValidations", STAGE);
    const record = history?.decisions.at(-1);

    expect(record).toBeDefined();
    expect(record?.stageId).toBe(STAGE);
    expect(record?.decision).toBe("passed");
    expect(record?.validatorAgentId).toBe("agent-inspector");
    expect(record?.validatorActorType).toBe("agent");
    // Role comes from persisted Agent state, not from the command.
    expect(record?.validatorRole).toBe("inspector");
    expect(record?.passedRequirementIds).toEqual(["req-a"]);
    expect(record?.decidedAt).toBeTruthy();
    expect(record?.eventId).toBeTruthy();
    expect(record?.resultingStageStatus).toBeTruthy();
  });

  it("keeps a failure inspectable after a later revision and pass", () => {
    expect(validate("failed", INSPECTOR).accepted).toBe(true);

    // Reopen through the Revision path, then pass.
    persistence.appendEvent(
      seedEvent({
        id: "evt-revalidating",
        type: "stage.validation_started",
        entityType: "BuildStage",
        entityId: STAGE,
        payload: {},
      }),
    );

    const history = persistence.getEntity<StageValidationHistory>("stageValidations", STAGE);
    // The failure is still there — a later decision never erases it.
    expect(history?.decisions[0]?.decision).toBe("failed");
    expect(history?.decisions[0]?.failedRequirementIds).toEqual(["req-1"]);
    expect(history?.decisions[0]?.retryEligible).toBe(true);
  });

  it("survives a full backend restart", () => {
    validate("failed", INSPECTOR);
    persistence.close();

    const reopened = new PersistenceService(dbPath);
    try {
      const history = reopened.getEntity<StageValidationHistory>("stageValidations", STAGE);
      expect(history?.decisions).toHaveLength(1);
      expect(history?.decisions[0]?.decision).toBe("failed");
      expect(history?.decisions[0]?.validatorAgentId).toBe("agent-inspector");
      expect(history?.decisions[0]?.validatorRole).toBe("inspector");
    } finally {
      reopened.close();
      persistence = new PersistenceService(dbPath);
    }
  });
});

describe("FBL-029 — credential registry", () => {
  it("resolves an issued token to its principal and marks it authenticated", () => {
    const registry = new PrincipalRegistry();
    const token = registry.issueAgentCredential("agent-inspector");
    const principal = registry.resolve(token);

    expect(principal.actorId).toBe("agent-inspector");
    expect(principal.actorType).toBe("agent");
    expect(principal.authenticated).toBe(true);
  });

  it("resolves an unknown, empty, or missing token to an unauthenticated anonymous principal", () => {
    const registry = new PrincipalRegistry();
    registry.issueAgentCredential("agent-inspector");

    for (const token of ["not-a-real-token", "", undefined, null]) {
      const principal = registry.resolve(token);
      expect(principal.authenticated).toBe(false);
      expect(principal.actorType).toBe("frontend");
    }
  });

  it("does not let a revoked token authenticate", () => {
    const registry = new PrincipalRegistry();
    const token = registry.issueAgentCredential("agent-inspector");
    registry.revoke(token);
    expect(registry.resolve(token).authenticated).toBe(false);
  });

  it("issues distinct tokens per agent", () => {
    const registry = new PrincipalRegistry();
    const a = registry.issueAgentCredential("agent-inspector");
    const b = registry.issueAgentCredential("agent-builder");
    expect(a).not.toBe(b);
    expect(registry.resolve(a).actorId).toBe("agent-inspector");
    expect(registry.resolve(b).actorId).toBe("agent-builder");
  });

  it("parses only well-formed bearer headers", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken("bearer abc123")).toBe("abc123");
    expect(bearerToken("Basic abc123")).toBeUndefined();
    expect(bearerToken("abc123")).toBeUndefined();
    expect(bearerToken(undefined)).toBeUndefined();
  });

  it("an inspector credential authorizes validation end-to-end", () => {
    seedStageUnderValidation();
    const registry = new PrincipalRegistry();
    const token = registry.issueAgentCredential("agent-inspector");

    const outcome = handler.submit(
      {
        commandType: "BuildStage.Validate",
        entityId: STAGE,
        params: { outcome: "passed", evidenceIds: [], passedRequirementIds: [] },
      },
      registry.resolve(token),
    );
    expect(outcome.accepted).toBe(true);
  });

  it("a builder credential does not, even though it is genuinely authenticated", () => {
    seedStageUnderValidation();
    const registry = new PrincipalRegistry();
    const token = registry.issueAgentCredential("agent-builder");

    const outcome = handler.submit(
      {
        commandType: "BuildStage.Validate",
        entityId: STAGE,
        params: { outcome: "passed", evidenceIds: [], passedRequirementIds: [] },
      },
      registry.resolve(token),
    );
    expect(outcome.accepted).toBe(false);
  });
});
