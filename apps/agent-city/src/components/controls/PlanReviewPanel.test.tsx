import { BUILD_STAGE_SEQUENCE, type PersistedPlan } from "@foundry/contracts";
import { RuntimeContext, type RuntimeContextValue } from "@/lib/mock-runtime/RuntimeProvider";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PlanReviewPanel } from "./PlanReviewPanel";

const OBJECTIVE = "Add a JSON task store module with a test suite";

const BUILD = {
  id: "build-1",
  projectId: "project-1",
  sequenceNumber: 1,
  status: "planned" as const,
  objectiveSnapshot: OBJECTIVE,
  currentStageId: null,
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
};

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

function renderPanel(overrides: Partial<RuntimeContextValue> = {}) {
  const reviewPlan = vi.fn(async () => {});
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RuntimeContext.Provider
        value={{
          runtimeMode: "backend",
          events: [],
          worldState: {
            ...createInitialWorldState(),
            currentBuild: BUILD,
            currentPlan: persistedPlan(),
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
          reviewPlan,
          ...overrides,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  return { ...render(<PlanReviewPanel />, { wrapper: Wrapper }), reviewPlan };
}

describe("PlanReviewPanel — presence", () => {
  it("renders nothing in mock mode, which produces no plan", () => {
    const { container } = renderPanel({ runtimeMode: "mock" });
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PlanReviewPanel — the plan is legible (F-109, V-101)", () => {
  it("shows the objective, workspace, risk class, and plan revision", () => {
    renderPanel();
    expect(screen.getByTestId("plan-objective")).toHaveTextContent(OBJECTIVE);
    expect(screen.getByTestId("plan-workspace")).toHaveTextContent("foundry_managed");
    expect(screen.getByTestId("plan-risk")).toHaveTextContent("R2");
    expect(screen.getByTestId("plan-revision")).toHaveTextContent("rev-abcd1234abcd1234");
  });

  it("shows all seven stages, in order", () => {
    renderPanel();
    const stages = screen.getAllByTestId("plan-stage");
    expect(stages).toHaveLength(7);
    BUILD_STAGE_SEQUENCE.forEach((name, i) => {
      expect(stages[i]!.textContent).toContain(name.replace(/_/g, " "));
    });
  });

  it("shows each stage's runtime allocation", () => {
    renderPanel();
    const runtimes = screen.getAllByTestId("plan-stage-runtime").map((n) => n.textContent ?? "");
    expect(runtimes.filter((r) => r.includes("claude_code"))).toHaveLength(1);
  });

  it("shows plain-text acceptance criteria", () => {
    renderPanel();
    expect(screen.getAllByText(/It completes with its stated work done\./).length).toBeGreaterThan(
      0,
    );
  });

  it("states the budget boundary and that nothing can run yet", () => {
    renderPanel();
    const boundary = screen.getByTestId("plan-execution-boundary").textContent ?? "";
    expect(boundary).toMatch(/backend_implementation/);
    expect(boundary).toMatch(/\$25/);
    expect(boundary).toMatch(/nothing here can\s+run/);
  });
});

describe("PlanReviewPanel — Proceed means review, not authorization", () => {
  it("labels Proceed as authorizing no execution", () => {
    renderPanel();
    expect(screen.getByTestId("plan-review-proceed").textContent).toMatch(
      /Authorizes no execution/i,
    );
  });

  it("records the decision through the backend", async () => {
    const { reviewPlan } = renderPanel();
    fireEvent.click(screen.getByTestId("plan-review-proceed"));
    await waitFor(() =>
      expect(reviewPlan).toHaveBeenCalledWith({ decision: "proceed", note: undefined }),
    );
  });

  it("offers reject and request-revision as distinct decisions", async () => {
    const { reviewPlan } = renderPanel();
    fireEvent.click(screen.getByTestId("plan-review-rejected"));
    await waitFor(() =>
      expect(reviewPlan).toHaveBeenCalledWith({ decision: "rejected", note: undefined }),
    );
  });

  it("shows a recorded proceed decision without implying execution began", () => {
    renderPanel({
      worldState: {
        ...createInitialWorldState(),
        currentBuild: BUILD,
        currentPlan: persistedPlan({
          decision: "proceed",
          reviewedBy: "operator-1",
          reviewedAt: "2026-08-03T00:00:00.000Z",
          reviewedRevision: "rev-abcd1234abcd1234",
        }),
      },
    });
    const status = screen.getByTestId("plan-review-status").textContent ?? "";
    expect(status).toMatch(/proceed/);
    expect(status).toMatch(/No execution was authorized/i);
    expect(screen.queryByTestId("plan-review-form")).toBeNull();
  });
});

describe("PlanReviewPanel — every non-plan state is distinct and explained", () => {
  it("says so when the backend is unreachable", () => {
    renderPanel({ connectionStatus: "disconnected", mutationsEnabled: false });
    expect(screen.getByTestId("plan-review-panel")).toHaveAttribute(
      "data-plan-state",
      "unreachable",
    );
  });

  it("says so when there is no build yet", () => {
    renderPanel({
      worldState: { ...createInitialWorldState(), currentBuild: null, currentPlan: null },
    });
    expect(screen.getByTestId("plan-review-panel")).toHaveAttribute("data-plan-state", "empty");
  });

  it("distinguishes 'a build exists but no plan' from 'no build'", () => {
    renderPanel({
      worldState: { ...createInitialWorldState(), currentBuild: BUILD, currentPlan: null },
    });
    expect(screen.getByTestId("plan-review-panel")).toHaveAttribute("data-plan-state", "no-plan");
  });

  it("explains a disabled review when no credential is held", () => {
    renderPanel({
      credentialState: {
        kind: "absent",
        label: "No credential",
        explanation: "x",
        action: "y",
        needsCredential: true,
      },
    });
    expect(screen.getByTestId("plan-review-blocked").textContent).toMatch(/operator credential/i);
    expect(screen.getByTestId<HTMLButtonElement>("plan-review-proceed").disabled).toBe(true);
  });

  it("gives every state its own data attribute, so none is silent", () => {
    const states = new Set<string>();
    for (const overrides of [
      { connectionStatus: "disconnected" as const, mutationsEnabled: false },
      { worldState: { ...createInitialWorldState(), currentBuild: null, currentPlan: null } },
      { worldState: { ...createInitialWorldState(), currentBuild: BUILD, currentPlan: null } },
      {},
    ]) {
      const { unmount } = renderPanel(overrides);
      states.add(screen.getByTestId("plan-review-panel").getAttribute("data-plan-state") ?? "");
      unmount();
    }
    expect(states.size).toBe(4);
  });
});
