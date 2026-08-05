import { RuntimeContext } from "@/lib/mock-runtime";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { reduceWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentTracePanel } from "./AgentTracePanel";

describe("AgentTracePanel", () => {
  it("replays a declared departure cursor without claiming a precise path", () => {
    const events = buildCanonicalScript("agent-trace-panel-test");
    const previewAtCursor = vi.fn();
    const onSelect = vi.fn();
    render(
      <RuntimeContext.Provider
        value={{
          events,
          worldState: reduceWorldState(events),
          isRunning: false,
          isComplete: true,
          submitCommand: vi.fn(),
          resolveApproval: vi.fn(),
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          connectionStatus: "connected",
          mutationsEnabled: true,
          lastRejection: null,
          fixtureReplay: { events, cursor: events.length, previewAtCursor },
        }}
      >
        <AgentTracePanel onSelect={onSelect} />
      </RuntimeContext.Provider>,
    );

    const first = screen.getAllByRole("button", { name: /Replay trace/ })[0]!;
    fireEvent.click(first);
    expect(previewAtCursor).toHaveBeenCalledWith(expect.any(Number));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: "agent" }));
    expect(screen.getByText(/not a precise path, live location/i)).toBeInTheDocument();
  });

  it("does not render against a provider without fixture replay capability", () => {
    const events = buildCanonicalScript("agent-trace-backend-test");
    render(
      <RuntimeContext.Provider
        value={{
          events,
          worldState: reduceWorldState(events),
          isRunning: false,
          isComplete: true,
          submitCommand: vi.fn(),
          resolveApproval: vi.fn(),
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          connectionStatus: "connected",
          mutationsEnabled: false,
          lastRejection: null,
        }}
      >
        <AgentTracePanel onSelect={vi.fn()} />
      </RuntimeContext.Provider>,
    );

    expect(screen.queryByRole("region", { name: "Agent trace replay" })).toBeNull();
  });
});
