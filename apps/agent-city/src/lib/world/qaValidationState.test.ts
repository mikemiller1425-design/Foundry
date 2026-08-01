import type { StageSummary } from "@/lib/mock-runtime/selectors";
import type { FoundryEvent } from "@foundry/event-types";
import { describe, expect, it } from "vitest";
import { selectStages } from "../mock-runtime/selectors";
import { createInitialWorldState } from "../mock-runtime/worldStateReducer";
import { computeOperationalBuildingStatus } from "./operationalBuildingState";
import { OPERATIONAL_BUILDING_VISUALS } from "./operationalBuildingVisuals";

/**
 * FBL-029 — the QA building follows backend validation authority.
 *
 * `event-model.md` is explicit that `stage.validation_failed` renders QA
 * **red**. That is a stronger statement than "blocked": the two are
 * different colours and mean different things — blocked is an obstacle,
 * red is a rejection. `BuildStageStatus` has no value for "an Inspector
 * rejected this", so the decision is carried alongside the status and
 * checked first.
 */

const QA = "qa";

function stage(overrides: Partial<StageSummary> = {}): StageSummary {
  return {
    id: "stage-qa",
    name: "qa_validation",
    status: "validating",
    sourceBuildingId: QA,
    ...overrides,
  };
}

function event(overrides: Partial<FoundryEvent>): FoundryEvent {
  return {
    id: "e",
    type: "stage.created",
    occurredAt: "2026-08-01T00:00:00.000Z",
    actorType: "agent",
    actorId: "agent-inspector",
    entityType: "BuildStage",
    entityId: "stage-1",
    correlationId: "c",
    severity: "info",
    schemaVersion: 1,
    payload: {},
    ...overrides,
  } as FoundryEvent;
}

describe("QA world state follows backend validation authority", () => {
  it("renders red — not merely blocked — when independent validation failed", () => {
    const state = createInitialWorldState();
    const status = computeOperationalBuildingStatus(
      QA,
      state,
      [stage({ status: "blocked", validationDecision: "failed" })],
      false,
    );

    expect(status).toBe("failed");
    // The declared red, asserted as a colour rather than a status name.
    expect(OPERATIONAL_BUILDING_VISUALS[status].color).toBe("#ef4444");
  });

  it("distinguishes a validation failure from an ordinary block", () => {
    const state = createInitialWorldState();
    const blocked = computeOperationalBuildingStatus(
      QA,
      state,
      [stage({ status: "blocked", blockedReason: "Waiting on a prerequisite" })],
      false,
    );

    expect(blocked).toBe("blocked");
    expect(OPERATIONAL_BUILDING_VISUALS[blocked].color).not.toBe(
      OPERATIONAL_BUILDING_VISUALS.failed.color,
    );
  });

  it("shows active, not red, while validation is merely in progress", () => {
    const state = createInitialWorldState();
    expect(
      computeOperationalBuildingStatus(QA, state, [stage({ status: "validating" })], false),
    ).toBe("active");
  });

  it("stops showing red once the stage completes after a passing re-validation", () => {
    const state = createInitialWorldState();
    // A completed stage is not among the statuses that mark a building
    // busy, so QA falls back to idle rather than staying red forever.
    const status = computeOperationalBuildingStatus(
      QA,
      state,
      [stage({ status: "completed", validationDecision: "passed" })],
      false,
    );
    expect(status).not.toBe("failed");
  });

  it("a disconnected backend outranks a stale red", () => {
    // Frontend state is not authoritative: losing the backend must not
    // keep asserting a validation verdict.
    const state = createInitialWorldState();
    const disconnected = { ...state, health: { ...state.health, status: "disconnected" as const } };
    expect(
      computeOperationalBuildingStatus(
        QA,
        disconnected,
        [stage({ status: "blocked", validationDecision: "failed" })],
        false,
      ),
    ).toBe("disconnected");
  });
});

describe("stage selectors carry the backend's validation decision", () => {
  const created = event({ type: "stage.created", entityId: "stage-1", payload: {} });

  it("records a failure decision from stage.validation_failed", () => {
    const stages = selectStages([
      created,
      event({
        id: "e2",
        type: "stage.validation_failed",
        entityId: "stage-1",
        payload: { failedRequirementIds: ["req-1"], evidenceIds: [], retryEligible: true },
      }),
    ]);

    expect(stages[0]?.validationDecision).toBe("failed");
    expect(stages[0]?.status).toBe("blocked");
    expect(stages[0]?.blockedReason).toBe("Independent validation failed");
  });

  it("records a pass decision from stage.validation_passed", () => {
    const stages = selectStages([
      created,
      event({
        id: "e2",
        type: "stage.validation_passed",
        entityId: "stage-1",
        payload: { evidenceIds: [], passedRequirementIds: ["req-1"] },
      }),
    ]);

    expect(stages[0]?.validationDecision).toBe("passed");
  });

  it("carries no decision before the Inspector has ruled", () => {
    const stages = selectStages([
      created,
      event({ id: "e2", type: "stage.validation_started", entityId: "stage-1", payload: {} }),
    ]);

    expect(stages[0]?.validationDecision).toBeUndefined();
    expect(stages[0]?.status).toBe("validating");
  });

  it("reflects the latest decision when a stage is re-validated after repair", () => {
    const stages = selectStages([
      created,
      event({
        id: "e2",
        type: "stage.validation_failed",
        entityId: "stage-1",
        payload: { failedRequirementIds: ["req-1"], evidenceIds: [], retryEligible: true },
      }),
      event({ id: "e3", type: "stage.validation_started", entityId: "stage-1", payload: {} }),
      event({
        id: "e4",
        type: "stage.validation_passed",
        entityId: "stage-1",
        payload: { evidenceIds: [], passedRequirementIds: ["req-1"] },
      }),
    ]);

    expect(stages[0]?.validationDecision).toBe("passed");
  });
});
