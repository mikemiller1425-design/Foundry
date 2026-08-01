import type { FoundryEvent } from "@foundry/event-types";
import { RuntimeContext } from "@/lib/mock-runtime";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventTimeline } from "./EventTimeline";

/**
 * FBL-034 — "Event feed handles 10,000 retained events via
 * virtualization/filtering" (v1-acceptance.md § Performance).
 *
 * The property under test is **boundedness**: the number of mounted DOM
 * rows must be a function of the container's height, not of how many
 * events are retained. That is the whole point of virtualization, and it
 * is what stops a long-running neighborhood from degrading into an
 * unusable feed.
 *
 * Why this lives here and not in Playwright: the canonical demo script is
 * finite and never reaches 10,000 events, and the app has no operator
 * surface for injecting synthetic ones — adding one purely to make a test
 * reachable would be inventing an operational feature, which this rung
 * prohibits. Rendering the real component against a real 10,000-event
 * array reaches the actual requirement without that.
 *
 * What this does *not* claim: jsdom performs no layout or paint, so the
 * elapsed times below are a guard against an algorithmic regression
 * (an O(n) DOM, a filter that rebuilds everything), not a statement about
 * frame rate. Real rendering cost at the three target viewports is
 * measured in `e2e-perf/frame-rate.perf.spec.ts`.
 */

const RETAINED_EVENTS = 10_000;
const ROW_HEIGHT_PX = 28;
// A realistic timeline region on the primary 1440-tall target viewport.
const CONTAINER_HEIGHT_PX = 1120;
// visibleRowCount = ceil(height / rowHeight) + 2 * overscan(6); a generous
// ceiling over that, so the assertion fails on an unbounded DOM rather
// than on an off-by-a-few windowing change.
const MAX_MOUNTED_ROWS = Math.ceil(CONTAINER_HEIGHT_PX / ROW_HEIGHT_PX) + 40;

const SEVERITIES = ["info", "notice", "warning", "error", "critical"] as const;

function syntheticFeed(count: number): FoundryEvent[] {
  const events: FoundryEvent[] = [];
  for (let i = 0; i < count; i += 1) {
    const second = i % 60;
    const minute = Math.floor(i / 60) % 60;
    events.push({
      id: `evt-scale-${i}`,
      type: "system.started",
      occurredAt: `2026-07-30T00:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}.000Z`,
      actorType: "backend",
      actorId: "backend",
      entityType: "System",
      entityId: `system-${i % 7}`,
      correlationId: "build-1",
      severity: SEVERITIES[i % SEVERITIES.length]!,
      schemaVersion: 1,
      payload: { serviceVersion: "1.0.0", neighborhoodId: "neighborhood-1" },
    } as FoundryEvent);
  }
  return events;
}

function renderFeed(events: FoundryEvent[]) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RuntimeContext.Provider
        value={{
          events,
          worldState: createInitialWorldState(),
          isRunning: false,
          isComplete: true,
          submitCommand: vi.fn(),
          resolveApproval: vi.fn(),
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          connectionStatus: "connected" as const,
          mutationsEnabled: true,
          lastRejection: null,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  return render(<EventTimeline />, { wrapper: Wrapper });
}

/**
 * jsdom reports every element as zero-height, which would make the
 * virtualization window trivially small and the test vacuous — it would
 * "pass" on a component that renders nothing. Giving the scroll container
 * a real height makes the window a real one.
 */
let clientHeightSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  clientHeightSpy = vi
    .spyOn(HTMLElement.prototype, "clientHeight", "get")
    .mockReturnValue(CONTAINER_HEIGHT_PX);
});

afterEach(() => {
  clientHeightSpy?.mockRestore();
  clientHeightSpy = null;
});

describe("EventTimeline — 10,000 retained events", () => {
  it("retains all 10,000 events while mounting only a bounded window of rows", () => {
    const events = syntheticFeed(RETAINED_EVENTS);

    const startedAt = performance.now();
    renderFeed(events);
    const mountMs = performance.now() - startedAt;

    // Every event is retained and counted...
    expect(screen.getByTestId("event-count-summary")).toHaveTextContent(
      `${RETAINED_EVENTS} / ${RETAINED_EVENTS} events`,
    );

    // ...but only a viewport-sized window is in the DOM.
    const mounted = screen.getAllByTestId("timeline-row").length;
    // Guards this test's own validity: if the container-height mock ever
    // stops taking effect, the window collapses to a handful of overscan
    // rows and every "bounded DOM" assertion below would pass vacuously.
    expect(mounted).toBeGreaterThanOrEqual(Math.floor(CONTAINER_HEIGHT_PX / ROW_HEIGHT_PX));
    expect(mounted).toBeLessThanOrEqual(MAX_MOUNTED_ROWS);
    // The decisive assertion: the DOM is bounded by the container, not by
    // the feed. Without virtualization this would be 10,000.
    expect(mounted).toBeLessThan(RETAINED_EVENTS / 10);

    expect(mountMs).toBeLessThan(5000);
  });

  it("scrolling deep into the feed keeps the mounted window bounded and shows the right slice", () => {
    const events = syntheticFeed(RETAINED_EVENTS);
    renderFeed(events);

    const container = screen.getByRole("log", { name: "Event timeline" });
    // Scroll to roughly event 9,000.
    const targetIndex = 9000;
    fireEvent.scroll(container, { target: { scrollTop: targetIndex * ROW_HEIGHT_PX } });

    const rows = screen.getAllByTestId("timeline-row");
    expect(rows.length).toBeLessThanOrEqual(MAX_MOUNTED_ROWS);

    // The window shows the slice around the scroll position, not the head
    // of the feed — proof the offset is applied rather than the list being
    // silently truncated to its first N rows.
    const minute = String(Math.floor(targetIndex / 60) % 60).padStart(2, "0");
    const second = String(targetIndex % 60).padStart(2, "0");
    expect(rows.some((row) => row.textContent?.includes(`00:${minute}:${second}`))).toBe(true);
  });

  it("filtering 10,000 events narrows the feed without mounting an unbounded DOM", () => {
    const events = syntheticFeed(RETAINED_EVENTS);
    renderFeed(events);

    const startedAt = performance.now();
    fireEvent.change(screen.getByLabelText("Filter by severity"), { target: { value: "error" } });
    const filterMs = performance.now() - startedAt;

    // One severity in five.
    expect(screen.getByTestId("event-count-summary")).toHaveTextContent(
      `${RETAINED_EVENTS / SEVERITIES.length} / ${RETAINED_EVENTS} events`,
    );
    expect(screen.getAllByTestId("timeline-row").length).toBeLessThanOrEqual(MAX_MOUNTED_ROWS);
    expect(filterMs).toBeLessThan(5000);
  });

  it("clearing the filter restores the full retained feed", () => {
    const events = syntheticFeed(RETAINED_EVENTS);
    renderFeed(events);
    const severity = screen.getByLabelText("Filter by severity");

    fireEvent.change(severity, { target: { value: "critical" } });
    expect(screen.getByTestId("event-count-summary")).toHaveTextContent(
      `${RETAINED_EVENTS / SEVERITIES.length} / ${RETAINED_EVENTS} events`,
    );

    fireEvent.change(severity, { target: { value: "__all__" } });
    expect(screen.getByTestId("event-count-summary")).toHaveTextContent(
      `${RETAINED_EVENTS} / ${RETAINED_EVENTS} events`,
    );
    expect(screen.getAllByTestId("timeline-row").length).toBeLessThanOrEqual(MAX_MOUNTED_ROWS);
  });
});
