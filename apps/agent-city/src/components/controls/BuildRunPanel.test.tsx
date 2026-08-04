import { BUILD_STAGE_SEQUENCE, type Build, type PersistedPlan } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { RuntimeContext, type RuntimeContextValue } from "@/lib/mock-runtime/RuntimeProvider";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { BuildRunPanel } from "./BuildRunPanel";

/**
 * AC-109 — the run panel.
 *
 * The property these tests exist to protect is that an operator cannot
 * come away believing Claude Code ran. Everything else here is ordinary
 * state rendering.
 */

const OBJECTIVE = "Add a JSON task store module with a test suite";

function build(status: Build["status"] = "planned"): Build {
  return {
    id: "build-1",
    projectId: "project-1",
    sequenceNumber: 1,
    status,
    objectiveSnapshot: OBJECTIVE,
    currentStageId: null,
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
  };
}

function persistedPlan(review: PersistedPlan["review"] = null): PersistedPlan {
  return {
    revision: "rev-abcd1234abcd1234",
    // AC-110: the backend-generated execution binding, always present on a
    // persisted plan. A literal here — the frontend never computes it.
    contentHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    review,
    authorization: null,
    createdAt: "2026-08-03T00:00:00.000Z",
    plan: {
      planId: "plan-1",
      projectId: "project-1",
      buildId: "build-1",
      objective: OBJECTIVE,
      workspace: "foundry_managed",
      riskClass: "R2",
      createdAt: "2026-08-03T00:00:00.000Z",
      stages: BUILD_STAGE_SEQUENCE.map((name, i) => ({
        name,
        sequence: i + 1,
        sourceBuildingId: "construction-office",
        destinationBuildingId: "construction-office",
        runtime: name === "backend_implementation" ? ("claude_code" as const) : ("mock" as const),
        required: true,
        requirements: [
          {
            name: `${name} complete`,
            description: "Stage work is done.",
            required: true,
            validatorType: "test",
            acceptanceCriteria: ["It completes with its stated work done."],
          },
        ],
      })),
    },
  };
}

const REVIEWED: PersistedPlan["review"] = {
  decision: "proceed",
  reviewedBy: "operator-1",
  reviewedAt: "2026-08-03T00:01:00.000Z",
  reviewedRevision: "rev-abcd1234abcd1234",
};

/** Minimal `stage.created` / `stage.started` events, in plan order. */
function stageEvents(count: number, started: number): FoundryEvent[] {
  const base = {
    occurredAt: "2026-08-03T00:02:00.000Z",
    actorType: "backend" as const,
    actorId: "backend",
    entityType: "BuildStage",
    correlationId: "build-1",
    severity: "info" as const,
    schemaVersion: 1,
  };
  const events: FoundryEvent[] = [];
  for (let i = 0; i < count; i += 1) {
    events.push({
      ...base,
      id: `created-${i}`,
      type: "stage.created",
      entityId: `plan-1--stage-${i}`,
      payload: {},
    } as FoundryEvent);
  }
  for (let i = 0; i < started; i += 1) {
    events.push({
      ...base,
      id: `started-${i}`,
      type: "stage.started",
      entityId: `plan-1--stage-${i}`,
      payload: { assignedAgentIds: ["agent-builder"], sourceBuildingId: "construction-office" },
    } as FoundryEvent);
  }
  return events;
}

function renderPanel(overrides: Partial<RuntimeContextValue> = {}) {
  const startBuildRun = vi.fn(async () => ({
    accepted: true,
    stepCount: 92,
    simulated: true,
    executor: "mock",
  }));
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RuntimeContext.Provider
        value={{
          runtimeMode: "backend",
          events: [],
          worldState: {
            ...createInitialWorldState(),
            currentBuild: build(),
            currentPlan: persistedPlan(REVIEWED),
          },
          isRunning: true,
          isComplete: false,
          connectionStatus: "connected",
          mutationsEnabled: true,
          submitCommand: vi.fn(),
          resolveApproval: vi.fn(),
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          lastRejection: null,
          startBuildRun,
          ...overrides,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  render(<BuildRunPanel />, { wrapper: Wrapper });
  return { startBuildRun };
}

function panelState(): string | null {
  return screen.getByTestId("build-run-panel").getAttribute("data-run-state");
}

describe("BuildRunPanel — the mock is never in small print", () => {
  it("states the run is simulated and names what is not invoked", () => {
    renderPanel();
    const statement = screen.getByTestId("run-mock-statement").textContent ?? "";
    expect(statement).toMatch(/simulated/i);
    expect(statement).toMatch(/mock executor/i);
    expect(statement).toMatch(/no Claude Code is invoked/i);
    expect(statement).toMatch(/no money is spent/i);
  });

  it("says the claude_code-allocated stage is executed by the mock in this rung", () => {
    renderPanel();
    const allocation = screen.getByTestId("run-claude-allocation").textContent ?? "";
    expect(allocation).toMatch(/Backend implementation/);
    expect(allocation).toMatch(/executed by the mock/i);
    expect(allocation).toMatch(/separate single-use authorization/i);
  });

  it("marks the allocated stage row itself, so it is visible while that stage runs", () => {
    renderPanel({ events: stageEvents(4, 4) });
    const row = screen
      .getAllByTestId("run-stage")
      .find((node) => node.getAttribute("data-stage-name") === "backend_implementation");
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain("mock (planned: claude_code)");
  });

  it("labels the run control as the mock executor, not as execution", () => {
    renderPanel();
    const control = screen.getByTestId("run-start").textContent ?? "";
    expect(control).toMatch(/mock executor/i);
    expect(control).toMatch(/Nothing is executed/i);
  });
});

describe("BuildRunPanel — distinguishable states", () => {
  it("renders nothing in mock mode", () => {
    renderPanel({ runtimeMode: "mock" });
    expect(screen.queryByTestId("build-run-panel")).toBeNull();
  });

  it.each([
    ["unreachable", { connectionStatus: "disconnected" as const }],
    ["no-build", { worldState: { ...createInitialWorldState(), currentBuild: null } }],
    [
      "no-plan",
      { worldState: { ...createInitialWorldState(), currentBuild: build(), currentPlan: null } },
    ],
    [
      "awaiting-review",
      {
        worldState: {
          ...createInitialWorldState(),
          currentBuild: build(),
          currentPlan: persistedPlan(null),
        },
      },
    ],
    [
      "not-proceeding",
      {
        worldState: {
          ...createInitialWorldState(),
          currentBuild: build(),
          currentPlan: persistedPlan({ ...REVIEWED, decision: "rejected" }),
        },
      },
    ],
    ["ready", {}],
    [
      "running",
      {
        worldState: {
          ...createInitialWorldState(),
          currentBuild: build("running"),
          currentPlan: persistedPlan(REVIEWED),
        },
      },
    ],
    [
      "at-gate",
      {
        worldState: {
          ...createInitialWorldState(),
          currentBuild: build("waiting_for_approval"),
          currentPlan: persistedPlan(REVIEWED),
        },
      },
    ],
  ])("renders the %s state", (expected, overrides) => {
    renderPanel(overrides as Partial<RuntimeContextValue>);
    expect(panelState()).toBe(expected);
  });

  it("offers the run control when the build is startable", () => {
    renderPanel();
    expect(screen.getByTestId("run-start")).toBeTruthy();
  });

  it.each([
    ["running", build("running")],
    ["waiting_for_approval", build("waiting_for_approval")],
    ["completed", build("completed")],
  ])("withholds the run control once the build is %s — a build is started once", (_label, current) => {
    renderPanel({
      worldState: {
        ...createInitialWorldState(),
        currentBuild: current,
        currentPlan: persistedPlan(REVIEWED),
      },
    });
    expect(screen.queryByTestId("run-start")).toBeNull();
  });

  it("says the run stopped at the gate, and that resolving does not carry it past", () => {
    renderPanel({
      worldState: {
        ...createInitialWorldState(),
        currentBuild: build("waiting_for_approval"),
        currentPlan: persistedPlan(REVIEWED),
      },
    });
    const text = screen.getByTestId("run-at-gate").textContent ?? "";
    expect(text).toMatch(/Stopped at the approval gate/i);
    expect(text).toMatch(/has not been created/i);
    expect(text).toMatch(/not implemented in this rung/i);
  });
});

describe("BuildRunPanel — starting a run", () => {
  it("calls the backend and reports what it answered", async () => {
    const { startBuildRun } = renderPanel();
    fireEvent.click(screen.getByTestId("run-start"));
    await waitFor(() => expect(startBuildRun).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const accepted = screen.getByTestId("run-accepted").textContent ?? "";
      expect(accepted).toContain("92");
      expect(accepted).toContain("mock");
    });
  });

  it("renders a refusal with its reason and corrective action — never silently", async () => {
    renderPanel({
      startBuildRun: vi.fn(async () => ({
        accepted: false,
        code: "not_startable",
        reason: "Plan plan-1 has not been reviewed.",
        correctiveAction: "Read the plan and record a decision on it.",
      })),
    });
    fireEvent.click(screen.getByTestId("run-start"));
    await waitFor(() => {
      const rejection = screen.getByTestId("run-rejection").textContent ?? "";
      expect(rejection).toContain("has not been reviewed");
      expect(rejection).toContain("Read the plan and record a decision on it.");
    });
  });

  it("disables the control and says why when no credential is held", () => {
    renderPanel({
      credentialState: {
        kind: "absent",
        label: "No credential",
        explanation: "This browser holds no operator credential.",
        action: "Supply one in the Operator credential panel.",
        needsCredential: true,
      },
    });
    expect(screen.getByTestId("run-start").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("run-blocked").textContent).toMatch(/operator credential/i);
  });
});
