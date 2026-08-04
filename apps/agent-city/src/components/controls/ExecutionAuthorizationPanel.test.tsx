import {
  BUILD_STAGE_SEQUENCE,
  CLAUDE_CODE_STAGE,
  type Build,
  type ExecutionAuthorization,
  type PersistedPlan,
} from "@foundry/contracts";
import { RuntimeContext, type RuntimeContextValue } from "@/lib/mock-runtime/RuntimeProvider";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import type { ExecutionGateReport } from "@/lib/backend/executionGate";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ExecutionAuthorizationPanel } from "./ExecutionAuthorizationPanel";

/**
 * AC-110 — the authorization panel.
 *
 * The property these tests protect is that an operator cannot come away
 * believing something ran, and cannot authorize without seeing what the
 * permission binds to.
 */

const OBJECTIVE = "Add a JSON task store module with a test suite";
const HASH = "sha256:1111111111111111111111111111111111111111111111111111111111111111";

const BUILD: Build = {
  id: "build-1",
  projectId: "project-1",
  sequenceNumber: 1,
  status: "planned",
  objectiveSnapshot: OBJECTIVE,
  currentStageId: null,
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
};

const REVIEWED: PersistedPlan["review"] = {
  decision: "proceed",
  reviewedBy: "operator-1",
  reviewedAt: "2026-08-04T00:01:00.000Z",
  reviewedRevision: "rev-abcd1234abcd1234",
};

const AUTHORIZATION: ExecutionAuthorization = {
  authorizationId: "plan-1--authorization",
  planId: "plan-1",
  planRevision: "rev-abcd1234abcd1234",
  planContentHash: HASH,
  projectId: "project-1",
  buildId: "build-1",
  stageName: CLAUDE_CODE_STAGE,
  workspace: "foundry_managed",
  riskClass: "R2",
  maxBudgetUsd: 5,
  authorizedBy: "operator-1",
  authorizedAt: "2026-08-04T00:02:00.000Z",
  singleUse: true,
};

function persistedPlan(
  review: PersistedPlan["review"] = REVIEWED,
  authorization: ExecutionAuthorization | null = null,
  allMock = false,
): PersistedPlan {
  return {
    revision: "rev-abcd1234abcd1234",
    contentHash: HASH,
    review,
    authorization,
    createdAt: "2026-08-04T00:00:00.000Z",
    plan: {
      planId: "plan-1",
      projectId: "project-1",
      buildId: "build-1",
      objective: OBJECTIVE,
      workspace: "foundry_managed",
      riskClass: "R2",
      createdAt: "2026-08-04T00:00:00.000Z",
      stages: BUILD_STAGE_SEQUENCE.map((name, i) => ({
        name,
        sequence: i + 1,
        sourceBuildingId: "construction-office",
        destinationBuildingId: "construction-office",
        runtime:
          !allMock && name === CLAUDE_CODE_STAGE ? ("claude_code" as const) : ("mock" as const),
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

function gateReport(overrides: Partial<ExecutionGateReport> = {}): ExecutionGateReport {
  return {
    buildId: "build-1",
    stageName: CLAUDE_CODE_STAGE,
    permitted: false,
    executed: false,
    refusals: [],
    authorization: null,
    currentContentHash: HASH,
    spentRunIds: [],
    ...overrides,
  };
}

function renderPanel(overrides: Partial<RuntimeContextValue> = {}) {
  const authorizeExecution = vi.fn(async () => {});
  const readExecutionGate = vi.fn(async () => gateReport());
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
          authorizeExecution,
          readExecutionGate,
          ...overrides,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  render(<ExecutionAuthorizationPanel />, { wrapper: Wrapper });
  return { authorizeExecution, readExecutionGate };
}

function panelState(): string | null {
  return screen.getByTestId("execution-authorization-panel").getAttribute("data-authorization-state");
}

describe("ExecutionAuthorizationPanel — authorizing is never mistakable for running", () => {
  it("labels the control as permission, and says it starts nothing", () => {
    renderPanel();
    const control = screen.getByTestId("authorization-submit").textContent ?? "";
    expect(control).toMatch(/Authorize one run of backend_implementation/);
    expect(control).toMatch(/once/i);
    expect(control).toMatch(/does not start it/i);
    expect(control).toMatch(/nothing runs as a result/i);
  });

  it("says nothing has run, on the issued record itself", () => {
    renderPanel({
      worldState: {
        ...createInitialWorldState(),
        currentBuild: BUILD,
        currentPlan: persistedPlan(REVIEWED, AUTHORIZATION),
      },
    });
    const text = screen.getByTestId("authorization-not-running").textContent ?? "";
    expect(text).toMatch(/nothing has run/i);
    expect(text).toMatch(/single-use/i);
    expect(text).toMatch(/no process, no model call, and no spend/i);
  });

  it("says a permitted gate still started nothing", async () => {
    renderPanel({
      readExecutionGate: vi.fn(async () => gateReport({ permitted: true, authorization: AUTHORIZATION })),
      worldState: {
        ...createInitialWorldState(),
        currentBuild: BUILD,
        currentPlan: persistedPlan(REVIEWED, AUTHORIZATION),
      },
    });
    await waitFor(() => {
      const verdict = screen.getByTestId("gate-verdict");
      expect(verdict.getAttribute("data-gate-permitted")).toBe("true");
      expect(verdict.textContent).toMatch(/Nothing has started/i);
    });
  });
});

describe("ExecutionAuthorizationPanel — the binding is visible", () => {
  it("shows the backend-generated plan content hash before the control that uses it", () => {
    renderPanel();
    expect(screen.getByTestId("authorization-binding").textContent).toBe(HASH);
  });

  it("says the binding is backend-generated and compared server-side, and is not the revision", () => {
    renderPanel();
    const boundary = screen.getByTestId("authorization-boundary").textContent ?? "";
    expect(boundary).toMatch(/generated by the backend/i);
    expect(boundary).toMatch(/compared\s+server-side/i);
    expect(boundary).toMatch(/revision indicator .* is a change signal, not this binding/i);
  });

  it("shows who, what, when, and what it bound to once issued (F-114)", () => {
    renderPanel({
      worldState: {
        ...createInitialWorldState(),
        currentBuild: BUILD,
        currentPlan: persistedPlan(REVIEWED, AUTHORIZATION),
      },
    });
    expect(screen.getByTestId("authorization-who").textContent).toBe("operator-1");
    expect(screen.getByTestId("authorization-what").textContent).toContain(CLAUDE_CODE_STAGE);
    expect(screen.getByTestId("authorization-when").textContent).toBe(AUTHORIZATION.authorizedAt);
    expect(screen.getByTestId("authorization-bound-to").textContent).toBe(HASH);
    expect(screen.getByTestId("authorization-budget").textContent).toBe("$5");
  });
});

describe("ExecutionAuthorizationPanel — distinguishable states", () => {
  it("renders nothing in mock mode", () => {
    renderPanel({ runtimeMode: "mock" });
    expect(screen.queryByTestId("execution-authorization-panel")).toBeNull();
  });

  it.each([
    ["unreachable", { connectionStatus: "disconnected" as const }],
    [
      "no-plan",
      { worldState: { ...createInitialWorldState(), currentBuild: BUILD, currentPlan: null } },
    ],
    [
      "awaiting-review",
      {
        worldState: {
          ...createInitialWorldState(),
          currentBuild: BUILD,
          currentPlan: persistedPlan(null),
        },
      },
    ],
    [
      "not-proceeding",
      {
        worldState: {
          ...createInitialWorldState(),
          currentBuild: BUILD,
          currentPlan: persistedPlan({ ...REVIEWED, decision: "rejected" }),
        },
      },
    ],
    [
      "nothing-to-authorize",
      {
        worldState: {
          ...createInitialWorldState(),
          currentBuild: BUILD,
          currentPlan: persistedPlan(REVIEWED, null, true),
        },
      },
    ],
    ["unauthorized", {}],
    [
      "authorized",
      {
        worldState: {
          ...createInitialWorldState(),
          currentBuild: BUILD,
          currentPlan: persistedPlan(REVIEWED, AUTHORIZATION),
        },
      },
    ],
  ])("renders the %s state", (expected, overrides) => {
    renderPanel(overrides as Partial<RuntimeContextValue>);
    expect(panelState()).toBe(expected);
  });

  it("withholds the control once an authorization exists — it is not reissued", () => {
    renderPanel({
      worldState: {
        ...createInitialWorldState(),
        currentBuild: BUILD,
        currentPlan: persistedPlan(REVIEWED, AUTHORIZATION),
      },
    });
    expect(screen.queryByTestId("authorization-form")).toBeNull();
    expect(screen.getByTestId("authorization-record")).toBeTruthy();
  });
});

describe("ExecutionAuthorizationPanel — the gate's verdict is the backend's", () => {
  it("renders every refusal the backend reported, with its corrective action", async () => {
    renderPanel({
      readExecutionGate: vi.fn(async () =>
        gateReport({
          refusals: [
            {
              code: "no_authorization",
              reason: "No execution authorization exists for plan plan-1.",
              correctiveAction: "Authorize exactly one stage, once.",
            },
            {
              code: "plan_content_hash_mismatch",
              reason: "The plan changed after it was authorized.",
              correctiveAction: "Re-read the current plan.",
            },
          ],
        }),
      ),
    });
    await waitFor(() => {
      const refusals = screen.getByTestId("gate-refusals").textContent ?? "";
      expect(refusals).toContain("No execution authorization exists");
      expect(refusals).toContain("Authorize exactly one stage, once.");
      expect(refusals).toContain("The plan changed after it was authorized.");
    });
  });

  it("reports a spent authorization and that it is not restarted automatically", async () => {
    renderPanel({
      readExecutionGate: vi.fn(async () =>
        gateReport({
          spentRunIds: ["run-1"],
          refusals: [
            {
              code: "authorization_already_spent",
              reason: "This authorization is spent.",
              correctiveAction: "Issue a new authorization if you intend to run again.",
            },
          ],
        }),
      ),
    });
    await waitFor(() => {
      expect(screen.getByTestId("gate-verdict").textContent).toMatch(
        /never restarted automatically/i,
      );
    });
  });

  it("says so plainly when the gate's state cannot be read", async () => {
    renderPanel({
      readExecutionGate: vi.fn(async () => gateReport({ unavailable: "fetch failed" })),
    });
    await waitFor(() => {
      expect(screen.getByTestId("gate-unavailable").textContent).toContain("fetch failed");
    });
  });
});

describe("ExecutionAuthorizationPanel — issuing", () => {
  it("sends the chosen stage and budget, and never a hash of its own", async () => {
    const { authorizeExecution } = renderPanel();
    fireEvent.change(screen.getByLabelText(/Budget ceiling/i), { target: { value: "12.5" } });
    fireEvent.click(screen.getByTestId("authorization-submit"));

    await waitFor(() => expect(authorizeExecution).toHaveBeenCalledTimes(1));
    const [input] = authorizeExecution.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(input).toEqual({ stageName: CLAUDE_CODE_STAGE, maxBudgetUsd: 12.5 });
    // The binding is not a client input. The provider reads it from the
    // projected plan; the backend recomputes and compares its own.
    expect(Object.keys(input)).not.toContain("planContentHash");
    expect(Object.keys(input)).not.toContain("acknowledgedContentHash");
  });

  it("re-reads the gate after authorizing rather than assuming it opened", async () => {
    const { readExecutionGate } = renderPanel();
    await waitFor(() => expect(readExecutionGate).toHaveBeenCalled());
    const before = readExecutionGate.mock.calls.length;

    fireEvent.click(screen.getByTestId("authorization-submit"));
    await waitFor(() => expect(readExecutionGate.mock.calls.length).toBeGreaterThan(before));
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
    expect(screen.getByTestId("authorization-submit").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("authorization-blocked").textContent).toMatch(/operator credential/i);
  });
});
