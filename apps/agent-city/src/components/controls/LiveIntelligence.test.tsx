import { RuntimeContext } from "@/lib/mock-runtime";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { reduceWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LiveIntelligence } from "./LiveIntelligence";

function renderIntel(events: ReturnType<typeof buildCanonicalScript>, isRunning = true) {
  const worldState = reduceWorldState(events);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RuntimeContext.Provider
        value={{
          events,
          worldState,
          isRunning,
          isComplete: false,
          submitCommand: vi.fn(),
          resolveApproval: vi.fn(),
          lastRejection: null,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  render(<LiveIntelligence />, { wrapper: Wrapper });
}

describe("LiveIntelligence", () => {
  it("shows a blocked-stage exception while the intentional failure is active", () => {
    const fullScript = buildCanonicalScript("intel-blocked-test");
    const blockedIndex = fullScript.findIndex((e) => e.type === "stage.blocked");
    renderIntel(fullScript.slice(0, blockedIndex + 1));

    expect(screen.getByTestId("exceptions-panel")).toBeInTheDocument();
    expect(screen.getByText(/Blocked: frontend_implementation/)).toBeInTheDocument();
  });

  it("shows a pending-approval exception once approval.requested fires", () => {
    const fullScript = buildCanonicalScript("intel-approval-test");
    const requestedIndex = fullScript.findIndex((e) => e.type === "approval.requested");
    renderIntel(fullScript.slice(0, requestedIndex + 1));

    expect(screen.getByTestId("exceptions-panel")).toBeInTheDocument();
    expect(screen.getByText(/Pending approval/)).toBeInTheDocument();
  });

  it("shows no exceptions panel once the intentional failure has recovered and no approval is pending yet", () => {
    const fullScript = buildCanonicalScript("intel-recovered-test");
    // frontend_implementation is the 3rd stage.completed in canonical order
    // — well past the retry recovery, well before the approval gate.
    const stageCompletedEvents = fullScript.filter((e) => e.type === "stage.completed");
    const frontendCompletedIndex = fullScript.indexOf(stageCompletedEvents[2]!);
    renderIntel(fullScript.slice(0, frontendCompletedIndex + 1));

    expect(screen.queryByTestId("exceptions-panel")).not.toBeInTheDocument();
  });

  it('shows "Running" or "Paused" status', () => {
    renderIntel(buildCanonicalScript("intel-status-test").slice(0, 1), true);
    expect(screen.getByText("Running")).toBeInTheDocument();
  });
});
