import type { Approval, WorldState } from "@foundry/contracts";
import { RuntimeContext } from "@/lib/mock-runtime";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApprovalCard } from "./ApprovalCard";

const PENDING_APPROVAL: Approval = {
  id: "approval-1",
  buildId: "build-1",
  stageId: "stage-deploy",
  status: "pending",
  riskClass: "R1",
  title: "Approve deployment package",
  reason: "QA validation passed",
  recommendedAction: "approve",
  evidenceIds: ["artifact-test-report"],
  requestedAt: "2026-07-30T00:00:00.000Z",
};

function renderWithApproval(approval: Approval | null, resolveApproval = vi.fn()) {
  const worldState: WorldState = {
    ...createInitialWorldState(),
    approvals: approval ? [approval] : [],
  };
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RuntimeContext.Provider
        value={{
          events: [],
          worldState,
          isRunning: false,
          isComplete: false,
          submitCommand: vi.fn(),
          resolveApproval,
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          lastRejection: null,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  return { ...render(<ApprovalCard />, { wrapper: Wrapper }), resolveApproval };
}

describe("ApprovalCard", () => {
  it("renders nothing when there is no pending approval", () => {
    renderWithApproval(null);
    expect(screen.queryByTestId("approval-card")).not.toBeInTheDocument();
  });

  it("shows evidence, risk class, and recommended action for a pending approval", () => {
    renderWithApproval(PENDING_APPROVAL);
    const card = screen.getByTestId("approval-card");
    expect(card).toHaveTextContent("Approve deployment package");
    expect(card).toHaveTextContent("R1");
    expect(card).toHaveTextContent("approve");
    expect(card).toHaveTextContent("artifact-test-report");
  });

  it('Approve calls resolveApproval("approved", ...)', () => {
    const { resolveApproval } = renderWithApproval(PENDING_APPROVAL);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(resolveApproval).toHaveBeenCalledWith("approved", "operator-1", undefined);
  });

  it('Reject calls resolveApproval("rejected", ...) with an optional note', () => {
    const { resolveApproval } = renderWithApproval(PENDING_APPROVAL);
    fireEvent.change(screen.getByLabelText("Resolution note (optional)"), {
      target: { value: "Evidence insufficient" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(resolveApproval).toHaveBeenCalledWith("rejected", "operator-1", "Evidence insufficient");
  });

  it('Request revision calls resolveApproval("revision_requested", ...)', () => {
    const { resolveApproval } = renderWithApproval(PENDING_APPROVAL);
    fireEvent.click(screen.getByRole("button", { name: "Request revision" }));
    expect(resolveApproval).toHaveBeenCalledWith("revision_requested", "operator-1", undefined);
  });

  it("is a keyboard-complete dialog: every action is a native, focusable button", () => {
    renderWithApproval(PENDING_APPROVAL);
    const card = screen.getByTestId("approval-card");
    expect(card).toHaveAttribute("role", "alertdialog");
    for (const name of ["Approve", "Reject", "Request revision"]) {
      const button = screen.getByRole("button", { name });
      expect(button.tagName).toBe("BUTTON");
      expect(button.tabIndex).toBe(0);
    }
  });
});
