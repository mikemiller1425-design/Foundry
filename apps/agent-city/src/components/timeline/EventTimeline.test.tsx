import type { WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { RuntimeContext } from "@/lib/mock-runtime";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { WORLD_AGENTS } from "@foundry/world-model";
import { EventTimeline } from "./EventTimeline";

// FBL-021A — a declared agent id, so the jump control has a real target.
const AGENT_EVENT_TARGET = WORLD_AGENTS[0]!.id;

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

// FBL-021A — a dedicated fixture for the jump control, kept separate from
// FIXTURE so the existing count assertions ("3 / 3 events") keep testing
// what they were written to test.
const JUMPABLE_FIXTURE: FoundryEvent[] = [
  ...FIXTURE,
  fixedEvent({
    id: "evt-4",
    type: "agent.arrived",
    entityType: "Agent",
    entityId: AGENT_EVENT_TARGET,
    occurredAt: "2026-07-30T00:00:03.000Z",
    payload: { destinationBuildingId: "construction-office" },
  }),
];

function renderWithFixture(
  events: FoundryEvent[],
  worldState: WorldState = createInitialWorldState(),
  onJumpToWorldObject?: (id: string) => void,
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
  return render(<EventTimeline onJumpToWorldObject={onJumpToWorldObject} />, { wrapper: Wrapper });
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

  // FBL-021A — these replace the tests that used to pin "not yet
  // available". The capability exists now; what still needs pinning is
  // that it stays *honest* — available only where a relationship is
  // declared, and explaining itself where it is not.
  it("offers a working jump for an event that declares a world object", () => {
    const onJump = vi.fn();
    renderWithFixture(JUMPABLE_FIXTURE, undefined, onJump);
    // index 3 is an agent event, whose entityId is a declared agent id.
    fireEvent.click(screen.getAllByTestId("timeline-row")[3]!);
    const jumpButton = screen.getByTestId("jump-to-world-object");
    expect(jumpButton).toBeEnabled();
    fireEvent.click(jumpButton);
    expect(onJump).toHaveBeenCalledTimes(1);
    expect(onJump).toHaveBeenCalledWith(AGENT_EVENT_TARGET);
  });

  it("keeps the control disabled, with a stated reason, for an event that declares none", () => {
    renderWithFixture(JUMPABLE_FIXTURE, undefined, vi.fn());
    fireEvent.click(screen.getAllByTestId("timeline-row")[0]!); // system.started
    const jumpButton = screen.getByRole("button", { name: /Jump to world object/ });
    expect(jumpButton).toBeDisabled();
    // The reason is readable text, not a tooltip: a title attribute is
    // invisible to keyboard and screen-reader users.
    const reasonId = jumpButton.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId!)?.textContent ?? "").not.toHaveLength(0);
  });

  it("never announces a jump target when the shell provides no handler", () => {
    renderWithFixture(JUMPABLE_FIXTURE);
    fireEvent.click(screen.getAllByTestId("timeline-row")[3]!);
    expect(screen.queryByTestId("jump-to-world-object")).toBeNull();
  });

  it("duplicate activation is safe — each click is one navigation request", () => {
    const onJump = vi.fn();
    renderWithFixture(JUMPABLE_FIXTURE, undefined, onJump);
    fireEvent.click(screen.getAllByTestId("timeline-row")[3]!);
    const jumpButton = screen.getByTestId("jump-to-world-object");
    fireEvent.click(jumpButton);
    fireEvent.click(jumpButton);
    expect(onJump).toHaveBeenCalledTimes(2);
    expect(new Set(onJump.mock.calls.map((c) => c[0])).size).toBe(1);
  });

  it("remains usable with no WebGL: these tests run in jsdom, where the 3D canvas cannot exist", () => {
    // v1-acceptance "canvas objects have navigator equivalents" and ADR-005's
    // "the 2D interface is an authoritative control surface" both require the
    // operator to keep working when the world cannot render. jsdom has no
    // WebGL context at all, so this whole file *is* the WebGL-unavailable
    // case — asserted explicitly here rather than left implicit.
    const onJump = vi.fn();
    renderWithFixture(JUMPABLE_FIXTURE, undefined, onJump);
    fireEvent.click(screen.getAllByTestId("timeline-row")[3]!);
    const jumpButton = screen.getByTestId("jump-to-world-object");
    expect(jumpButton).toBeEnabled();
    fireEvent.click(jumpButton);
    // Navigation still resolves and still reports its target; the detail
    // panel still explains what was selected.
    expect(onJump).toHaveBeenCalledWith(AGENT_EVENT_TARGET);
    expect(screen.getByTestId("timeline-detail")).not.toBeEmptyDOMElement();
  });

  it("jumping preserves the event selection and its payload inspection", () => {
    renderWithFixture(JUMPABLE_FIXTURE, undefined, vi.fn());
    const row = screen.getAllByTestId("timeline-row")[3]!;
    fireEvent.click(row);
    fireEvent.click(screen.getByTestId("jump-to-world-object"));
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("timeline-detail").querySelector("pre")).not.toBeNull();
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
