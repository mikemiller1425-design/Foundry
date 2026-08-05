import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntime, RuntimeProvider } from "./RuntimeProvider";
import { loadRuntimeCursor } from "./sessionPersistence";

function Probe() {
  const { events, isRunning, isComplete, runtimeSource } = useRuntime();
  return (
    <div>
      <span data-testid="event-count">{events.length}</span>
      <span data-testid="is-running">{String(isRunning)}</span>
      <span data-testid="is-complete">{String(isComplete)}</span>
      <span data-testid="runtime-source">{runtimeSource?.kind}</span>
    </div>
  );
}

function ProbeWithReplay() {
  const { events, submitCommand } = useRuntime();
  return (
    <div>
      <span data-testid="event-count">{events.length}</span>
      <button onClick={() => submitCommand({ commandType: "demo.replay", params: {} })}>
        Replay
      </button>
    </div>
  );
}

function JourneyProbe() {
  const {
    events,
    worldState,
    isRunning,
    isComplete,
    runtimeSource,
    fixtureJourneys,
    selectFixtureJourney,
  } = useRuntime();
  return (
    <div>
      <span data-testid="journey-event-type">{events.at(-1)?.type ?? "none"}</span>
      <span data-testid="journey-running">{String(isRunning)}</span>
      <span data-testid="journey-complete">{String(isComplete)}</span>
      <span data-testid="journey-source">
        {runtimeSource?.kind === "fixture" ? runtimeSource.fixtureId : "not-fixture"}
      </span>
      <span data-testid="journey-pending">
        {String(worldState.approvals.some((approval) => approval.status === "pending"))}
      </span>
      <button onClick={() => selectFixtureJourney?.("approval-gate")}>Approval fixture</button>
      <button onClick={() => selectFixtureJourney?.("completed-run")}>Completed fixture</button>
      <span>{fixtureJourneys?.length ?? 0} journeys</span>
    </div>
  );
}

describe("RuntimeProvider — auto-start (no command bar exists before FBL-010)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("automatically starts the demo on mount and events accumulate over time", () => {
    render(
      <RuntimeProvider seed="provider-autostart">
        <Probe />
      </RuntimeProvider>,
    );
    // The auto-issued demo.start command's own feedback events are
    // synchronous; script playback is what's paced over time.
    const initialCount = Number(screen.getByTestId("event-count").textContent);
    expect(initialCount).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(Number(screen.getByTestId("event-count").textContent)).toBeGreaterThan(initialCount);
    expect(screen.getByTestId("runtime-source")).toHaveTextContent("fixture");
  });

  it("persists a {seed, cursor} marker to sessionStorage as events are emitted", () => {
    render(
      <RuntimeProvider seed="provider-persist">
        <Probe />
      </RuntimeProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const marker = loadRuntimeCursor();
    expect(marker?.seed).toBe("provider-persist");
    expect(marker?.cursor).toBeGreaterThan(0);
  });
});

describe("RuntimeProvider — history reconstruction after reload", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reconstructs prior history instantly (without backend persistence) from a saved cursor for the same seed", () => {
    const { unmount } = render(
      <RuntimeProvider seed="provider-reload">
        <Probe />
      </RuntimeProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    const countBeforeReload = Number(screen.getByTestId("event-count").textContent);
    expect(countBeforeReload).toBeGreaterThan(0);
    unmount();

    // Simulate a reload: a fresh provider instance, same seed, reads the
    // session marker synchronously on mount — no waiting for timers.
    render(
      <RuntimeProvider seed="provider-reload">
        <Probe />
      </RuntimeProvider>,
    );
    expect(Number(screen.getByTestId("event-count").textContent)).toBeGreaterThanOrEqual(
      countBeforeReload,
    );
  });

  it("a saved marker for a different seed is ignored (never applied across seeds)", () => {
    const { unmount } = render(
      <RuntimeProvider seed="provider-seed-a">
        <Probe />
      </RuntimeProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    unmount();

    render(
      <RuntimeProvider seed="provider-seed-b">
        <Probe />
      </RuntimeProvider>,
    );
    // Starts fresh — only its own auto-issued demo.start feedback events,
    // never seed-a's accumulated history reconstructed onto the wrong seed.
    expect(screen.getByTestId("event-count").textContent).toBe("2");
  });
});

describe("RuntimeProvider — curated fixture journeys", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads a semantic journey as a paused canonical projection", () => {
    render(
      <RuntimeProvider seed="provider-journey">
        <JourneyProbe />
      </RuntimeProvider>,
    );

    act(() => screen.getByRole("button", { name: "Approval fixture" }).click());

    expect(screen.getByText("6 journeys")).toBeInTheDocument();
    expect(screen.getByTestId("journey-event-type")).toHaveTextContent("approval.requested");
    expect(screen.getByTestId("journey-pending")).toHaveTextContent("true");
    expect(screen.getByTestId("journey-running")).toHaveTextContent("false");
    expect(screen.getByTestId("journey-source")).toHaveTextContent("approval-gate");
    expect(loadRuntimeCursor()).toBeNull();
  });

  it("can inspect the completed recording without weakening the live approval gate", () => {
    render(
      <RuntimeProvider seed="provider-completed-journey">
        <JourneyProbe />
      </RuntimeProvider>,
    );

    act(() => screen.getByRole("button", { name: "Completed fixture" }).click());

    expect(screen.getByTestId("journey-source")).toHaveTextContent("completed-run");
    expect(screen.getByTestId("journey-running")).toHaveTextContent("false");
    expect(screen.getByTestId("journey-pending")).toHaveTextContent("false");
    expect(screen.getByTestId("journey-complete")).toHaveTextContent("true");
  });
});

describe("RuntimeProvider — FBL-022 demo.replay resets local event history", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("demo.replay clears the locally accumulated events, rather than appending the replayed sequence on top of the prior run's", () => {
    render(
      <RuntimeProvider seed="provider-replay-reset">
        <ProbeWithReplay />
      </RuntimeProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    const countBeforeReplay = Number(screen.getByTestId("event-count").textContent);
    expect(countBeforeReplay).toBeGreaterThan(0);

    act(() => {
      screen.getByRole("button", { name: "Replay" }).click();
    });
    // Immediately after replay — before any of the replayed script's own
    // events have had time to re-emit — the count must not still include
    // the prior run's history. (Regression: previously only `demo.reset`
    // cleared this local state; `demo.replay` left it in place, so the
    // freshly re-emitted sequence was appended on top of the old one,
    // silently duplicating every timeline row from the run being
    // replayed.)
    const countRightAfterReplay = Number(screen.getByTestId("event-count").textContent);
    expect(countRightAfterReplay).toBeLessThan(countBeforeReplay);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    const countAfterReplayRuns = Number(screen.getByTestId("event-count").textContent);
    // The replayed run accumulates its own fresh history — never stacked
    // on top of the pre-replay count.
    expect(countAfterReplayRuns).toBeLessThan(countBeforeReplay * 1.5);
  });
});
