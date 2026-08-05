import { RuntimeContext } from "@/lib/mock-runtime";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CommandBar } from "./CommandBar";
import type { CommandFailure } from "@/lib/backend/commandFeedback";
import { FIXTURE_JOURNEYS } from "@/lib/fixtures/journeys";
import type { ProjectionStatus } from "@/lib/runtime/adapter";

function renderCommandBar(overrides: {
  isRunning?: boolean;
  isComplete?: boolean;
  lastRejection?: CommandFailure | null;
  mutationsEnabled?: boolean;
  runtimeMode?: "mock" | "backend";
  withJourneys?: boolean;
  projectionStatus?: ProjectionStatus;
}) {
  const submitCommand = vi.fn<(raw: unknown) => void>();
  const selectFixtureJourney = vi.fn();
  const mutationsEnabled = overrides.mutationsEnabled ?? true;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RuntimeContext.Provider
        value={{
          runtimeMode: overrides.runtimeMode ?? "mock",
          events: [],
          worldState: createInitialWorldState(),
          isRunning: overrides.isRunning ?? false,
          isComplete: overrides.isComplete ?? false,
          connectionStatus: mutationsEnabled ? "connected" : "disconnected",
          mutationsEnabled,
          projectionStatus: overrides.projectionStatus,
          submitCommand,
          resolveApproval: vi.fn(),
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          lastRejection: overrides.lastRejection ?? null,
          fixtureJourneys: overrides.withJourneys ? FIXTURE_JOURNEYS : undefined,
          activeFixtureJourneyId: null,
          selectFixtureJourney: overrides.withJourneys ? selectFixtureJourney : undefined,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  return {
    ...render(<CommandBar />, { wrapper: Wrapper }),
    submitCommand,
    selectFixtureJourney,
  };
}

describe("CommandBar — typed command emission", () => {
  it("Start emits the exact bounded demo.start command", () => {
    const { submitCommand } = renderCommandBar({});
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(submitCommand).toHaveBeenCalledWith({ commandType: "demo.start", params: {} });
  });

  it("Pause emits demo.pause only when running", () => {
    const { submitCommand } = renderCommandBar({ isRunning: true });
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(submitCommand).toHaveBeenCalledWith({ commandType: "demo.pause", params: {} });
  });

  it("changing speed emits demo.set_speed with the selected multiplier", () => {
    const { submitCommand } = renderCommandBar({});
    fireEvent.change(screen.getByLabelText("Playback speed"), { target: { value: "4" } });
    expect(submitCommand).toHaveBeenCalledWith({
      commandType: "demo.set_speed",
      params: { multiplier: 4 },
    });
  });

  it("Reset and Replay emit their exact bounded commands", () => {
    const { submitCommand } = renderCommandBar({});
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(submitCommand).toHaveBeenCalledWith({ commandType: "demo.reset", params: {} });
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(submitCommand).toHaveBeenCalledWith({ commandType: "demo.replay", params: {} });
  });

  it("never emits any commandType outside the six approved values", () => {
    const { submitCommand } = renderCommandBar({ isRunning: true });
    const approved = new Set([
      "demo.start",
      "demo.pause",
      "demo.resume",
      "demo.set_speed",
      "demo.reset",
      "demo.replay",
    ]);
    for (const button of screen.getAllByRole("button")) {
      fireEvent.click(button);
    }
    for (const call of submitCommand.mock.calls) {
      const submitted = call[0] as { commandType: string };
      expect(approved.has(submitted.commandType)).toBe(true);
    }
  });
});

describe("CommandBar — bounded playback state", () => {
  it("Start is disabled while running; Pause is disabled while not running", () => {
    renderCommandBar({ isRunning: true });
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pause" })).not.toBeDisabled();
  });

  it("Start and Resume are disabled once the demo is complete", () => {
    renderCommandBar({ isComplete: true });
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();
  });
});

describe("CommandBar — fixture journey navigation", () => {
  it("selects a curated journey without emitting a domain or demo command", () => {
    const { selectFixtureJourney, submitCommand } = renderCommandBar({ withJourneys: true });

    fireEvent.change(screen.getByLabelText("Fixture journey"), {
      target: { value: "approval-gate" },
    });

    expect(selectFixtureJourney).toHaveBeenCalledWith("approval-gate");
    expect(submitCommand).not.toHaveBeenCalled();
  });

  it("does not expose fixture navigation in backend mode", () => {
    renderCommandBar({ runtimeMode: "backend" });
    expect(screen.queryByLabelText("Fixture journey")).not.toBeInTheDocument();
  });
});

describe("CommandBar — rejected-command feedback", () => {
  it("shows the rejection reason when a command is rejected", () => {
    renderCommandBar({
      lastRejection: {
        kind: "blocked",
        commandType: "shell.execute",
        title: "Blocked by current state",
        reason: "not approved",
        action: "Satisfy the stated prerequisite, then retry.",
      },
    });
    expect(screen.getByTestId("command-feedback")).toHaveTextContent("not approved");
  });

  it("shows running/paused/complete status when there is no rejection", () => {
    renderCommandBar({ isRunning: true });
    expect(screen.getByTestId("command-feedback")).toHaveTextContent("Running");
  });
});

describe("CommandBar — keyboard accessibility", () => {
  it("every command is a native, tab-reachable control", () => {
    renderCommandBar({});
    for (const name of ["Start", "Pause", "Resume", "Reset", "Replay"]) {
      const button = screen.getByRole("button", { name });
      expect(button.tagName).toBe("BUTTON");
      expect(button.tabIndex).toBe(0);
    }
    expect(screen.getByLabelText("Playback speed").tagName).toBe("SELECT");
  });
});

describe("CommandBar — mutation controls disabled while disconnected (F-10)", () => {
  it("disables every command control when mutations are not allowed", () => {
    renderCommandBar({ mutationsEnabled: false, isRunning: true });
    for (const name of ["Start", "Pause", "Resume", "Reset", "Replay"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(screen.getByLabelText("Playback speed")).toBeDisabled();
  });

  it("a disabled control cannot emit a command", () => {
    const { submitCommand } = renderCommandBar({ mutationsEnabled: false, isRunning: true });
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(submitCommand).not.toHaveBeenCalled();
  });

  it("re-enables controls once the connection is restored", () => {
    renderCommandBar({ mutationsEnabled: true, isRunning: true });
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
  });
});

/**
 * AC-106 — the demo-control disposition, and F-105/F-106 in the strip.
 */
describe("CommandBar — demo controls in backend mode (AC-106)", () => {
  it("disables every demo control, because the backend has no demo to control", () => {
    renderCommandBar({ runtimeMode: "backend" });
    for (const name of ["Start", "Pause", "Resume", "Reset", "Replay"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(screen.getByLabelText("Playback speed")).toBeDisabled();
  });

  it("states why they are unavailable, as text rather than a tooltip", () => {
    renderCommandBar({ runtimeMode: "backend" });
    const note = screen.getByTestId("demo-controls-unavailable");
    expect(note).toBeInTheDocument();
    expect(note.textContent).toMatch(/deterministic mock runtime/i);
    expect(note.textContent).toMatch(/nothing to start, pause, or replay/i);
  });

  it("associates the explanation with the control group for assistive tech", () => {
    renderCommandBar({ runtimeMode: "backend" });
    const group = screen.getByTestId("demo-controls");
    expect(group).toHaveAttribute("aria-describedby", "demo-controls-unavailable");
    expect(group).toHaveAttribute("data-available", "false");
  });

  it("emits nothing at all — no unknown command type is posted", () => {
    const { submitCommand } = renderCommandBar({ runtimeMode: "backend", isRunning: true });
    for (const button of screen.getAllByRole("button")) fireEvent.click(button);
    fireEvent.change(screen.getByLabelText("Playback speed"), { target: { value: "4" } });
    expect(submitCommand).not.toHaveBeenCalled();
  });

  it("leaves mock mode exactly as it was — controls enabled, no notice", () => {
    renderCommandBar({ runtimeMode: "mock" });
    expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
    expect(screen.queryByTestId("demo-controls-unavailable")).toBeNull();
  });
});

describe("CommandBar — every failure kind is visibly distinct (F-105)", () => {
  const failure = (kind: CommandFailure["kind"], title: string) => ({
    kind,
    commandType: "demo.start",
    title,
    reason: `reason for ${kind}`,
    action: `action for ${kind}`,
  });

  it.each([
    ["validation", "Invalid request"],
    ["unauthorized", "Not authorized"],
    ["unreachable", "Backend unreachable"],
    ["unsupported", "Not supported"],
    ["blocked", "Blocked by current state"],
  ] as const)("renders %s with its title, reason, and corrective action", (kind, title) => {
    renderCommandBar({ runtimeMode: "backend", lastRejection: failure(kind, title) });
    const status = screen.getByTestId("command-feedback");
    expect(status).toHaveAttribute("data-failure-kind", kind);
    expect(status).toHaveTextContent(title);
    expect(screen.getByTestId("command-feedback-reason")).toHaveTextContent(`reason for ${kind}`);
    expect(screen.getByTestId("command-feedback-action")).toHaveTextContent(`action for ${kind}`);
  });

  it("announces outcomes in a live region", () => {
    renderCommandBar({ runtimeMode: "backend" });
    expect(screen.getByTestId("command-feedback")).toHaveAttribute("aria-live", "polite");
  });

  it("reports no failure kind when nothing has failed", () => {
    renderCommandBar({ runtimeMode: "backend" });
    expect(screen.getByTestId("command-feedback")).toHaveAttribute("data-failure-kind", "none");
  });

  it("keeps the failure visible rather than clearing it on a timer", () => {
    // The previous implementation wiped the message after four seconds,
    // so a refusal could vanish before it was read.
    vi.useFakeTimers();
    try {
      renderCommandBar({
        runtimeMode: "backend",
        lastRejection: failure("blocked", "Blocked by current state"),
      });
      vi.advanceTimersByTime(30_000);
      expect(screen.getByTestId("command-feedback")).toHaveTextContent("reason for blocked");
    } finally {
      vi.useRealTimers();
    }
  });

  it("states the backend-mode status when idle, not a demo playback state", () => {
    renderCommandBar({ runtimeMode: "backend" });
    expect(screen.getByTestId("command-feedback")).toHaveTextContent("Backend mode — live");
  });

  it("says so when backend mode is disconnected", () => {
    renderCommandBar({ runtimeMode: "backend", mutationsEnabled: false });
    expect(screen.getByTestId("command-feedback")).toHaveTextContent("Backend mode — disconnected");
  });

  it("distinguishes projection synchronization from transport disconnection", () => {
    renderCommandBar({
      runtimeMode: "backend",
      mutationsEnabled: false,
      projectionStatus: "stale",
    });
    expect(screen.getByTestId("command-feedback")).toHaveTextContent(
      "Backend mode — synchronizing",
    );
  });
});
