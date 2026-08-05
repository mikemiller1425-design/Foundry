import type { ConnectionStatus, WorldState } from "@foundry/contracts";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RuntimeContext } from "@/lib/mock-runtime";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { computeLighthouseState } from "@/lib/world/lighthouseState";
import { applyConnectionStatus } from "@/lib/backend/connectionState";
import { ApprovalCard } from "./ApprovalCard";
import { ConnectionBanner } from "./ConnectionBanner";
import type { ProjectionStatus } from "@/lib/runtime/adapter";

function wrapper(
  connectionStatus: ConnectionStatus,
  worldState?: WorldState,
  projectionStatus: ProjectionStatus = "current",
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RuntimeContext.Provider
        value={{
          events: [],
          worldState: worldState ?? createInitialWorldState(),
          isRunning: connectionStatus === "connected",
          isComplete: false,
          connectionStatus,
          projectionStatus,
          mutationsEnabled: connectionStatus === "connected" && projectionStatus === "current",
          submitCommand: vi.fn(),
          resolveApproval: vi.fn(),
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          lastRejection: null,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  };
}

describe("ConnectionBanner — F-10 stale labeling", () => {
  it("renders nothing while connected", () => {
    render(<ConnectionBanner />, { wrapper: wrapper("connected") });
    expect(screen.queryByTestId("connection-banner")).not.toBeInTheDocument();
  });

  it("shows a stale banner while disconnected", () => {
    render(<ConnectionBanner />, { wrapper: wrapper("disconnected") });
    const banner = screen.getByTestId("connection-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/disconnected/i);
    expect(banner).toHaveTextContent(/last known state/i);
  });

  it("communicates status by text, not by color alone", () => {
    render(<ConnectionBanner />, { wrapper: wrapper("disconnected") });
    expect(screen.getByTestId("connection-banner")).toHaveTextContent(/disconnected/i);
  });

  it("distinguishes a connected stream from a projection that is still synchronizing", () => {
    render(<ConnectionBanner />, { wrapper: wrapper("connected", undefined, "stale") });
    const banner = screen.getByTestId("connection-banner");
    expect(banner).toHaveTextContent(/synchronizing world projection/i);
    expect(banner).toHaveTextContent(/last known state/i);
    expect(banner).toHaveAttribute("data-connection-status", "connected");
    expect(banner).toHaveAttribute("data-projection-status", "stale");
  });

  it("distinguishes an unavailable projection from a stale retained one", () => {
    render(<ConnectionBanner />, { wrapper: wrapper("connected", undefined, "unavailable") });
    expect(screen.getByTestId("connection-banner")).toHaveTextContent(
      /world projection unavailable/i,
    );
  });
});

describe("Mutation controls are disabled while disconnected (F-10)", () => {
  function worldStateWithPendingApproval(): WorldState {
    const base = createInitialWorldState();
    return {
      ...base,
      approvals: [
        {
          id: "approval-1",
          buildId: "build-1",
          stageId: "stage-1",
          status: "pending",
          riskClass: "R1",
          title: "Approve deployment",
          reason: "QA validation passed",
          recommendedAction: "approve",
          evidenceIds: [],
          requestedAt: "2026-07-30T00:00:00.000Z",
        },
      ],
    };
  }

  it("enables approval actions while connected", () => {
    render(<ApprovalCard />, {
      wrapper: wrapper("connected", worldStateWithPendingApproval()),
    });
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Request revision" })).toBeEnabled();
  });

  it("disables every approval action while disconnected", () => {
    render(<ApprovalCard />, {
      wrapper: wrapper("disconnected", worldStateWithPendingApproval()),
    });
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request revision" })).toBeDisabled();
  });

  it("disables every approval action while the connected projection is stale", () => {
    render(<ApprovalCard />, {
      wrapper: wrapper("connected", worldStateWithPendingApproval(), "stale"),
    });
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request revision" })).toBeDisabled();
  });
});

describe("Lighthouse shows disconnected (F-10)", () => {
  it("computeLighthouseState resolves to disconnected once the connection is lost", () => {
    const connected = createInitialWorldState();
    expect(computeLighthouseState(connected)).not.toBe("disconnected");

    const disconnected = applyConnectionStatus(connected, "disconnected");
    expect(computeLighthouseState(disconnected)).toBe("disconnected");
  });

  it("a disconnected projection outranks routine operational activity", () => {
    const busy: WorldState = {
      ...createInitialWorldState(),
      currentBuild: {
        id: "build-1",
        projectId: "project-1",
        sequenceNumber: 1,
        status: "running",
        objectiveSnapshot: "Build a thing",
        currentStageId: "stage-1",
        createdAt: "2026-07-30T00:00:00.000Z",
        updatedAt: "2026-07-30T00:00:00.000Z",
      },
    };
    expect(computeLighthouseState(busy)).toBe("active");
    expect(computeLighthouseState(applyConnectionStatus(busy, "disconnected"))).toBe(
      "disconnected",
    );
  });
});
