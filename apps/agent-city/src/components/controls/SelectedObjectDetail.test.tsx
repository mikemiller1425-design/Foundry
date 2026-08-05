import { RuntimeContext } from "@/lib/mock-runtime";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { selectStages } from "@/lib/mock-runtime/selectors";
import { reduceWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Selection } from "./selection";
import { SelectedObjectDetail } from "./SelectedObjectDetail";

function renderDetail(
  selection: Selection | null,
  events = buildCanonicalScript("detail-test"),
  onSelect?: (selection: Selection) => void,
  onPreviewTenant?: (tenantId: string) => void,
) {
  const worldState = reduceWorldState(events);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
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
          connectionStatus: "connected" as const,
          mutationsEnabled: true,
          lastRejection: null,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  render(
    <SelectedObjectDetail
      selection={selection}
      onSelect={onSelect}
      onPreviewTenant={onPreviewTenant}
    />,
    { wrapper: Wrapper },
  );
}

describe("SelectedObjectDetail — empty state", () => {
  it("shows a clear empty state when nothing is selected", () => {
    renderDetail(null);
    expect(screen.getByText(/No selection/)).toBeInTheDocument();
  });
});

describe("SelectedObjectDetail — fixture world concepts", () => {
  it("shows a district without implying property or backend entitlement", () => {
    renderDetail({ kind: "district", id: "agent-city-operations" }, []);

    expect(screen.getByText("District: Agent City Operations")).toBeInTheDocument();
    expect(
      screen.getByText(/not a marketplace, legal property, or backend entitlement/i),
    ).toBeInTheDocument();
  });

  it("identifies fictional parcel tenancy and links back to canonical places", () => {
    const onSelect = vi.fn();
    renderDetail({ kind: "parcel", id: "production-row" }, [], onSelect);

    expect(screen.getByText("Parcel: Production Row")).toBeInTheDocument();
    expect(screen.getByText("Forgeworks Cooperative")).toBeInTheDocument();
    expect(screen.getByText(/No lease, ownership, payment/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View place · Warehouse" }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "building", id: "warehouse" });
  });

  it("opens only a fixture tenant preview and leaves an unassigned parcel without one", () => {
    const onPreviewTenant = vi.fn();
    renderDetail({ kind: "parcel", id: "production-row" }, [], undefined, onPreviewTenant);
    fireEvent.click(screen.getByRole("button", { name: /Preview fictional tenant space/ }));
    expect(onPreviewTenant).toHaveBeenCalledWith("forgeworks-cooperative");

    cleanup();
    renderDetail({ kind: "parcel", id: "future-yard" }, [], undefined, onPreviewTenant);
    expect(screen.getByText("None — unassigned concept")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Preview fictional tenant space/ }),
    ).not.toBeInTheDocument();
  });
});

describe("SelectedObjectDetail — stage selection with requirement checklist", () => {
  it("shows the stage name, status, and its requirement checklist", () => {
    const events = buildCanonicalScript("detail-stage-test");
    const stages = selectStages(events);
    const frontend = stages.find((s) => s.name === "frontend_implementation")!;

    renderDetail({ kind: "stage", id: frontend.id }, events);

    expect(screen.getByText("Stage: frontend_implementation")).toBeInTheDocument();
    expect(screen.getByText("Requirement checklist")).toBeInTheDocument();
    expect(screen.getAllByTestId("requirement-checklist-item")).toHaveLength(3);
  });

  it("mid-stream (before the retry resolves), shows the failed requirement's evidence message", () => {
    const fullScript = buildCanonicalScript("detail-midstream-test");
    const failedIndex = fullScript.findIndex((e) => e.type === "requirement.failed");
    const events = fullScript.slice(0, failedIndex + 1);
    const stages = selectStages(events);
    const frontend = stages.find((s) => s.name === "frontend_implementation")!;

    renderDetail({ kind: "stage", id: frontend.id }, events);

    expect(screen.getByText("Stage: frontend_implementation")).toBeInTheDocument();
    expect(screen.getByTestId("requirement-evidence")).toHaveTextContent(/error state/);
  });

  it("can navigate from a stage to its declared source workplace", () => {
    const events = buildCanonicalScript("detail-stage-workplace-test");
    const stage = selectStages(events).find((candidate) => candidate.sourceBuildingId)!;
    const onSelect = vi.fn();

    renderDetail({ kind: "stage", id: stage.id }, events, onSelect);
    fireEvent.click(screen.getByRole("button", { name: /View workplace/ }));

    expect(onSelect).toHaveBeenCalledWith({ kind: "building", id: stage.sourceBuildingId });
  });
});

describe("SelectedObjectDetail — agent selection", () => {
  it("shows the agent's role, status, and current building", () => {
    const events = buildCanonicalScript("detail-agent-test");
    const worldState = reduceWorldState(events);
    const architect = worldState.agents.find((a) => a.role === "architect")!;

    renderDetail({ kind: "agent", id: architect.id }, events);

    expect(screen.getByText("Agent: architect")).toBeInTheDocument();
    expect(screen.getByText(architect.currentBuildingId)).toBeInTheDocument();
  });

  it("can navigate from an agent to its current canonical place", () => {
    const events = buildCanonicalScript("detail-agent-place-test");
    const worldState = reduceWorldState(events);
    const architect = worldState.agents.find((agent) => agent.role === "architect")!;
    const onSelect = vi.fn();

    renderDetail({ kind: "agent", id: architect.id }, events, onSelect);
    fireEvent.click(screen.getByRole("button", { name: /View current place/ }));

    expect(onSelect).toHaveBeenCalledWith({ kind: "building", id: architect.currentBuildingId });
  });
});

describe("SelectedObjectDetail — building selection (FBL-015)", () => {
  it("shows the Lighthouse's current state and its non-color textual signal", () => {
    renderDetail({ kind: "building", id: "lighthouse" }, []);
    expect(screen.getByText("Building: Lighthouse")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Steady white")).toBeInTheDocument();
  });

  it("can navigate from a residence to its canonical resident", () => {
    const events = buildCanonicalScript("detail-resident-test");
    const worldState = reduceWorldState(events);
    const resident = worldState.agents[0]!;
    const onSelect = vi.fn();

    renderDetail({ kind: "building", id: resident.homeBuildingId }, events, onSelect);
    fireEvent.click(screen.getByRole("button", { name: /View resident/ }));

    expect(onSelect).toHaveBeenCalledWith({ kind: "agent", id: resident.id });
  });
});
