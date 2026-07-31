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

  it("renders the Lighthouse, the three residences, the five operational buildings, and the utility vehicle as selectable world objects showing their current state (FBL-016/FBL-017/FBL-019)", () => {
    renderPanel();
    const buildingItems = screen.getAllByTestId("building-list-item");
    expect(buildingItems).toHaveLength(10);
    expect(screen.getByText("Lighthouse")).toBeInTheDocument();
    expect(screen.getByText("Architect Residence")).toBeInTheDocument();
    expect(screen.getByText("Builder Residence")).toBeInTheDocument();
    expect(screen.getByText("Inspector Residence")).toBeInTheDocument();
    expect(screen.getByText("Construction Office")).toBeInTheDocument();
    expect(screen.getByText("Warehouse")).toBeInTheDocument();
    expect(screen.getByText("QA Building")).toBeInTheDocument();
    expect(screen.getByText("Deployment Dock")).toBeInTheDocument();
    expect(screen.getByText("Construction Site")).toBeInTheDocument();
    expect(screen.getByText("Utility Vehicle")).toBeInTheDocument();
  });

  it("clicking the Lighthouse calls onSelect with { kind: 'building', id: 'lighthouse' }", () => {
    const { onSelect } = renderPanel();
    fireEvent.click(screen.getAllByTestId("building-list-item")[0]!);
    expect(onSelect).toHaveBeenCalledWith({ kind: "building", id: "lighthouse" });
  });

  it("clicking a residence calls onSelect with { kind: 'building', id: <residence id> }", () => {
    const { onSelect } = renderPanel();
    fireEvent.click(screen.getAllByTestId("building-list-item")[1]!);
    expect(onSelect).toHaveBeenCalledWith({ kind: "building", id: "home-architect" });
  });

  it("clicking an operational building calls onSelect with { kind: 'building', id: <building id> } (FBL-017)", () => {
    const { onSelect } = renderPanel();
    fireEvent.click(screen.getAllByTestId("building-list-item")[4]!); // 0: lighthouse, 1-3: residences, 4: construction office
    expect(onSelect).toHaveBeenCalledWith({ kind: "building", id: "construction-office" });
  });

  it("clicking the utility vehicle calls onSelect with { kind: 'vehicle', id: <vehicle id> } (FBL-019)", () => {
    const { onSelect } = renderPanel();
    const items = screen.getAllByTestId("building-list-item");
    fireEvent.click(items[items.length - 1]!); // vehicle is registered last
    expect(onSelect).toHaveBeenCalledWith({ kind: "vehicle", id: "vehicle-utility-1" });
  });
});
