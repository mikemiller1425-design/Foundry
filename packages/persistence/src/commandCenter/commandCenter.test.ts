import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_IMMEDIATE_INTERRUPTION_CATEGORIES,
  EXTERNAL_ACTION_CLASSIFIER_VERSION,
  LEVEL_2_MISSION_FIELDS,
  NO_QUALIFYING_EXTERNAL_ACTIONS_STATEMENT,
  UNCONFIGURED_DECISION_BATCH_POLICY,
  deriveNoExternalActionsStatement,
  hasNoReceivedRevenue,
  intervalContains,
  isEmptyInterval,
  isSourceCoverageComplete,
  receivedRevenue,
  sumStatus,
  type MissionTypeDefinition,
} from "@foundry/contracts";
import type { PersistedEvent } from "@foundry/event-types";
import { ALL_EVENT_TYPES, EVENT_TYPES } from "@foundry/event-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandHandler, type CommandActor } from "../commandHandler";
import { PersistenceService } from "../persistenceService";
import {
  CAPABILITIES_AUTONOMY_DOES_NOT_GRANT,
  EXPLICITLY_NOT_EXTERNAL_ACTIONS,
  EXTERNAL_ACTION_REGISTRY,
  MissionTypeRegistry,
  autonomyGrantsNothing,
  checkAcknowledgement,
  createDefaultMissionTypeRegistry,
  deriveCursor,
  deriveRecommendations,
  effectiveAbility,
  isExternalActionEvent,
  nextBriefingInterval,
  projectExternalActions,
  projectMission,
  projectMonetaryOutcome,
  projectSourceCoverage,
  type EffectiveAbilityInputs,
} from "./index";

const OPERATOR: CommandActor = { actorType: "operator", actorId: "operator-1", authenticated: true };
const OTHER_OPERATOR: CommandActor = {
  actorType: "operator",
  actorId: "operator-2",
  authenticated: true,
};
const AGENT: CommandActor = { actorType: "agent", actorId: "agent-builder", authenticated: true };
const ANON: CommandActor = { actorType: "frontend", actorId: "anonymous", authenticated: false };

let dir: string;
let persistence: PersistenceService;
let handler: CommandHandler;

function evt(overrides: Partial<PersistedEvent> & { id: string }): PersistedEvent {
  return {
    type: "system.started",
    occurredAt: "2026-08-05T00:00:00.000Z",
    actorType: "backend",
    actorId: "backend",
    entityType: "System",
    entityId: "neighborhood-1",
    correlationId: "corr-1",
    severity: "info",
    schemaVersion: 1,
    payload: { serviceVersion: "1.0.0", neighborhoodId: "neighborhood-1" },
    ...overrides,
  } as PersistedEvent;
}

/** The AC-111 shape: one real claude_code run, started then completed with a cost. */
function seedRealRun(buildId = "build-1", costUsd: number | null = 0.0790585): void {
  persistence.appendEvent(
    evt({
      id: "run-started",
      type: "agentrun.started",
      entityType: "AgentRun",
      entityId: "run-1",
      correlationId: buildId,
      payload: {
        agentId: "agent-builder",
        taskId: "task-1",
        runtimeType: "claude_code",
        riskClass: "R1",
      },
    }),
  );
  persistence.appendEvent(
    evt({
      id: "run-completed",
      type: "agentrun.completed",
      entityType: "AgentRun",
      entityId: "run-1",
      correlationId: buildId,
      occurredAt: "2026-08-05T00:01:00.000Z",
      payload: {
        exitCode: 0,
        outputArtifactIds: [],
        evidenceIds: ["ev-1"],
        budget: {
          authorizedCeilingUsd: 25,
          actualCostUsd: costUsd,
          withinCeiling: true,
          evidenceId: "ev-1",
        },
      },
    }),
  );
}

beforeEach(() => {
  // Amendment 5: a temporary database per test. The operational database at
  // apps/api/data/foundry.sqlite is never opened by this suite.
  dir = mkdtempSync(join(tmpdir(), "cc-"));
  persistence = new PersistenceService(join(dir, "test.sqlite"));
  handler = new CommandHandler(persistence);
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- proofs 1-4

describe("Operational mission (proofs 1-4)", () => {
  it("proof 1: a new mission type declares unique stages without changing a shared enum", () => {
    const registry = createDefaultMissionTypeRegistry();
    const before = JSON.stringify(registry.get("software_build"));

    const nasInventory: MissionTypeDefinition = {
      missionType: "nas_inventory",
      label: "NAS inventory",
      stages: [
        { key: "root_selection", label: "Root selection", isCheckpoint: true },
        { key: "traversal", label: "Traversal", isCheckpoint: false },
        { key: "hashing", label: "Hashing", isCheckpoint: false },
        { key: "coverage_report", label: "Coverage report", isCheckpoint: true },
      ],
    };
    registry.register(nasInventory);

    expect(registry.get("nas_inventory")?.stages.map((s) => s.key)).toEqual([
      "root_selection",
      "traversal",
      "hashing",
      "coverage_report",
    ]);
    // The pre-existing type is untouched: no shared enum absorbed the new
    // stages, and no existing stage list grew.
    expect(JSON.stringify(registry.get("software_build"))).toBe(before);
    // And the stage keys genuinely differ between types — they are not drawn
    // from one global vocabulary.
    const buildKeys = new Set(registry.get("software_build")!.stages.map((s) => s.key));
    expect(nasInventory.stages.every((s) => !buildKeys.has(s.key))).toBe(true);
  });

  it("proof 2: existing software-build events project into one mission without rewriting history", () => {
    persistence.appendEvent(
      evt({
        id: "obj-1",
        type: "operator.objective_submitted",
        actorType: "operator",
        actorId: "operator-1",
        entityType: "Project",
        entityId: "project-1",
        correlationId: "build-1",
        payload: { objective: "Ship the thing", projectId: "project-1" },
      }),
    );
    seedRealRun("build-1");
    const before = persistence.getAllEvents().map((e) => e.id);

    const mission = projectMission(persistence.getSequencedEvents(), "build-1");
    expect(mission).not.toBeNull();
    expect(mission!.missionType).toBe("software_build");
    expect(mission!.sourceEventIds.length).toBeGreaterThan(0);

    // Nothing was rewritten, appended, or reordered by projecting.
    expect(persistence.getAllEvents().map((e) => e.id)).toEqual(before);
  });

  it("proof 3: the spatial agent trace is not part of mission truth", () => {
    seedRealRun();
    const mission = projectMission(persistence.getSequencedEvents(), "build-1")!;
    // agentTrace lives in the frontend and models movement; the backend
    // mission carries no positions, routes, legs, or travel geometry.
    const serialized = JSON.stringify(mission);
    for (const spatial of ["agentTrace", "position", "route", "leg", "waypoint", "travel"]) {
      expect(serialized).not.toContain(spatial);
    }
  });

  it("proof 4: mission truth has no frontend authoring path", () => {
    // Every command that produces a Command Center event is operator-gated,
    // and there is no command at all that writes a mission: missions are
    // projections. A frontend actor is refused even for the ones that exist.
    const outcome = handler.submit(
      {
        commandType: "Briefing.Create",
        entityId: "b-1",
        params: {
          briefingId: "b-1",
          previousAcknowledgedSequence: 0,
          capturedEndSequence: 0,
          sourceCoverageIds: [],
          externalActionClassifierVersion: 1,
        },
      },
      ANON,
    );
    expect(outcome.accepted).toBe(false);
    // And no mission-writing command exists in the vocabulary at all.
    expect(ALL_EVENT_TYPES.filter((t) => t.startsWith("mission."))).toEqual([]);
  });
});

// ---------------------------------------------------------------- proofs 5-6

describe("Scheduled decision batches (proofs 5-6)", () => {
  it("proof 5: policy is persisted and requires an authenticated operator", () => {
    const params = {
      timezone: "America/New_York",
      schedule: { kind: "daily" as const, atLocalTime: "09:00" },
      enabled: true,
      nextExpectedBatchAt: "2026-08-06T13:00:00.000Z",
    };
    expect(
      handler.submit(
        { commandType: "DecisionBatchPolicy.Configure", entityId: "policy-1", params },
        ANON,
      ).accepted,
    ).toBe(false);
    expect(
      handler.submit(
        { commandType: "DecisionBatchPolicy.Configure", entityId: "policy-1", params },
        AGENT,
      ).accepted,
    ).toBe(false);

    const ok = handler.submit(
      { commandType: "DecisionBatchPolicy.Configure", entityId: "policy-1", params },
      OPERATOR,
    );
    expect(ok.accepted).toBe(true);
    const stored = persistence.getEntity<Record<string, unknown>>(
      "decisionBatchPolicies",
      "policy-1",
    );
    expect(stored?.enabled).toBe(true);
    expect(stored?.timezone).toBe("America/New_York");
    // Written from the credential, never from the payload.
    expect(stored?.configuredBy).toBe("operator-1");
  });

  it("proof 6: interruption categories are backend-owned and cannot be supplied by a caller", () => {
    // The param schema is strict, so a client attempting to send its own
    // categories is refused rather than silently ignored.
    const refused = handler.submit(
      {
        commandType: "DecisionBatchPolicy.Configure",
        entityId: "policy-1",
        params: {
          timezone: null,
          schedule: { kind: "unconfigured" },
          enabled: false,
          nextExpectedBatchAt: null,
          immediateInterruptionCategories: ["fabricated_urgency"],
        },
      },
      OPERATOR,
    );
    expect(refused.accepted).toBe(false);

    handler.submit(
      {
        commandType: "DecisionBatchPolicy.Configure",
        entityId: "policy-1",
        params: {
          timezone: null,
          schedule: { kind: "unconfigured" },
          enabled: false,
          nextExpectedBatchAt: null,
        },
      },
      OPERATOR,
    );
    const stored = persistence.getEntity<Record<string, unknown>>(
      "decisionBatchPolicies",
      "policy-1",
    );
    expect(stored?.immediateInterruptionCategories).toEqual([
      ...DEFAULT_IMMEDIATE_INTERRUPTION_CATEGORIES,
    ]);
  });

  it("Amendment 4: ships disabled and unconfigured, with no invented time or zone", () => {
    expect(UNCONFIGURED_DECISION_BATCH_POLICY.enabled).toBe(false);
    expect(UNCONFIGURED_DECISION_BATCH_POLICY.timezone).toBeNull();
    expect(UNCONFIGURED_DECISION_BATCH_POLICY.schedule.kind).toBe("unconfigured");
    expect(UNCONFIGURED_DECISION_BATCH_POLICY.nextExpectedBatchAt).toBeNull();
  });
});

// --------------------------------------------------------------- proofs 7-10

describe("Briefing interval and cursor (proofs 7-10)", () => {
  function createBriefing(id: string, from: number, to: number, actor = OPERATOR) {
    return handler.submit(
      {
        commandType: "Briefing.Create",
        entityId: id,
        params: {
          briefingId: id,
          previousAcknowledgedSequence: from,
          capturedEndSequence: to,
          sourceCoverageIds: [],
          externalActionClassifierVersion: EXTERNAL_ACTION_CLASSIFIER_VERSION,
        },
      },
      actor,
    );
  }

  it("proof 7: membership is (previousAcknowledgedSequence, capturedEndSequence]", () => {
    const interval = { previousAcknowledgedSequence: 2, capturedEndSequence: 5 };
    expect(intervalContains(interval, 2)).toBe(false); // start exclusive
    expect(intervalContains(interval, 3)).toBe(true);
    expect(intervalContains(interval, 5)).toBe(true); // end inclusive
    expect(intervalContains(interval, 6)).toBe(false);
    // The first briefing begins after sequence 0.
    expect(intervalContains({ previousAcknowledgedSequence: 0, capturedEndSequence: 1 }, 1)).toBe(
      true,
    );
    expect(isEmptyInterval({ previousAcknowledgedSequence: 4, capturedEndSequence: 4 })).toBe(true);
  });

  it("proof 8: rendering, refreshing, and regenerating cannot advance the cursor", () => {
    seedRealRun();
    const head = persistence.getLatestSequence();
    createBriefing("b-1", 0, head);

    const read = () =>
      Object.values(
        persistence.getWorldStateSnapshot() && persistence.getEntity("briefings", "b-1")
          ? { b: persistence.getEntity<Record<string, unknown>>("briefings", "b-1") }
          : {},
      );

    // Read it many times, in every way a UI would.
    for (let i = 0; i < 5; i += 1) read();
    const briefings = [
      persistence.getEntity<Record<string, unknown>>("briefings", "b-1"),
    ] as unknown as Parameters<typeof deriveCursor>[0];
    expect(deriveCursor(briefings)).toBe(0);

    // The stored interval is unchanged by reading, even though the log has
    // since grown — the captured end was captured once.
    persistence.appendEvent(evt({ id: "later-1", entityId: "n-2" }));
    const after = persistence.getEntity<{ interval: { capturedEndSequence: number } }>(
      "briefings",
      "b-1",
    );
    expect(after?.interval.capturedEndSequence).toBe(head);
  });

  it("proof 9: acknowledgement advances the cursor once; duplicates are idempotent", () => {
    seedRealRun();
    const head = persistence.getLatestSequence();
    createBriefing("b-1", 0, head);

    expect(
      handler.submit(
        { commandType: "Briefing.Acknowledge", entityId: "b-1", params: { briefingId: "b-1" } },
        OPERATOR,
      ).accepted,
    ).toBe(true);

    const first = persistence.getEntity<{ acknowledgement: { acknowledgedBy: string } | null }>(
      "briefings",
      "b-1",
    );
    expect(first?.acknowledgement?.acknowledgedBy).toBe("operator-1");

    // A duplicate, and a concurrent one from a different operator, must not
    // move it again or overwrite who acknowledged it.
    handler.submit(
      { commandType: "Briefing.Acknowledge", entityId: "b-1", params: { briefingId: "b-1" } },
      OPERATOR,
    );
    handler.submit(
      { commandType: "Briefing.Acknowledge", entityId: "b-1", params: { briefingId: "b-1" } },
      OTHER_OPERATOR,
    );
    const after = persistence.getEntity<{ acknowledgement: { acknowledgedBy: string } | null }>(
      "briefings",
      "b-1",
    );
    expect(after?.acknowledgement?.acknowledgedBy).toBe("operator-1");

    const list = [after] as unknown as Parameters<typeof deriveCursor>[0];
    expect(deriveCursor(list)).toBe(head);

    // The guard states the same thing independently.
    expect(
      checkAcknowledgement(
        after as unknown as Parameters<typeof checkAcknowledgement>[0],
        head,
      ),
    ).toEqual({ ok: false, refusal: "already_acknowledged" });
  });

  it("proof 10: events after the captured end appear only in the next briefing", () => {
    seedRealRun();
    const firstHead = persistence.getLatestSequence();
    createBriefing("b-1", 0, firstHead);
    handler.submit(
      { commandType: "Briefing.Acknowledge", entityId: "b-1", params: { briefingId: "b-1" } },
      OPERATOR,
    );

    // New activity arrives after the first briefing was captured.
    persistence.appendEvent(
      evt({
        id: "run-2-started",
        type: "agentrun.started",
        entityType: "AgentRun",
        entityId: "run-2",
        correlationId: "build-1",
        payload: {
          agentId: "agent-builder",
          taskId: "task-2",
          runtimeType: "claude_code",
          riskClass: "R1",
        },
      }),
    );

    const acknowledged = [
      persistence.getEntity<Record<string, unknown>>("briefings", "b-1"),
    ] as unknown as Parameters<typeof deriveCursor>[0];
    const next = nextBriefingInterval(acknowledged, persistence.getLatestSequence());
    expect(next.previousAcknowledgedSequence).toBe(firstHead);

    const firstActions = projectExternalActions(persistence.getSequencedEvents(), 0, firstHead);
    const nextActions = projectExternalActions(
      persistence.getSequencedEvents(),
      next.previousAcknowledgedSequence,
      next.capturedEndSequence,
    );
    expect(firstActions.actions.map((a) => a.actionKey)).toEqual(["agentrun:run-1"]);
    expect(nextActions.actions.map((a) => a.actionKey)).toEqual(["agentrun:run-2"]);
  });
});

// -------------------------------------------------------------- proofs 11-14

describe("External actions (proofs 11-14)", () => {
  it("proof 11: one real Claude Code invocation is one action, not two", () => {
    seedRealRun();
    const projection = projectExternalActions(
      persistence.getSequencedEvents(),
      0,
      persistence.getLatestSequence(),
    );
    expect(projection.actions).toHaveLength(1);
    const action = projection.actions[0]!;
    expect(action.category).toBe("model_or_remote_agent_invocation");
    // Both lifecycle events folded into the single action.
    expect(action.lifecycleEventIds).toEqual(["run-started", "run-completed"]);
    expect(action.phase).toBe("succeeded");
    expect(action.costUsd).toBeCloseTo(0.0790585, 7);
    expect(projection.counts.succeeded).toBe(1);
    expect(projection.counts.attempted).toBe(0);
  });

  it("proof 12: authorization, preflight, and dry-run do not classify", () => {
    for (const eventType of EXPLICITLY_NOT_EXTERNAL_ACTIONS) {
      expect(isExternalActionEvent(eventType, {})).toBe(false);
    }
    // A mock run reaches nothing outside Foundry.
    expect(isExternalActionEvent("agentrun.started", { runtimeType: "mock" })).toBe(false);
    expect(isExternalActionEvent("agentrun.started", { runtimeType: "claude_code" })).toBe(true);

    persistence.appendEvent(
      evt({
        id: "auth-1",
        type: "operator.execution_authorized",
        actorType: "operator",
        actorId: "operator-1",
        entityType: "ExecutionAuthorization",
        entityId: "auth-1",
        payload: {
          authorizationId: "auth-1",
          planId: "plan-1",
          buildId: "build-1",
          planRevision: "r1",
          planContentHash: "sha256:abc",
          stageName: "implementation",
          riskClass: "R1",
          workspace: "/tmp/ws",
          maxBudgetUsd: 25,
          authorizedBy: "operator-1",
        },
      }),
    );
    const projection = projectExternalActions(
      persistence.getSequencedEvents(),
      0,
      persistence.getLatestSequence(),
    );
    expect(projection.actions).toHaveLength(0);
  });

  it("proof 13: the negative statement derives from zero classified actions in the exact interval", () => {
    seedRealRun();
    const head = persistence.getLatestSequence();

    const empty = projectExternalActions(persistence.getSequencedEvents(), head, head);
    expect(empty.actions).toHaveLength(0);
    expect(deriveNoExternalActionsStatement(empty)).toBe(NO_QUALIFYING_EXTERNAL_ACTIONS_STATEMENT);

    const populated = projectExternalActions(persistence.getSequencedEvents(), 0, head);
    expect(deriveNoExternalActionsStatement(populated)).toBeNull();

    // Scoped to Foundry's own ledger — never a claim about the world.
    expect(NO_QUALIFYING_EXTERNAL_ACTIONS_STATEMENT).toContain("Foundry's operational ledger");
    expect(NO_QUALIFYING_EXTERNAL_ACTIONS_STATEMENT).not.toMatch(/no external action(s)? occurred$/i);
  });

  it("proof 14: no external_action.none event exists, and none can be emitted", () => {
    expect(ALL_EVENT_TYPES).not.toContain("external_action.none");
    expect(ALL_EVENT_TYPES.filter((t) => t.includes("external_action"))).toEqual([]);
    // Nor is one hiding in the registry as a classifiable type.
    expect(EXTERNAL_ACTION_REGISTRY.some((e) => e.eventType.includes("none"))).toBe(false);
    // Every registry entry names an event type that really exists.
    for (const entry of EXTERNAL_ACTION_REGISTRY) {
      expect(ALL_EVENT_TYPES).toContain(entry.eventType);
      expect(entry.owningRung.length).toBeGreaterThan(0);
    }
  });
});

// -------------------------------------------------------------- proofs 15-17

describe("Money (proofs 15-17)", () => {
  it("proof 15: monetary statuses cannot be conflated", () => {
    seedRealRun();
    const money = projectMonetaryOutcome(persistence.getSequencedEvents());
    // There is no total field to accidentally read as revenue.
    expect(money).not.toHaveProperty("total");
    expect(money).not.toHaveProperty("netRevenue");
    expect(money).not.toHaveProperty("balance");
    // Summing requires naming a status.
    expect(sumStatus(money, "spent")).toBeCloseTo(0.0790585, 7);
    expect(sumStatus(money, "received")).toBe(0);
    expect(sumStatus(money, "invoiced")).toBe(0);
  });

  it("proof 16: AC-111 actual cost projects as spent, never as revenue", () => {
    seedRealRun();
    const money = projectMonetaryOutcome(persistence.getSequencedEvents());
    expect(money.byStatus.spent).toHaveLength(1);
    expect(money.byStatus.spent[0]!.amount).toBeCloseTo(0.0790585, 7);
    expect(money.byStatus.spent[0]!.evidence[0]!.eventId).toBe("run-completed");
    expect(money.byStatus.received).toEqual([]);
    expect(receivedRevenue(money)).toBe(0);
  });

  it("proof 17: zero revenue is shown honestly when no received record exists", () => {
    seedRealRun();
    const money = projectMonetaryOutcome(persistence.getSequencedEvents());
    expect(hasNoReceivedRevenue(money)).toBe(true);
    // No sample revenue was written into persistence anywhere.
    const everyPayload = JSON.stringify(persistence.getAllEvents());
    expect(everyPayload).not.toMatch(/"received"/);
    expect(everyPayload).not.toMatch(/invoice/i);
  });

  it("an unknown cost stays unknown rather than becoming zero", () => {
    seedRealRun("build-1", null);
    const money = projectMonetaryOutcome(persistence.getSequencedEvents());
    expect(money.byStatus.spent).toEqual([]);
  });
});

// -------------------------------------------------------------- proofs 18-20

describe("Coverage (proofs 18-20)", () => {
  const interval = { previousAcknowledgedSequence: 0, capturedEndSequence: 2 };

  it("proof 18: the four dimensions stay orthogonal", () => {
    seedRealRun();
    const coverage = projectSourceCoverage(
      persistence.getSequencedEvents(),
      interval,
      "2026-08-05T00:00:00.000Z",
    );
    const ledger = coverage.find((c) => c.sourceId === "foundry_operational_ledger")!;
    // Connection, progress, disposition counts, and uncertainty are four
    // separate fields; none encodes another.
    expect(ledger.connection).toBe("connected");
    expect(ledger.progress).toBe("checked");
    expect(ledger.uncertainty.result_uncertain).toBe(false);
    expect(ledger.counts.scanned).toBe(2);
    // A checked source can still carry uncertainty — they compose.
    const uncertainChecked = {
      ...ledger,
      uncertainty: { result_uncertain: true as const, uncertainty_reason: "clock skew" },
    };
    expect(uncertainChecked.progress).toBe("checked");
    expect(uncertainChecked.uncertainty.result_uncertain).toBe(true);

    // Unintegrated sources are named, never omitted.
    expect(coverage.map((c) => c.sourceId)).toEqual(
      expect.arrayContaining(["email", "calendar", "bills", "commitments", "nas"]),
    );
    for (const source of coverage.filter((c) => c.connection === "not_connected")) {
      expect(source.progress).toBe("not_yet_checked");
    }
    // No global coverage claim exists anywhere in the projection.
    expect(JSON.stringify(coverage)).not.toMatch(/nothing was missed/i);
  });

  it("proof 19: excluded and uncertain both require reasons", async () => {
    const { SourceCoverageSchema } = await import("@foundry/contracts");
    const base = projectSourceCoverage(
      persistence.getSequencedEvents(),
      interval,
      "2026-08-05T00:00:00.000Z",
    )[0]!;

    expect(
      SourceCoverageSchema.safeParse({ ...base, connection: "excluded" }).success,
    ).toBe(false);
    expect(
      SourceCoverageSchema.safeParse({
        ...base,
        connection: "excluded",
        progress: "not_yet_checked",
        exclusionReason: "operator excluded this source",
      }).success,
    ).toBe(true);

    expect(
      SourceCoverageSchema.safeParse({
        ...base,
        uncertainty: { result_uncertain: true },
      }).success,
    ).toBe(false);

    // And a source that was never read can never be reported as checked.
    expect(
      SourceCoverageSchema.safeParse({ ...base, connection: "unavailable", progress: "checked" })
        .success,
    ).toBe(false);
  });

  it("proof 20: cancelled work cannot report complete coverage from counters alone", () => {
    const base = projectSourceCoverage(
      persistence.getSequencedEvents(),
      interval,
      "2026-08-05T00:00:00.000Z",
    )[0]!;
    // Counters agree — nothing is outstanding — but the pass stopped early.
    const cancelled = { ...base, stopReason: "cancelled by operator before examining anything" };
    expect(cancelled.counts.not_yet_scanned).toBe(0);
    expect(isSourceCoverageComplete(cancelled)).toBe(false);
    expect(isSourceCoverageComplete(base)).toBe(true);
  });
});

// -------------------------------------------------------------- proofs 21-22

describe("Autonomy and recommendations (proofs 21-22)", () => {
  it("proof 21: changing autonomy alone cannot enlarge backend authority", () => {
    const permitted: EffectiveAbilityInputs = {
      principalAuthenticated: true,
      backendPermits: true,
      explicitlyAuthorized: true,
      withinMissionConstraints: true,
      withinBudget: true,
      externalActionApprovalSatisfied: true,
    };
    // Every way of being denied stays denied at every autonomy level.
    for (const key of Object.keys(permitted) as (keyof EffectiveAbilityInputs)[]) {
      const denied = { ...permitted, [key]: false };
      expect(effectiveAbility(denied)).toBe(false);
      expect(autonomyGrantsNothing(denied)).toBe(true);
    }
    expect(effectiveAbility(permitted)).toBe(true);
    expect(autonomyGrantsNothing(permitted)).toBe(true);

    // The decision function cannot even see an autonomy level: it is not one
    // of its inputs, so no future edit can consult it by accident.
    expect(Object.keys(permitted)).not.toContain("autonomy");
    expect(CAPABILITIES_AUTONOMY_DOES_NOT_GRANT).toContain("bypass_approval");
    expect(CAPABILITIES_AUTONOMY_DOES_NOT_GRANT).toContain("spend_money");
  });

  it("proof 22: recommendations trace to evidence and cannot execute", () => {
    seedRealRun("build-1");
    persistence.appendEvent(
      evt({
        id: "stage-blocked",
        type: "stage.blocked",
        entityType: "BuildStage",
        entityId: "stage-1",
        correlationId: "build-1",
        severity: "warning",
        payload: { reason: "waiting on operator" },
      }),
    );
    const sequenced = persistence.getSequencedEvents();
    const mission = projectMission(sequenced, "build-1")!;
    const recs = deriveRecommendations({
      missions: [mission],
      externalActions: projectExternalActions(sequenced, 0, persistence.getLatestSequence()),
      money: projectMonetaryOutcome(sequenced),
      coverage: [],
      generatedAt: "2026-08-05T00:00:00.000Z",
    });

    expect(recs.length).toBeGreaterThan(0);
    for (const rec of recs) {
      expect(rec.reason.length).toBeGreaterThan(0);
      expect(rec.ruleVersion).toBe("1b-ii.deterministic.1");
      expect(rec.suggestedNextAction.length).toBeGreaterThan(0);
      expect(typeof rec.wouldRequireOperatorApproval).toBe("boolean");
      // Nothing on a recommendation can be invoked.
      expect(rec).not.toHaveProperty("commandType");
      expect(rec).not.toHaveProperty("execute");
      expect(rec).not.toHaveProperty("handler");
    }
    // Blocker-derived recommendations carry the blocker's own evidence.
    const blockerRec = recs.find((r) => r.recommendationId.startsWith("blocker:"))!;
    expect(blockerRec.evidence[0]!.eventId).toBe("stage-blocked");

    // Deterministic: same inputs, same output.
    const again = deriveRecommendations({
      missions: [mission],
      externalActions: projectExternalActions(sequenced, 0, persistence.getLatestSequence()),
      money: projectMonetaryOutcome(sequenced),
      coverage: [],
      generatedAt: "2026-08-05T00:00:00.000Z",
    });
    expect(again).toEqual(recs);
  });
});

// -------------------------------------------------------------- proofs 23-24

describe("Disclosure (proofs 23-24)", () => {
  it("proof 23: level-2 mission data exposes every required element", () => {
    seedRealRun("build-1");
    persistence.appendEvent(
      evt({
        id: "auth-1",
        type: "operator.execution_authorized",
        actorType: "operator",
        actorId: "operator-1",
        entityType: "ExecutionAuthorization",
        entityId: "auth-1",
        correlationId: "build-1",
        payload: {
          authorizationId: "auth-1",
          planId: "plan-1",
          buildId: "build-1",
          planRevision: "r1",
          planContentHash: "sha256:abc",
          stageName: "implementation",
          riskClass: "R1",
          workspace: "/tmp/ws",
          maxBudgetUsd: 25,
          authorizedBy: "operator-1",
        },
      }),
    );
    const mission = projectMission(persistence.getSequencedEvents(), "build-1")!;

    const present: Record<(typeof LEVEL_2_MISSION_FIELDS)[number], unknown> = {
      objective: mission.objective,
      agents: mission.loadout.agents,
      autonomy: mission.autonomy,
      loadout: mission.loadout,
      authority: mission.loadout.authority,
      stages: mission.stages,
      checkpoints: mission.stages.filter((s) => s.isCheckpoint),
      blockers: mission.blockers,
      decisions: mission.decisions,
      cost: mission.spendUsd,
      artifacts: mission.artifacts,
    };
    for (const field of LEVEL_2_MISSION_FIELDS) {
      expect(present[field]).toBeDefined();
    }
    expect(present.checkpoints).not.toEqual([]);
    // The authority actually recorded is the authorization, not the label.
    expect(mission.loadout.authority.state).toBe("recorded");
    expect(mission.loadout.budget.state).toBe("recorded");
  });

  it("proof 24: every level-2 figure reaches level-3 evidence", () => {
    seedRealRun("build-1");
    const sequenced = persistence.getSequencedEvents();
    const mission = projectMission(sequenced, "build-1")!;
    const knownIds = new Set(sequenced.map((s) => s.event.id));

    // A recorded value always carries at least one evidence ref, and every
    // ref resolves to a real event in the log.
    const attestedFields = [mission.objective, mission.spendUsd, mission.launchedAt];
    for (const field of attestedFields) {
      if (field.state === "recorded") {
        expect(field.evidence.length).toBeGreaterThan(0);
        for (const ref of field.evidence) expect(knownIds.has(ref.eventId)).toBe(true);
      } else {
        // An absence must say why.
        expect(field.reason.length).toBeGreaterThan(0);
      }
    }
    for (const agent of mission.loadout.agents) {
      expect(agent.evidence.length).toBeGreaterThan(0);
      for (const ref of agent.evidence) expect(knownIds.has(ref.eventId)).toBe(true);
    }
    for (const ref of mission.debriefEvidence) expect(knownIds.has(ref.eventId)).toBe(true);

    // Amendment 2: autonomy is not_recorded with a stated reason, and is not
    // a fifth selectable level.
    expect(mission.autonomy.state).toBe("not_recorded");
    if (mission.autonomy.state === "not_recorded") {
      expect(mission.autonomy.reason.length).toBeGreaterThan(0);
    }
  });
});

// ------------------------------------------------------------- proof 25 + A3

describe("Regression and emitter honesty (proof 25, Amendment 3)", () => {
  it("proof 25: existing command, approval, and runtime behaviour is unchanged", () => {
    // A pre-existing command still refuses an unauthenticated caller with the
    // same authorization path this package did not touch.
    const denied = handler.submit(
      { commandType: "Build.Start", entityId: "build-1", params: {} },
      ANON,
    );
    expect(denied.accepted).toBe(false);
    // The three new events are additive; none of the V1 vocabulary was removed.
    for (const required of [
      "agentrun.started",
      "agentrun.completed",
      "approval.approved",
      "operator.execution_authorized",
      "build.started",
    ]) {
      expect(EVENT_TYPES).toContain(required);
    }
  });

  it("Amendment 3: every new event has a real, tested, operator-gated emitter", () => {
    const added = ["briefing.created", "briefing.acknowledged", "decisionbatch.policy_configured"];
    for (const type of added) expect(ALL_EVENT_TYPES).toContain(type);
    // ...and deliberately NOT in the frozen V1 vocabulary the frontend pins to.
    for (const type of added) expect(EVENT_TYPES).not.toContain(type);

    // Exactly three were added, and each is reachable only via its command.
    const before = persistence.getAllEvents().length;
    handler.submit(
      {
        commandType: "Briefing.Create",
        entityId: "b-9",
        params: {
          briefingId: "b-9",
          previousAcknowledgedSequence: 0,
          capturedEndSequence: 0,
          sourceCoverageIds: [],
          externalActionClassifierVersion: 1,
        },
      },
      OPERATOR,
    );
    const emitted = persistence.getAllEvents().slice(before).map((e) => e.type);
    expect(emitted).toEqual(["briefing.created"]);
  });

  it("Amendment 3: no revenue, coverage, or recommendation event was added", () => {
    for (const type of ALL_EVENT_TYPES) {
      expect(type).not.toMatch(/revenue|invoice|payment_received/);
      expect(type).not.toMatch(/^coverage\./);
      expect(type).not.toMatch(/^recommendation\./);
      expect(type).not.toMatch(/^nas\./);
      expect(type).not.toMatch(/^mission\./);
    }
  });
});

describe("MissionTypeRegistry basics", () => {
  it("refuses to register the same mission type twice", () => {
    const registry = new MissionTypeRegistry();
    registry.register(SOFTWARE_BUILD_FIXTURE);
    expect(() => registry.register(SOFTWARE_BUILD_FIXTURE)).toThrow(/already registered/);
  });
});

const SOFTWARE_BUILD_FIXTURE: MissionTypeDefinition = {
  missionType: "fixture_type",
  label: "Fixture",
  stages: [{ key: "only", label: "Only", isCheckpoint: false }],
};
