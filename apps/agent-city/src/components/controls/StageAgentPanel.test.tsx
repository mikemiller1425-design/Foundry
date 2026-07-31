import { RuntimeContext } from "@/lib/mock-runtime";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { reduceWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StageAgentPanel } from "./StageAgentPanel";

function renderPanel(onSelect = vi.fn()) {
  const script = buildCanonicalScript("stage-agent-panel-test");
  const worldState = reduceWorldState(script);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RuntimeContext.Provider
        value={{
          events: script,
          worldState,
          isRunning: false,
          isComplete: true,
          submitCommand: vi.fn(),
          resolveApproval: vi.fn(),
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          lastRejection: null,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  render(<StageAgentPanel selection={null} onSelect={onSelect} />, { wrapper: Wrapper });
  return { onSelect };
}

describe("StageAgentPanel", () => {
  it("renders the current build objective and status", () => {
    renderPanel();
    expect(screen.getByText(/Build a basic task-management/)).toBeInTheDocument();
    expect(screen.getAllByText("completed").length).toBeGreaterThan(0);
  });

  it("renders all seven stages with their statuses", () => {
    renderPanel();
    const stageItems = screen.getAllByTestId("stage-list-item");
    expect(stageItems).toHaveLength(7);
    expect(screen.getByText("Frontend implementation")).toBeInTheDocument();
    expect(screen.getByText("Deployment package")).toBeInTheDocument();
  });

  it("renders all three agents with their roles and statuses", () => {
    renderPanel();
    const agentItems = screen.getAllByTestId("agent-list-item");
    expect(agentItems).toHaveLength(3);
    expect(screen.getByText("architect")).toBeInTheDocument();
  });

  it("clicking a stage calls onSelect with { kind: 'stage', id }", () => {
    const { onSelect } = renderPanel();
    fireEvent.click(screen.getAllByTestId("stage-list-item")[0]!);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "stage", id: expect.any(String) }),
    );
  });

  it("clicking an agent calls onSelect with { kind: 'agent', id }", () => {
    const { onSelect } = renderPanel();
    fireEvent.click(screen.getAllByTestId("agent-list-item")[0]!);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "agent", id: expect.any(String) }),
    );
  });

  it("every stage and agent row is a native, keyboard-reachable button", () => {
    renderPanel();
    for (const item of [
      ...screen.getAllByTestId("stage-list-item"),
      ...screen.getAllByTestId("agent-list-item"),
    ]) {
      expect(item.tagName).toBe("BUTTON");
      expect(item.tabIndex).toBe(0);
    }
  });

  it("renders the Lighthouse as a selectable world object showing its current state", () => {
    renderPanel();
    const buildingItems = screen.getAllByTestId("building-list-item");
    expect(buildingItems).toHaveLength(1);
    expect(screen.getByText("Lighthouse")).toBeInTheDocument();
  });

  it("clicking the Lighthouse calls onSelect with { kind: 'building', id: 'lighthouse' }", () => {
    const { onSelect } = renderPanel();
    fireEvent.click(screen.getByTestId("building-list-item"));
    expect(onSelect).toHaveBeenCalledWith({ kind: "building", id: "lighthouse" });
  });
});
