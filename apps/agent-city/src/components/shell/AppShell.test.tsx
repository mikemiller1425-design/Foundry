import { RuntimeProvider } from "@/lib/mock-runtime";
import { RuntimeContext, type RuntimeContextValue } from "@/lib/mock-runtime/RuntimeProvider";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

function renderShell() {
  return render(
    <RuntimeProvider seed="app-shell-test">
      <AppShell />
    </RuntimeProvider>,
  );
}

describe("AppShell panel interactivity (FBL-006)", () => {
  it("left navigation starts expanded and collapses/expands via its toggle", () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: "Collapse left navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "World navigator" })).toBeInTheDocument();

    fireEvent.click(toggle);
    const expandToggle = screen.getByRole("button", { name: "Expand left navigation" });
    expect(expandToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "World navigator" })).not.toBeInTheDocument();

    fireEvent.click(expandToggle);
    expect(screen.getByRole("button", { name: "Collapse left navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("right live-intelligence and the event timeline are independently collapsible", () => {
    renderShell();

    const intelToggle = screen.getByRole("button", { name: "Collapse right live-intelligence" });
    fireEvent.click(intelToggle);
    expect(screen.getByRole("button", { name: "Expand right live-intelligence" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    const timelineToggle = screen.getByRole("button", { name: "Collapse event timeline" });
    fireEvent.click(timelineToggle);
    expect(screen.getByRole("button", { name: "Expand event timeline" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    // Left navigation is unaffected by collapsing the other two panels.
    expect(screen.getByRole("button", { name: "Collapse left navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("exposes a resize handle (ARIA separator) for each resizable panel while expanded", () => {
    renderShell();
    expect(screen.getByRole("separator", { name: "Resize left navigation" })).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: "Resize right live-intelligence" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize event timeline" })).toBeInTheDocument();
  });

  it("hides a panel's resize handle while that panel is collapsed", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Collapse left navigation" }));
    expect(
      screen.queryByRole("separator", { name: "Resize left navigation" }),
    ).not.toBeInTheDocument();
  });

  it("reset layout expands every panel again after collapsing all three", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Collapse left navigation" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse right live-intelligence" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse event timeline" }));

    fireEvent.click(screen.getByRole("button", { name: "Reset layout" }));

    expect(screen.getByRole("button", { name: "Collapse left navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Collapse right live-intelligence" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Collapse event timeline" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("switches between a world-first view and the complete operating layout", () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "World" }));
    expect(screen.getByRole("button", { name: "World" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Expand left navigation" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand right live-intelligence" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand event timeline" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Operate" }));
    expect(screen.getByRole("button", { name: "Operate" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Collapse left navigation" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse right live-intelligence" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse event timeline" })).toBeInTheDocument();
  });

  it("opens the world overview without implying future districts are implemented", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Map" }));

    expect(screen.getByRole("button", { name: "Map" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Foundry world overview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Knowledge Reach/ }));
    expect(screen.getByText("No implementation")).toBeInTheDocument();
  });

  it("opens and exits a fictional tenant showroom from its declared parcel", () => {
    renderShell();
    fireEvent.click(
      screen.getByRole("button", { name: /Production Row\s*Forgeworks Cooperative/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Preview fictional tenant space/ }));

    expect(
      screen.getByRole("region", { name: "Forgeworks Cooperative fixture showroom" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit preview" }));
    expect(
      screen.queryByRole("region", { name: "Forgeworks Cooperative fixture showroom" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the visible authority badge aligned with fixture journey selection", () => {
    renderShell();

    expect(screen.getByTestId("runtime-source")).toHaveTextContent("Fixture · V1 canonical run");
    fireEvent.change(screen.getByLabelText("Fixture journey"), {
      target: { value: "approval-gate" },
    });

    expect(screen.getByTestId("runtime-source")).toHaveTextContent("Fixture · Approval gate");
    expect(screen.getByTestId("runtime-source")).toHaveAttribute(
      "title",
      "World state is projected from a deterministic frontend fixture.",
    );
  });

  it("enters a world-first posture on compact viewports without removing panel toggles", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        media: "(max-width: 900px)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );
    try {
      renderShell();

      expect(screen.getByRole("button", { name: "World" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Expand left navigation" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Expand right live-intelligence" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Expand event timeline" })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("AppShell — the objective control (AC-103)", () => {
  function renderBackendShell(overrides: Partial<RuntimeContextValue> = {}) {
    return render(
      <RuntimeContext.Provider
        value={{
          events: [],
          worldState: createInitialWorldState(),
          isRunning: false,
          isComplete: false,
          connectionStatus: "connected",
          mutationsEnabled: true,
          submitCommand: vi.fn(),
          submitObjective: vi.fn(async () => ({ accepted: true })),
          resolveApproval: vi.fn(),
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          lastRejection: null,
          operatorCredentialRequired: false,
          ...overrides,
        }}
      >
        <AppShell />
      </RuntimeContext.Provider>,
    );
  }

  it("is absent in mock mode, where an objective could not become real work", () => {
    renderShell();
    expect(screen.queryByTestId("objective-form")).not.toBeInTheDocument();
  });

  it("is present in the left navigator in backend mode", () => {
    renderBackendShell();
    expect(screen.getByTestId("objective-form")).toBeInTheDocument();
  });

  it("sits directly above the Current build panel it will populate", () => {
    renderBackendShell();
    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    const html = nav.innerHTML;
    expect(html.indexOf("objective-form")).toBeGreaterThan(-1);
    expect(html.indexOf("objective-form")).toBeLessThan(html.indexOf("Current build"));
  });

  it("shows the operator's submitted objective once it is backend truth", () => {
    renderBackendShell({
      worldState: {
        ...createInitialWorldState(),
        currentBuild: {
          id: "build-1",
          projectId: "project-1",
          sequenceNumber: 1,
          status: "planned",
          objectiveSnapshot: "Add a JSON task store module with tests",
          currentStageId: null,
          createdAt: "2026-08-03T00:00:00.000Z",
          updatedAt: "2026-08-03T00:00:00.000Z",
        },
      },
    });
    expect(screen.getByText(/Add a JSON task store module with tests/)).toBeInTheDocument();
    expect(screen.queryByText("No build yet.")).not.toBeInTheDocument();
  });
});

describe("AppShell — Command Center integration (1b-iii hardening)", () => {
  it("keeps Command Center unavailable in mock mode beside 1b-i panels and the world", () => {
    renderShell();
    expect(screen.getByTestId("shell-world")).toBeInTheDocument();
    expect(screen.getByTestId("command-center-panel")).toBeInTheDocument();
    expect(screen.getByTestId("command-center-status")).toHaveTextContent(/Unavailable/);
    expect(screen.queryByTestId("command-center-glance")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Agent trace replay" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Operational snapshot" })).toBeInTheDocument();
  });

  it("places L1–L3 inside live intelligence without replacing the world canvas", async () => {
    const { COMMAND_CENTER_SAMPLE_SNAPSHOT } = await import(
      "@/lib/command-center/sampleSnapshot"
    );
    render(
      <RuntimeContext.Provider
        value={{
          events: [],
          worldState: createInitialWorldState(),
          isRunning: false,
          isComplete: false,
          connectionStatus: "connected",
          mutationsEnabled: false,
          submitCommand: vi.fn(),
          resolveApproval: vi.fn(),
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          lastRejection: null,
          runtimeMode: "backend",
          projectionStatus: "current",
          commandCenter: COMMAND_CENTER_SAMPLE_SNAPSHOT,
          commandCenterStatus: "current",
        }}
      >
        <AppShell />
      </RuntimeContext.Provider>,
    );

    expect(screen.getByTestId("shell-world")).toBeInTheDocument();
    expect(screen.getByTestId("shell-intel")).toContainElement(
      screen.getByTestId("command-center-panel"),
    );
    expect(screen.getByTestId("command-center-glance")).toHaveTextContent("Software build");
    expect(screen.getByTestId("command-center-mission")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Open tactical mission Software build/i }));
    expect(screen.getByTestId("command-center-mission")).toHaveTextContent("Ship the thing");

    fireEvent.click(screen.getByTestId("command-center-evidence-toggle"));
    expect(screen.getByTestId("command-center-evidence")).toHaveTextContent("obj-1");
    fireEvent.click(screen.getByTestId("command-center-evidence-toggle"));
    expect(screen.queryByTestId("command-center-evidence")).not.toBeInTheDocument();
  });
});
