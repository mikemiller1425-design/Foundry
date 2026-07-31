import type { StageSummary } from "@/lib/mock-runtime/selectors";
import type { WorldState } from "@foundry/contracts";
import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "../mock-runtime/worldStateReducer";
import { computeOperationalBuildingStatus } from "./operationalBuildingState";

const OFFICE = "construction-office";
const WAREHOUSE = "warehouse";
const QA = "qa";

function stage(overrides: Partial<StageSummary> = {}): StageSummary {
  return {
    id: "stage-1",
    name: "frontend_implementation",
    status: "running",
    sourceBuildingId: OFFICE,
    ...overrides,
  };
}

describe("computeOperationalBuildingStatus — derived purely from real workflow state", () => {
  it("defaults to idle with no stage, transfer, or approval touching this building", () => {
    const state = createInitialWorldState();
    expect(computeOperationalBuildingStatus(OFFICE, state, [], false)).toBe("idle");
  });

  it("shows active while a stage is running/validating at this building", () => {
    const state = createInitialWorldState();
    expect(
      computeOperationalBuildingStatus(OFFICE, state, [stage({ status: "running" })], false),
    ).toBe("active");
    expect(
      computeOperationalBuildingStatus(
        QA,
        state,
        [stage({ sourceBuildingId: QA, status: "validating" })],
        false,
      ),
    ).toBe("active");
  });

  it("shows blocked while a stage is blocked at this building — the intentional failure window", () => {
    const state = createInitialWorldState();
    expect(
      computeOperationalBuildingStatus(OFFICE, state, [stage({ status: "blocked" })], false),
    ).toBe("blocked");
  });

  it("shows failed when a stage failed at this building", () => {
    const state = createInitialWorldState();
    expect(
      computeOperationalBuildingStatus(OFFICE, state, [stage({ status: "failed" })], false),
    ).toBe("failed");
  });

  it("shows waiting when a stage is ready (queued) at this building", () => {
    const state = createInitialWorldState();
    expect(
      computeOperationalBuildingStatus(OFFICE, state, [stage({ status: "ready" })], false),
    ).toBe("waiting");
  });

  it("shows active for the Warehouse when a transfer touches it, even with no stage there", () => {
    const state: WorldState = {
      ...createInitialWorldState(),
      activeTransfers: [
        {
          id: "t1",
          buildId: "b1",
          stageId: "s1",
          leg: "construction_office_to_warehouse",
          status: "in_transit",
          sourceBuildingId: OFFICE,
          destinationBuildingId: WAREHOUSE,
          artifactIds: [],
          vehicleId: "vehicle-utility-1",
          createdAt: "2026-07-30T00:00:00.000Z",
          updatedAt: "2026-07-30T00:00:00.000Z",
        },
      ],
    };
    expect(computeOperationalBuildingStatus(WAREHOUSE, state, [], false)).toBe("active");
  });

  it("shows upgrading for the Warehouse specifically while an upgrade is in progress", () => {
    const state = createInitialWorldState();
    expect(computeOperationalBuildingStatus(WAREHOUSE, state, [], true)).toBe("upgrading");
    // Not for any other building.
    expect(computeOperationalBuildingStatus(OFFICE, state, [], true)).toBe("idle");
  });

  it("shows waiting for QA specifically while an approval is pending", () => {
    const state: WorldState = {
      ...createInitialWorldState(),
      approvals: [
        {
          id: "a1",
          buildId: "b1",
          stageId: "s1",
          status: "pending",
          riskClass: "R1",
          title: "Approve deployment",
          reason: "QA passed",
          recommendedAction: "approve",
          evidenceIds: [],
          requestedAt: "2026-07-30T00:00:00.000Z",
        },
      ],
    };
    expect(computeOperationalBuildingStatus(QA, state, [], false)).toBe("waiting");
    expect(computeOperationalBuildingStatus(OFFICE, state, [], false)).toBe("idle");
  });

  it("a system health problem outranks routine building activity", () => {
    const running = createInitialWorldState();
    const degraded: WorldState = {
      ...running,
      health: { status: "degraded", reasons: ["agent_unreachable"] },
    };
    expect(
      computeOperationalBuildingStatus(OFFICE, degraded, [stage({ status: "running" })], false),
    ).toBe("degraded");

    const disconnected: WorldState = {
      ...running,
      health: { status: "disconnected", reasons: ["connection_lost"] },
    };
    expect(
      computeOperationalBuildingStatus(OFFICE, disconnected, [stage({ status: "running" })], false),
    ).toBe("disconnected");
  });
});
