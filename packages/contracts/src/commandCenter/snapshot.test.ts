import { describe, expect, it } from "vitest";
import {
  CommandCenterSnapshotSchema,
  LEVEL_2_MISSION_FIELDS,
  isRecorded,
  type Attested,
  type CommandCenterSnapshot,
} from "./index";

/**
 * Proof 11 — the consumer boundary.
 *
 * This file imports **only** `@foundry/contracts`. It never reaches into
 * `@foundry/persistence`, and it reimplements no projection: it parses a
 * response body and reads it, which is exactly what Package 1b-iii will do.
 *
 * If a required Command Center field could not be reached this way, the
 * frontend would have to either import the backend or derive the value itself
 * — and deriving it is precisely what the 1b-iii gate forbids.
 */

/** A response body of the shape the transport serves. */
const RESPONSE: CommandCenterSnapshot = {
  snapshotVersion: "command-center-v1",
  observedAt: "2026-08-05T00:00:00.000Z",
  latestSequence: 4,
  externalActionClassifierVersion: 1,
  missions: [
    {
      missionId: "build-1",
      missionType: "software_build",
      missionTypeLabel: "Software build",
      objective: {
        state: "recorded",
        value: "Ship the thing",
        evidence: [{ eventId: "obj-1", eventType: "operator.objective_submitted" }],
      },
      loadout: {
        agents: [
          {
            agentId: "agent-builder",
            role: { state: "not_recorded", reason: "no event recorded a role" },
            evidence: [{ eventId: "run-started", eventType: "agentrun.started" }],
          },
        ],
        authority: {
          state: "recorded",
          value: { authorizationId: "auth-1", scope: "implementation" },
          evidence: [{ eventId: "auth-1", eventType: "operator.execution_authorized" }],
        },
        budget: {
          state: "recorded",
          value: { authorizedCeilingUsd: 25, currency: "USD" },
          evidence: [{ eventId: "auth-1", eventType: "operator.execution_authorized" }],
        },
        constraints: { state: "not_recorded", reason: "historical builds carry no constraints" },
      },
      launchedAt: { state: "not_recorded", reason: "no build.started event was recorded" },
      stages: [
        {
          key: "validation",
          label: "Validation",
          isCheckpoint: true,
          status: "not_recorded",
          evidence: [],
        },
      ],
      blockers: [],
      decisions: [],
      outcome: "in_progress",
      debriefEvidence: [{ eventId: "run-completed", eventType: "agentrun.completed" }],
      autonomy: { state: "not_recorded", reason: "no persisted event records an autonomy level" },
      spendUsd: {
        state: "recorded",
        value: 0.0790585,
        evidence: [{ eventId: "run-completed", eventType: "agentrun.completed" }],
      },
      artifacts: [],
      sourceEventIds: ["obj-1", "run-started", "run-completed"],
    },
  ],
  briefing: {
    record: {
      briefingId: "brief-1",
      interval: { previousAcknowledgedSequence: 0, capturedEndSequence: 4 },
      createdAt: "2026-08-05T00:00:00.000Z",
      acknowledgement: null,
      sourceCoverageIds: [],
      externalActionClassifierVersion: 1,
    },
    cursor: 0,
    proposedNextInterval: { previousAcknowledgedSequence: 0, capturedEndSequence: 4 },
    intervalIsEmpty: false,
  },
  decisionBatchPolicy: {
    timezone: null,
    schedule: { kind: "unconfigured" },
    nextExpectedBatchAt: null,
    enabled: false,
    immediateInterruptionCategories: ["urgent_deadline"],
    configuredAt: null,
    configuredBy: null,
  },
  externalActions: {
    projection: {
      classifierVersion: 1,
      fromSequenceExclusive: 0,
      toSequenceInclusive: 4,
      actions: [
        {
          actionKey: "agentrun:run-1",
          category: "model_or_remote_agent_invocation",
          phase: "succeeded",
          firstObservedAt: "2026-08-05T00:00:00.000Z",
          lastObservedAt: "2026-08-05T00:01:00.000Z",
          costUsd: 0.0790585,
          evidence: [{ eventId: "run-started", eventType: "agentrun.started" }],
          lifecycleEventIds: ["run-started", "run-completed"],
        },
      ],
      counts: { attempted: 0, running: 0, succeeded: 1, failed: 0, cancelled: 0 },
    },
    noQualifyingActionsStatement: null,
  },
  money: {
    outcome: {
      currency: "USD",
      byStatus: {
        projected: [],
        quoted: [],
        invoiced: [],
        received: [],
        spent: [
          {
            recordId: "spend:run-completed",
            status: "spent",
            currency: "USD",
            amount: 0.0790585,
            evidence: [{ eventId: "run-completed", eventType: "agentrun.completed" }],
            recordedAt: "2026-08-05T00:01:00.000Z",
            responsibleEntityType: "AgentRun",
            responsibleEntityId: "run-1",
          },
        ],
        refunded: [],
      },
    },
    hasNoReceivedRevenue: true,
    noReceivedRevenueStatement: "No received revenue is recorded in Foundry's operational ledger.",
  },
  coverage: [
    {
      sourceId: "email",
      sourceLabel: "Email",
      declaredScope: "Not integrated",
      declaredInterval: "(0, 4] by event sequence",
      connection: "not_connected",
      progress: "not_yet_checked",
      uncertainty: { result_uncertain: false },
      counts: {
        scanned: 0,
        skipped: 0,
        refused: 0,
        inaccessible: 0,
        unsupported: 0,
        not_yet_scanned: 0,
      },
      observedAt: "2026-08-05T00:00:00.000Z",
    },
  ],
  recommendations: [],
};

describe("proof 11 — a consumer reads every required field using contracts alone", () => {
  /**
   * The boundary is proven structurally rather than by inspecting text: this
   * file lives in `@foundry/contracts`, which does not depend on
   * `@foundry/persistence` and has no Node type definitions. An import of the
   * backend here would fail to resolve, so the fact that this suite compiles
   * and runs *is* the proof. The dependency itself is asserted in
   * `apps/api/src/commandCenter/commandCenterTransport.test.ts`.
   */

  it("the response parses against the published schema", () => {
    expect(CommandCenterSnapshotSchema.safeParse(RESPONSE).success).toBe(true);
  });

  it("every level-2 mission field is reachable without deriving anything", () => {
    const snapshot = CommandCenterSnapshotSchema.parse(RESPONSE);
    const mission = snapshot.missions[0]!;
    const reachable: Record<(typeof LEVEL_2_MISSION_FIELDS)[number], unknown> = {
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
    for (const field of LEVEL_2_MISSION_FIELDS) expect(reachable[field]).toBeDefined();
    expect(reachable.checkpoints).toHaveLength(1);
  });

  it("every level-2 figure carries level-3 evidence, or a stated reason", () => {
    const snapshot = CommandCenterSnapshotSchema.parse(RESPONSE);
    const mission = snapshot.missions[0]!;
    const attestedFields: Attested<unknown>[] = [
      mission.objective,
      mission.spendUsd,
      mission.launchedAt,
    ];
    for (const field of attestedFields) {
      if (isRecorded(field)) expect(field.evidence.length).toBeGreaterThan(0);
      else expect(field.reason.length).toBeGreaterThan(0);
    }
    // Absences are legible to a consumer without consulting the backend.
    expect(mission.autonomy.state).toBe("not_recorded");
    expect(snapshot.coverage[0]!.connection).toBe("not_connected");
    expect(snapshot.money.hasNoReceivedRevenue).toBe(true);
    expect(snapshot.briefing.record?.acknowledgement).toBeNull();
  });

  it("the snapshot version is pinned so a client can refuse a shape it was not built for", () => {
    expect(
      CommandCenterSnapshotSchema.safeParse({ ...RESPONSE, snapshotVersion: "command-center-v2" })
        .success,
    ).toBe(false);
  });
});
