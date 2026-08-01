import type { WorldState } from "@foundry/contracts";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApprovalCard } from "./ApprovalCard";
import { RuntimeContext, type RuntimeContextValue } from "@/lib/mock-runtime/RuntimeProvider";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { computeLighthouseState } from "@/lib/world/lighthouseState";
import {
  commandHeaders,
  readOperatorCredential,
  writeOperatorCredential,
} from "@/lib/backend/operatorCredential";

/**
 * FBL-030 frontend behaviour.
 *
 * Two properties matter here and neither is cosmetic: the approval
 * controls must be *unavailable and explained* when this client holds no
 * operator credential, and the Lighthouse must signal that a human
 * decision is waiting.
 */

const pendingApproval = {
  id: "approval-1",
  buildId: "build-1",
  stageId: "stage-deployment",
  status: "pending" as const,
  riskClass: "R2" as const,
  title: "Deploy to the dock",
  reason: "QA validation passed",
  recommendedAction: "Approve to permit the transfer",
  evidenceIds: ["artifact-1"],
  requestedAt: "2026-08-01T00:00:00.000Z",
};

function worldStateWithApproval(): WorldState {
  const base = createInitialWorldState();
  return { ...base, approvals: [pendingApproval] };
}

function renderCard(overrides: Partial<RuntimeContextValue> = {}) {
  const value: RuntimeContextValue = {
    events: [],
    worldState: worldStateWithApproval(),
    isRunning: true,
    isComplete: false,
    connectionStatus: "connected",
    mutationsEnabled: true,
    submitCommand: vi.fn(),
    resolveApproval: vi.fn(),
    selectBuilding: vi.fn(),
    clearSelection: vi.fn(),
    lastRejection: null,
    ...overrides,
  };
  render(
    <RuntimeContext.Provider value={value}>
      <ApprovalCard />
    </RuntimeContext.Provider>,
  );
  return value;
}

describe("FBL-030 — approval controls require an operator credential", () => {
  it("disables resolution and explains why when no credential is held", () => {
    renderCard({ operatorCredentialRequired: true });

    expect(screen.getByTestId("operator-credential-required")).toBeInTheDocument();
    for (const label of ["Approve", "Reject", "Request revision"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
  });

  it("does not fire a resolution while the credential is missing", () => {
    const value = renderCard({ operatorCredentialRequired: true });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(value.resolveApproval).not.toHaveBeenCalled();
  });

  it("enables resolution once a credential is held", () => {
    const value = renderCard({ operatorCredentialRequired: false });

    expect(screen.queryByTestId("operator-credential-required")).not.toBeInTheDocument();
    const approve = screen.getByRole("button", { name: "Approve" });
    expect(approve).toBeEnabled();

    fireEvent.click(approve);
    expect(value.resolveApproval).toHaveBeenCalledWith("approved", "operator-1", undefined);
  });

  it("stores a credential the operator supplies", () => {
    const setOperatorCredential = vi.fn();
    renderCard({ operatorCredentialRequired: true, setOperatorCredential });

    fireEvent.change(screen.getByTestId("operator-credential-input"), {
      target: { value: "  a-real-token  " },
    });
    fireEvent.click(screen.getByTestId("operator-credential-save"));

    expect(setOperatorCredential).toHaveBeenCalledWith("  a-real-token  ");
  });

  it("keeps the credential prompt distinct from the disconnected message", () => {
    // An operator must be able to tell "not authorized" from "backend
    // unreachable"; collapsing them into one message hides which is true.
    renderCard({ mutationsEnabled: false, operatorCredentialRequired: true });

    expect(screen.getByText(/Disconnected/)).toBeInTheDocument();
    expect(screen.queryByTestId("operator-credential-required")).not.toBeInTheDocument();
  });

  it("leaves the mock runtime unchanged — it requires no credential", () => {
    // ADR-001: the mock engine is its own authority, so demo and test
    // mode behave exactly as before this rung.
    const value = renderCard({});
    expect(screen.queryByTestId("operator-credential-required")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(value.resolveApproval).toHaveBeenCalled();
  });
});

describe("FBL-030 — the Lighthouse signals a waiting human decision", () => {
  it("shows attention while an approval is pending", () => {
    expect(computeLighthouseState(worldStateWithApproval())).toBe("attention_required");
  });

  it("clears once the approval is resolved", () => {
    const base = createInitialWorldState();
    const resolved = {
      ...base,
      approvals: [
        {
          ...pendingApproval,
          status: "approved" as const,
          resolvedBy: "operator-1",
          resolvedAt: "x",
        },
      ],
    };
    expect(computeLighthouseState(resolved)).not.toBe("attention_required");
  });

  it("keeps signalling attention after a rejection leaves the gate closed", () => {
    // A rejection resolves the approval, so the Lighthouse no longer
    // demands a decision — the gate stays shut, which is the *transfer*
    // guard's job, not an attention signal.
    const base = createInitialWorldState();
    const rejected = {
      ...base,
      approvals: [{ ...pendingApproval, status: "rejected" as const, resolvedBy: "operator-1" }],
    };
    expect(computeLighthouseState(rejected)).not.toBe("attention_required");
  });
});

describe("FBL-030 — operator credential storage", () => {
  function memoryStorage(): Storage {
    const map = new Map<string, string>();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  }

  it("round-trips a credential and trims it", () => {
    const store = memoryStorage();
    writeOperatorCredential("  token-value  ", store);
    expect(readOperatorCredential(store)).toBe("token-value");
  });

  it("treats an empty value as clearing the credential", () => {
    const store = memoryStorage();
    writeOperatorCredential("token-value", store);
    writeOperatorCredential("   ", store);
    expect(readOperatorCredential(store)).toBeNull();
  });

  it("reports absence rather than throwing when storage is unavailable", () => {
    const hostile = {
      getItem: () => {
        throw new Error("storage disabled");
      },
      setItem: () => {
        throw new Error("storage disabled");
      },
    } as unknown as Storage;

    expect(readOperatorCredential(hostile)).toBeNull();
    expect(() => writeOperatorCredential("x", hostile)).not.toThrow();
  });

  it("attaches the credential as a bearer header, and omits it when absent", () => {
    expect(commandHeaders("token-value")).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer token-value",
    });
    expect(commandHeaders(null)).toEqual({ "Content-Type": "application/json" });
  });
});
