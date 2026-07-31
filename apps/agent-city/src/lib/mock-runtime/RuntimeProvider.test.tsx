import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntime, RuntimeProvider } from "./RuntimeProvider";
import { loadRuntimeCursor } from "./sessionPersistence";

function Probe() {
  const { events, isRunning, isComplete } = useRuntime();
  return (
    <div>
      <span data-testid="event-count">{events.length}</span>
      <span data-testid="is-running">{String(isRunning)}</span>
      <span data-testid="is-complete">{String(isComplete)}</span>
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
