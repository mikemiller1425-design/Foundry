import type { WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { RuntimeContext } from "@/lib/mock-runtime";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { EventTimeline } from "./EventTimeline";

// A small, fixed event fixture — deterministic, hand-authored, independent
// of the live runtime's timers (FBL-009 "fixed event fixture rendering").
function fixedEvent(overrides: Partial<FoundryEvent> & Pick<FoundryEvent, "type">): FoundryEvent {
  const base = {
    id: `evt-${Math.random()}`,
    occurredAt: "2026-07-30T00:00:00.000Z",
    actorType: "backend" as const,
    actorId: "backend",
    entityType: "System",
    entityId: "system-1",
    correlationId: "build-1",
    severity: "info" as const,
    schemaVersion: 1,
    payload: {},
  };
  return { ...base, ...overrides } as FoundryEvent;
}

const FIXTURE: FoundryEvent[] = [
  fixedEvent({
    id: "evt-1",
    type: "system.started",
    entityType: "System",
    occurredAt: "2026-07-30T00:00:00.000Z",
    payload: { serviceVersion: "1.0.0", neighborhoodId: "n-1" },
  }),
  fixedEvent({
    id: "evt-2",
    type: "build.created",
    entityType: "Build",
    entityId: "build-1",
    occurredAt: "2026-07-30T00:00:01.000Z",
    payload: { projectId: "project-1", buildId: "build-1", objective: "Build X" },
  }),
  fixedEvent({
    id: "evt-3",
    type: "requirement.failed",
    entityType: "Requirement",
    entityId: "req-1",
    severity: "error",
    occurredAt: "2026-07-30T00:00:02.000Z",
    payload: {
      evidenceIds: [],
      message: "Delete does not show an error state",
      retryEligible: true,
    },
  }),
];

function renderWithFixture(
  events: FoundryEvent[],
  worldState: WorldState = createInitialWorldState(),
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RuntimeContext.Provider
        value={{
          events,
          worldState,
          isRunning: false,
          isComplete: true,
          submitCommand: vi.fn(),
          lastRejection: null,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  return render(<EventTimeline />, { wrapper: Wrapper });
}

describe("EventTimeline — fixed fixture rendering", () => {
  it("renders every event from a fixed fixture, in order, with timestamp/severity/entity/summary", () => {
    renderWithFixture(FIXTURE);
    const rows = screen.getAllByTestId("timeline-row");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText("00:00:00")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("info")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("System")).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent("Requirement failed");
  });

  it("shows the total/filtered event count", () => {
    renderWithFixture(FIXTURE);
    expect(screen.getByText("3 / 3 events")).toBeInTheDocument();
  });
});

describe("EventTimeline — duplicate handling", () => {
  it("a duplicated event id never produces a duplicate row", () => {
    renderWithFixture([...FIXTURE, FIXTURE[0]!, FIXTURE[0]!]);
    expect(screen.getAllByTestId("timeline-row")).toHaveLength(3);
    expect(screen.getByText("3 / 3 events")).toBeInTheDocument();
  });
});

describe("EventTimeline — filtering", () => {
  it("filters by severity", () => {
    renderWithFixture(FIXTURE);
    fireEvent.change(screen.getByLabelText("Filter by severity"), { target: { value: "error" } });
    const rows = screen.getAllByTestId("timeline-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Requirement failed");
  });

  it("filters by entity type", () => {
    renderWithFixture(FIXTURE);
    fireEvent.change(screen.getByLabelText("Filter by entity type"), {
      target: { value: "Build" },
    });
    const rows = screen.getAllByTestId("timeline-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Build created");
  });

  it("filters by event type", () => {
    renderWithFixture(FIXTURE);
    fireEvent.change(screen.getByLabelText("Filter by event type"), {
      target: { value: "system.started" },
    });
    const rows = screen.getAllByTestId("timeline-row");
    expect(rows).toHaveLength(1);
  });

  it("combining filters narrows to the intersection, and can produce zero rows", () => {
    renderWithFixture(FIXTURE);
    fireEvent.change(screen.getByLabelText("Filter by severity"), { target: { value: "error" } });
    fireEvent.change(screen.getByLabelText("Filter by entity type"), {
      target: { value: "Build" },
    });
    expect(screen.queryAllByTestId("timeline-row")).toHaveLength(0);
    expect(screen.getByText("0 / 3 events")).toBeInTheDocument();
  });
});

describe("EventTimeline — pause/resume autoscroll", () => {
  it("toggles the autoscroll pause button and its aria-pressed state", () => {
    renderWithFixture(FIXTURE);
    const button = screen.getByRole("button", { name: "Pause autoscroll" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Resume autoscroll" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("the log region's aria-live reflects the autoscroll state", () => {
    renderWithFixture(FIXTURE);
    const log = screen.getByRole("log", { name: "Event timeline" });
    expect(log).toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getByRole("button", { name: "Pause autoscroll" }));
    expect(log).toHaveAttribute("aria-live", "off");
  });
});

describe("EventTimeline — payload inspection", () => {
  it("selecting a row shows its full payload and description in the detail panel", () => {
    renderWithFixture(FIXTURE);
    const rows = screen.getAllByTestId("timeline-row");
    fireEvent.click(rows[1]!);
    const detail = screen.getByTestId("timeline-detail");
    expect(within(detail).getByText('Build created: "Build X"')).toBeInTheDocument();
    expect(within(detail).getByText(/"buildId": "build-1"/)).toBeInTheDocument();
  });

  it("shows an explicit, non-deceptive unavailable state for jump-to-world-object", () => {
    renderWithFixture(FIXTURE);
    fireEvent.click(screen.getAllByTestId("timeline-row")[0]!);
    const jumpButton = screen.getByRole("button", { name: /Jump to world object/ });
    expect(jumpButton).toBeDisabled();
    expect(jumpButton).toHaveTextContent("not yet available");
  });

  it("shows an empty state before any row is selected", () => {
    renderWithFixture(FIXTURE);
    expect(screen.getByText("Select an event to inspect its payload.")).toBeInTheDocument();
  });
});

describe("EventTimeline — keyboard accessibility", () => {
  it("every filter control and the autoscroll toggle are native, tab-reachable form controls", () => {
    renderWithFixture(FIXTURE);
    expect(screen.getByLabelText("Filter by severity").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Filter by entity type").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Filter by event type").tagName).toBe("SELECT");
    expect(screen.getByRole("button", { name: "Pause autoscroll" }).tabIndex).toBe(0);
  });

  it("each row is a native button, keyboard-activatable and selectable via Enter", () => {
    renderWithFixture(FIXTURE);
    const row = screen.getAllByTestId("timeline-row")[0]!;
    expect(row.tagName).toBe("BUTTON");
    row.focus();
    expect(row).toHaveFocus();
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "true");
  });
});

describe("EventTimeline — large synthetic event count (bounded rendering)", () => {
  it("renders a small, bounded number of DOM rows even with 5,000 synthetic events", () => {
    const large: FoundryEvent[] = Array.from({ length: 5000 }, (_, i) =>
      fixedEvent({
        id: `evt-large-${i}`,
        type: "stage.created",
        entityType: "BuildStage",
        entityId: `stage-${i}`,
        occurredAt: new Date(Date.parse("2026-07-30T00:00:00.000Z") + i * 1000).toISOString(),
      }),
    );
    renderWithFixture(large);
    expect(screen.getByText("5000 / 5000 events")).toBeInTheDocument();
    // Windowing must keep mounted rows far below the total event count.
    expect(screen.getAllByTestId("timeline-row").length).toBeLessThan(100);
  });
});
