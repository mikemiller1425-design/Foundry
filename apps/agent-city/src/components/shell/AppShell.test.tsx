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
    expect(screen.getByText(/Left navigation/)).toBeInTheDocument();

    fireEvent.click(toggle);
    const expandToggle = screen.getByRole("button", { name: "Expand left navigation" });
    expect(expandToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/^Left navigation$/)).not.toBeInTheDocument();

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
