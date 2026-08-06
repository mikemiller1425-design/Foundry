import { RuntimeContext } from "@/lib/mock-runtime";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { COMMAND_CENTER_SAMPLE_SNAPSHOT } from "@/lib/command-center/sampleSnapshot";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CommandCenterPanel } from "./CommandCenterPanel";
import type { RuntimeContextValue } from "@/lib/mock-runtime/RuntimeProvider";

function renderWith(overrides: Partial<RuntimeContextValue> = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
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
        ...overrides,
      }}
    >
      {children}
    </RuntimeContext.Provider>
  );
  return render(<CommandCenterPanel />, { wrapper });
}

describe("CommandCenterPanel", () => {
  it("renders world-glance figures from the backend snapshot only", () => {
    renderWith();
    expect(screen.getByTestId("command-center-status")).toHaveTextContent("Current");
    expect(screen.getByTestId("command-center-glance")).toHaveTextContent("Software build");
    expect(screen.getByTestId("command-center-glance")).toHaveTextContent("Not connected");
    expect(screen.getByTestId("command-center-glance")).toHaveTextContent(
      "No received revenue is recorded",
    );
    expect(screen.getByTestId("command-center-mission")).toHaveTextContent("not recorded");
  });

  it("opens level-3 evidence without requiring it for glance or mission", () => {
    renderWith();
    expect(screen.queryByTestId("command-center-evidence")).toBeNull();
    fireEvent.click(screen.getByTestId("command-center-evidence-toggle"));
    expect(screen.getByTestId("command-center-evidence")).toHaveTextContent(
      "operator.objective_submitted",
    );
    expect(screen.getByTestId("command-center-evidence")).toHaveTextContent("obj-1");
  });

  it("states unavailable honestly in mock mode without inventing figures", () => {
    renderWith({
      runtimeMode: "mock",
      commandCenter: null,
      commandCenterStatus: "unavailable",
    });
    expect(screen.getByTestId("command-center-status")).toHaveTextContent(/Unavailable/);
    expect(screen.queryByTestId("command-center-glance")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/no Command Center transport/i);
  });

  it("never treats an invalid contract as an empty success", () => {
    renderWith({
      commandCenter: null,
      commandCenterStatus: "invalid_contract",
    });
    expect(screen.getByTestId("command-center-status")).toHaveTextContent("Invalid contract");
    expect(screen.queryByTestId("command-center-glance")).toBeNull();
  });
});
