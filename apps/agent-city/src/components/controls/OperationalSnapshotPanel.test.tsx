import { RuntimeContext } from "@/lib/mock-runtime";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { reduceWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { OperationalSnapshotPanel } from "./OperationalSnapshotPanel";

function renderPanel() {
  const events = buildCanonicalScript("operational-snapshot-panel-test");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RuntimeContext.Provider
      value={{
        events,
        worldState: reduceWorldState(events),
        isRunning: false,
        isComplete: true,
        submitCommand: vi.fn(),
        resolveApproval: vi.fn(),
        selectBuilding: vi.fn(),
        clearSelection: vi.fn(),
        connectionStatus: "connected",
        mutationsEnabled: true,
        lastRejection: null,
      }}
    >
      {children}
    </RuntimeContext.Provider>
  );
  render(<OperationalSnapshotPanel />, { wrapper });
}

describe("OperationalSnapshotPanel", () => {
  it("defaults to a previous-operational-checkpoint comparison", () => {
    renderPanel();

    expect(screen.getByText(/previous operational event checkpoint/i)).toBeInTheDocument();
    expect(screen.getByText("Stages done")).toBeInTheDocument();
    expect(screen.getByText("Exceptions seen")).toBeInTheDocument();
    expect(screen.getByText("Latest change")).toBeInTheDocument();
  });

  it("switches to evidence references with an explicit verification boundary", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "evidence" }));
    expect(screen.getByText(/contents are not inspected or verified here/i)).toBeInTheDocument();
    expect(screen.getAllByText("Reference only").length).toBeGreaterThan(0);
  });
});
