import { describe, expect, it } from "vitest";
import {
  AutonomyLevelSchema,
  BriefingIntervalSchema,
  DecisionBatchPolicySchema,
  MissionAutonomySchema,
  MonetaryOutcomeSchema,
  RecommendationSchema,
  SourceCoverageSchema,
  UNCONFIGURED_DECISION_BATCH_POLICY,
  UncertaintySchema,
  absent,
  attested,
  evidenceOf,
  isRecorded,
  mayAdvanceCursor,
  recorded,
} from "./index";
import { z } from "zod";

const EVIDENCE = [{ eventId: "e-1", eventType: "agentrun.completed" }];

describe("Attested — evidence-bearing presence and absence (Amendment 2)", () => {
  const schema = attested(z.string());

  it("a recorded value cannot exist without evidence", () => {
    expect(schema.safeParse({ state: "recorded", value: "x", evidence: [] }).success).toBe(false);
    expect(schema.safeParse({ state: "recorded", value: "x", evidence: EVIDENCE }).success).toBe(
      true,
    );
    expect(() => recorded("x", [])).toThrow(/at least one EvidenceRef/);
  });

  it("an absence must state a reason", () => {
    expect(schema.safeParse({ state: "not_recorded" }).success).toBe(false);
    expect(schema.safeParse({ state: "not_recorded", reason: "never captured" }).success).toBe(true);
    expect(schema.safeParse({ state: "not_available", reason: "source not connected" }).success).toBe(
      true,
    );
  });

  it("distinguishes a permanent absence from an unreachable one", () => {
    const never = absent<string>("not_recorded", "the field did not exist when this was written");
    const unreachable = absent<string>("not_available", "the source is not connected");
    expect(never.state).toBe("not_recorded");
    expect(unreachable.state).toBe("not_available");
    expect(isRecorded(never)).toBe(false);
    expect(evidenceOf(never)).toEqual([]);
    expect(evidenceOf(recorded("x", EVIDENCE))).toEqual(EVIDENCE);
  });
});

describe("Autonomy (Amendment 2)", () => {
  it("has exactly four levels, and not_recorded is not one of them", () => {
    expect(AutonomyLevelSchema.options).toEqual([
      "prepare",
      "approve",
      "supervise",
      "manage_exceptions",
    ]);
    expect(AutonomyLevelSchema.safeParse("not_recorded").success).toBe(false);
    expect(AutonomyLevelSchema.safeParse("not_available").success).toBe(false);
  });

  it("not_recorded is a projection state carrying a reason, not a selectable level", () => {
    expect(MissionAutonomySchema.safeParse({ state: "not_recorded" }).success).toBe(false);
    expect(
      MissionAutonomySchema.safeParse({ state: "not_recorded", reason: "predates the concept" })
        .success,
    ).toBe(true);
    expect(
      MissionAutonomySchema.safeParse({ state: "recorded", level: "supervise", evidence: [] })
        .success,
    ).toBe(false);
    expect(
      MissionAutonomySchema.safeParse({
        state: "recorded",
        level: "supervise",
        evidence: EVIDENCE,
      }).success,
    ).toBe(true);
  });
});

describe("Coverage — negative schema tests (C-3.1)", () => {
  const base = {
    sourceId: "s",
    sourceLabel: "S",
    declaredScope: "scope",
    declaredInterval: "(0, 5]",
    connection: "connected" as const,
    progress: "checked" as const,
    uncertainty: { result_uncertain: false as const },
    counts: {
      scanned: 1,
      skipped: 0,
      refused: 0,
      inaccessible: 0,
      unsupported: 0,
      not_yet_scanned: 0,
    },
    observedAt: "2026-08-05T00:00:00.000Z",
  };

  it("an excluded source without a reason is unrepresentable", () => {
    expect(
      SourceCoverageSchema.safeParse({ ...base, connection: "excluded", progress: "not_yet_checked" })
        .success,
    ).toBe(false);
  });

  it("uncertain without a reason is unrepresentable", () => {
    expect(UncertaintySchema.safeParse({ result_uncertain: true }).success).toBe(false);
    expect(
      UncertaintySchema.safeParse({ result_uncertain: true, uncertainty_reason: "skew" }).success,
    ).toBe(true);
  });

  it("unavailable, not_connected, and excluded can never be reported as checked", () => {
    for (const connection of ["unavailable", "not_connected", "excluded"] as const) {
      expect(SourceCoverageSchema.safeParse({ ...base, connection, progress: "checked" }).success).toBe(
        false,
      );
    }
  });

  it("coverage always names its source, scope, and interval", () => {
    expect(SourceCoverageSchema.safeParse({ ...base, declaredScope: "" }).success).toBe(false);
    expect(SourceCoverageSchema.safeParse({ ...base, declaredInterval: "" }).success).toBe(false);
    expect(SourceCoverageSchema.safeParse({ ...base, sourceId: "" }).success).toBe(false);
  });
});

describe("Money — statuses cannot be conflated", () => {
  it("the outcome has no aggregate field to misread as revenue", () => {
    const parsed = MonetaryOutcomeSchema.parse({
      currency: "USD",
      byStatus: {
        projected: [],
        quoted: [],
        invoiced: [],
        received: [],
        spent: [],
        refunded: [],
      },
    });
    expect(Object.keys(parsed)).toEqual(["currency", "byStatus"]);
    expect(Object.keys(parsed.byStatus)).toEqual([
      "projected",
      "quoted",
      "invoiced",
      "received",
      "spent",
      "refunded",
    ]);
  });

  it("an amount cannot exist without currency, evidence, or a responsible entity", () => {
    const record = {
      recordId: "r-1",
      status: "spent" as const,
      currency: "USD",
      amount: 1,
      evidence: EVIDENCE,
      recordedAt: "2026-08-05T00:00:00.000Z",
      responsibleEntityType: "AgentRun",
      responsibleEntityId: "run-1",
    };
    const outcome = (over: Record<string, unknown>) =>
      MonetaryOutcomeSchema.safeParse({
        currency: "USD",
        byStatus: {
          projected: [],
          quoted: [],
          invoiced: [],
          received: [],
          spent: [{ ...record, ...over }],
          refunded: [],
        },
      }).success;
    expect(outcome({})).toBe(true);
    expect(outcome({ evidence: [] })).toBe(false);
    expect(outcome({ currency: "US" })).toBe(false);
    expect(outcome({ responsibleEntityId: "" })).toBe(false);
  });
});

describe("Briefing interval (C-7)", () => {
  it("the captured end may not precede the acknowledged start", () => {
    expect(
      BriefingIntervalSchema.safeParse({
        previousAcknowledgedSequence: 5,
        capturedEndSequence: 4,
      }).success,
    ).toBe(false);
    expect(
      BriefingIntervalSchema.safeParse({
        previousAcknowledgedSequence: 5,
        capturedEndSequence: 5,
      }).success,
    ).toBe(true);
  });

  it("the cursor may not skip forward or move backward", () => {
    const briefing = {
      briefingId: "b-1",
      interval: { previousAcknowledgedSequence: 3, capturedEndSequence: 8 },
      createdAt: "2026-08-05T00:00:00.000Z",
      acknowledgement: null,
      sourceCoverageIds: [],
      externalActionClassifierVersion: 1,
    };
    expect(mayAdvanceCursor(3, briefing)).toBe(true);
    // A cursor that is not where this briefing starts would skip or replay.
    expect(mayAdvanceCursor(0, briefing)).toBe(false);
    expect(mayAdvanceCursor(5, briefing)).toBe(false);
  });
});

describe("Decision-batch policy (Amendment 4)", () => {
  it("ships disabled, unconfigured, with no invented time or timezone", () => {
    expect(DecisionBatchPolicySchema.safeParse(UNCONFIGURED_DECISION_BATCH_POLICY).success).toBe(
      true,
    );
    expect(UNCONFIGURED_DECISION_BATCH_POLICY.enabled).toBe(false);
    expect(UNCONFIGURED_DECISION_BATCH_POLICY.timezone).toBeNull();
  });

  it("cannot be enabled before a schedule and timezone are chosen", () => {
    expect(
      DecisionBatchPolicySchema.safeParse({
        ...UNCONFIGURED_DECISION_BATCH_POLICY,
        enabled: true,
      }).success,
    ).toBe(false);
    expect(
      DecisionBatchPolicySchema.safeParse({
        ...UNCONFIGURED_DECISION_BATCH_POLICY,
        enabled: true,
        timezone: "America/New_York",
        schedule: { kind: "daily", atLocalTime: "09:00" },
        nextExpectedBatchAt: "2026-08-06T13:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("an unconfigured schedule cannot predict a next batch", () => {
    expect(
      DecisionBatchPolicySchema.safeParse({
        ...UNCONFIGURED_DECISION_BATCH_POLICY,
        nextExpectedBatchAt: "2026-08-06T13:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

describe("Recommendations cannot execute", () => {
  it("requires reason, evidence, rule version, and a stated approval cost", () => {
    const valid = {
      recommendationId: "r-1",
      reason: "because",
      evidence: EVIDENCE,
      supportingEntities: [],
      generatedAt: "2026-08-05T00:00:00.000Z",
      ruleVersion: "1b-ii.deterministic.1",
      confidence: { kind: "deterministic" as const },
      suggestedNextAction: "look at it",
      wouldRequireOperatorApproval: false,
    };
    expect(RecommendationSchema.safeParse(valid).success).toBe(true);
    expect(RecommendationSchema.safeParse({ ...valid, evidence: [] }).success).toBe(false);
    expect(RecommendationSchema.safeParse({ ...valid, reason: "" }).success).toBe(false);
    expect(RecommendationSchema.safeParse({ ...valid, ruleVersion: "" }).success).toBe(false);

    // Parsing strips anything execution-shaped: the type has no such field.
    const parsed = RecommendationSchema.parse({ ...valid, commandType: "Build.Start" });
    expect(parsed).not.toHaveProperty("commandType");
  });

  it("an uncertain recommendation must say why", () => {
    expect(
      RecommendationSchema.safeParse({
        recommendationId: "r-1",
        reason: "because",
        evidence: EVIDENCE,
        supportingEntities: [],
        generatedAt: "2026-08-05T00:00:00.000Z",
        ruleVersion: "v",
        confidence: { kind: "uncertain" },
        suggestedNextAction: "look",
        wouldRequireOperatorApproval: false,
      }).success,
    ).toBe(false);
  });
});
