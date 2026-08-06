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

  it("labels the external-action count with the projection's interval, not the mission's", () => {
    renderWith();
    const mission = screen.getByTestId("command-center-mission");
    // The count comes from the snapshot-level external-action projection over
    // its own `(fromSequenceExclusive, toSequenceInclusive]`. Labelling it
    // "(mission interval)" attributed that figure to a single mission.
    expect(mission).not.toHaveTextContent("mission interval");
    expect(mission).toHaveTextContent("classified interval (0, 4]");
  });

  it("says unconfigured for an unconfigured decision batch and invents no schedule", () => {
    renderWith();
    const glance = screen.getByTestId("command-center-glance");
    expect(glance).toHaveTextContent("Unconfigured — no scheduled batch is active.");
    expect(glance).not.toHaveTextContent(/\d\d:\d\d/);
  });

  it("states a configured batch schedule from the policy rather than only 'enabled'", () => {
    renderWith({
      commandCenter: {
        ...COMMAND_CENTER_SAMPLE_SNAPSHOT,
        decisionBatchPolicy: {
          timezone: "America/New_York",
          schedule: { kind: "daily", atLocalTime: "09:00" },
          nextExpectedBatchAt: "2026-08-07T13:00:00.000Z",
          enabled: true,
          immediateInterruptionCategories: ["safety_issue"],
          configuredAt: "2026-08-06T00:00:00.000Z",
          configuredBy: "operator-1",
        },
      },
    });
    const glance = screen.getByTestId("command-center-glance");
    expect(glance).toHaveTextContent("Daily at 09:00 (America/New_York)");
    expect(glance).toHaveTextContent("next: 2026-08-07T13:00:00.000Z");
  });

  it("shows the backend-owned immediate-interruption categories", () => {
    renderWith();
    expect(screen.getByTestId("command-center-glance")).toHaveTextContent("urgent deadline");
  });

  it("does not explain a lost backend as a snapshot catching up", () => {
    renderWith({ commandCenterStatus: "stale", connectionStatus: "disconnected" });
    const body = screen.getAllByRole("status")[0];
    expect(body).toHaveTextContent(/Disconnected from the backend/i);
    expect(body).toHaveTextContent(/no longer being refreshed/i);
    expect(body).not.toHaveTextContent(/catching up to a newer event/i);
  });

  it("still explains an in-flight refresh as catching up while connected", () => {
    renderWith({ commandCenterStatus: "stale", connectionStatus: "connected" });
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(/catching up to a newer event/i);
  });

  it("scopes the level-1 external-action count to the projection's interval", () => {
    renderWith({
      commandCenter: {
        ...COMMAND_CENTER_SAMPLE_SNAPSHOT,
        externalActions: {
          projection: {
            ...COMMAND_CENTER_SAMPLE_SNAPSHOT.externalActions.projection,
            actions: [
              {
                actionKey: "agentrun:run-1",
                category: "model_or_remote_agent_invocation",
                phase: "succeeded",
                firstObservedAt: "2026-08-05T00:00:00.000Z",
                lastObservedAt: "2026-08-05T00:00:00.000Z",
                costUsd: null,
                evidence: [{ eventId: "e-1", eventType: "agentrun.completed" }],
                lifecycleEventIds: ["e-1"],
              },
            ],
          },
          // Null because actions exist — the derived negative is not a default.
          noQualifyingActionsStatement: null,
        },
      },
    });
    expect(screen.getByTestId("command-center-glance")).toHaveTextContent(
      "1 qualifying in (0, 4] · classifier v1",
    );
  });
});
