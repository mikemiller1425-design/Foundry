import { RuntimeContext } from "@/lib/mock-runtime";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { render, screen } from "@testing-library/react";
import type { ContextType, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RuntimeReadinessPanel } from "./RuntimeReadinessPanel";

function renderPanel(overrides: Partial<NonNullable<ContextType<typeof RuntimeContext>>> = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RuntimeContext.Provider
      value={{
        runtimeMode: "mock",
        runtimeSource: {
          kind: "fixture",
          fixtureId: "readiness-test",
          label: "Readiness test",
          authority: "fixture",
        },
        projectionStatus: "current",
        events: [],
        worldState: createInitialWorldState(),
        isRunning: false,
        isComplete: false,
        submitCommand: vi.fn(),
        resolveApproval: vi.fn(),
        selectBuilding: vi.fn(),
        clearSelection: vi.fn(),
        connectionStatus: "connected",
        mutationsEnabled: true,
        lastRejection: null,
        ...overrides,
      }}
    >
      {children}
    </RuntimeContext.Provider>
  );
  render(<RuntimeReadinessPanel />, { wrapper });
}

describe("RuntimeReadinessPanel", () => {
  it("labels fixture authority and local controls without claiming production readiness", () => {
    renderPanel();
    expect(screen.getByText("Contract aligned")).toBeInTheDocument();
    expect(screen.getByText("Fixture · Readiness test")).toBeInTheDocument();
    expect(screen.getByText("fixture-local")).toBeInTheDocument();
    expect(
      screen.getByText(/not backend, security, accessibility, or production readiness/i),
    ).toBeInTheDocument();
  });

  it("does not call a stale backend projection aligned when writes are enabled", () => {
    renderPanel({
      runtimeMode: "backend",
      runtimeSource: { kind: "backend", label: "Foundry backend", authority: "backend" },
      projectionStatus: "stale",
      mutationsEnabled: true,
    });
    expect(screen.getByText("Degraded metadata")).toBeInTheDocument();
  });
});
