import { RuntimeContext } from "@/lib/mock-runtime";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { reduceWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AgentLifePanel } from "./AgentLifePanel";

function renderPanel(onSelect = vi.fn()) {
  const events = buildCanonicalScript("agent-life-panel-test");
  const worldState = reduceWorldState(events);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RuntimeContext.Provider
      value={{
        events,
        worldState,
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
  render(<AgentLifePanel onSelect={onSelect} />, { wrapper });
  return { onSelect, worldState };
}

describe("AgentLifePanel", () => {
  it("shows exactly the projected canonical agents and denies precise simulation", () => {
    const { worldState } = renderPanel();

    expect(screen.getAllByRole("button")).toHaveLength(worldState.agents.length);
    expect(screen.getByText("Event-derived")).toBeInTheDocument();
    expect(screen.getByText(/not autonomous simulation or precise location/i)).toBeInTheDocument();
  });

  it("navigates through the shared agent selection funnel", () => {
    const { onSelect, worldState } = renderPanel();
    const architect = worldState.agents.find((agent) => agent.role === "architect")!;

    fireEvent.click(screen.getByRole("button", { name: /architect/i }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "agent", id: architect.id });
  });
});
