import { RuntimeContext } from "@/lib/mock-runtime";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CommandBar } from "./CommandBar";

function renderCommandBar(overrides: {
  isRunning?: boolean;
  isComplete?: boolean;
  lastRejection?: { commandType: string; reason: string } | null;
}) {
  const submitCommand = vi.fn<(raw: unknown) => void>();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RuntimeContext.Provider
        value={{
          events: [],
          worldState: createInitialWorldState(),
          isRunning: overrides.isRunning ?? false,
          isComplete: overrides.isComplete ?? false,
          submitCommand,
          resolveApproval: vi.fn(),
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          lastRejection: overrides.lastRejection ?? null,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  return { ...render(<CommandBar />, { wrapper: Wrapper }), submitCommand };
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

describe("CommandBar — rejected-command feedback", () => {
  it("shows the rejection reason when a command is rejected", () => {
    renderCommandBar({ lastRejection: { commandType: "shell.execute", reason: "not approved" } });
    expect(screen.getByTestId("command-feedback")).toHaveTextContent(
      "Rejected: shell.execute — not approved",
    );
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
