import { RuntimeContext } from "@/lib/mock-runtime";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { selectStages } from "@/lib/mock-runtime/selectors";
import { reduceWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Selection } from "./selection";
import { SelectedObjectDetail } from "./SelectedObjectDetail";

function renderDetail(selection: Selection | null, events = buildCanonicalScript("detail-test")) {
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
          lastRejection: null,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  render(<SelectedObjectDetail selection={selection} />, { wrapper: Wrapper });
}

describe("SelectedObjectDetail — empty state", () => {
  it("shows a clear empty state when nothing is selected", () => {
    renderDetail(null);
    expect(screen.getByText(/No selection/)).toBeInTheDocument();
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
});
