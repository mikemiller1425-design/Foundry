import { RuntimeContext } from "@/lib/mock-runtime/RuntimeProvider";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { eventRelatesToSelection, SelectionActivity } from "./SelectionActivity";

describe("eventRelatesToSelection", () => {
  const events = buildCanonicalScript("selection-activity-test");

  it("relates an agent only through canonical agent references", () => {
    const event = events.find((candidate) => candidate.type === "agent.assigned")!;
    expect(eventRelatesToSelection(event, { kind: "agent", id: event.entityId })).toBe(true);
    expect(eventRelatesToSelection(event, { kind: "agent", id: "agent-unrelated" })).toBe(false);
  });

  it("relates a building through declared route payload fields", () => {
    const event = events.find((candidate) => candidate.type === "transfer.started")!;
    const payload = event.payload as { sourceBuildingId: string; destinationBuildingId: string };
    expect(eventRelatesToSelection(event, { kind: "building", id: payload.sourceBuildingId })).toBe(
      true,
    );
    expect(
      eventRelatesToSelection(event, { kind: "building", id: payload.destinationBuildingId }),
    ).toBe(true);
  });
});

describe("SelectionActivity", () => {
  it("renders recent canonical events for the selected agent", () => {
    const script = buildCanonicalScript("selection-activity-render-test");
    const agentEvent = script.find((event) => event.type === "agent.registered")!;

    const onLocate = vi.fn();
    render(
      <RuntimeContext.Provider
        value={{
          events: script,
          worldState: createInitialWorldState(),
          isRunning: false,
          isComplete: true,
          connectionStatus: "connected",
          mutationsEnabled: true,
          submitCommand: () => undefined,
          resolveApproval: () => undefined,
          selectBuilding: () => undefined,
          clearSelection: () => undefined,
          lastRejection: null,
        }}
      >
        <SelectionActivity
          selection={{ kind: "agent", id: agentEvent.entityId }}
          onLocate={onLocate}
        />
      </RuntimeContext.Provider>,
    );

    expect(screen.getByRole("region", { name: "Selected object activity" })).toBeInTheDocument();
    expect(screen.getByTestId("selection-activity-list").children).toHaveLength(4);
    expect(screen.getByText(/Agent returned home/)).toBeInTheDocument();
    const locateButtons = screen.getAllByRole("button", { name: /Locate Architect in world/ });
    fireEvent.click(locateButtons[0]!);
    expect(onLocate).toHaveBeenCalledWith(agentEvent.entityId);
  });
});
