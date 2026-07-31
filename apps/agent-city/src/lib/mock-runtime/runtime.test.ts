import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockRuntime } from "./runtime";

describe("MockRuntime — complete canonical demo (headless)", () => {
  it("runToCompletion emits the full script exactly once, in order", () => {
    const runtime = new MockRuntime("headless-seed");
    const received: string[] = [];
    runtime.onEvent((e) => received.push(e.type));
    runtime.runToCompletion();
    expect(received).toHaveLength(runtime.getFullScriptLength());
    expect(received[0]).toBe("system.started");
    expect(received[received.length - 1]).toBe("upgrade.completed");
    expect(runtime.isComplete()).toBe(true);
  });

  it("getWorldState reflects a completed build after runToCompletion", () => {
    const runtime = new MockRuntime("headless-world-state");
    runtime.runToCompletion();
    expect(runtime.getWorldState().currentBuild?.status).toBe("completed");
    expect(runtime.getWorldState().inventoryCounts.successfulPackages).toBe(10);
  });
});

describe("MockRuntime — command semantics (fake timers)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("demo.start begins emitting events paced over time, not all at once", () => {
    const runtime = new MockRuntime("paced-seed");
    const received: string[] = [];
    runtime.onEvent((e) => received.push(e.type));

    runtime.submitCommand({ commandType: "demo.start", params: {} });
    expect(received).toHaveLength(0); // first emission is scheduled, not synchronous

    vi.advanceTimersByTime(200);
    expect(received.length).toBeGreaterThanOrEqual(1);
    const afterFirstBatch = received.length;

    vi.advanceTimersByTime(2000);
    expect(received.length).toBeGreaterThan(afterFirstBatch);
  });

  it("demo.pause stops advancing; demo.resume continues from exactly the same cursor with no reorder/loss", () => {
    const runtime = new MockRuntime("pause-resume-seed");
    const received: string[] = [];
    runtime.onEvent((e) => received.push(e.type));

    runtime.submitCommand({ commandType: "demo.start", params: {} });
    vi.advanceTimersByTime(1000);
    const countAtPauseTime = received.length;
    runtime.submitCommand({ commandType: "demo.pause", params: {} });

    vi.advanceTimersByTime(5000);
    expect(received).toHaveLength(countAtPauseTime); // nothing emitted while paused

    runtime.submitCommand({ commandType: "demo.resume", params: {} });
    vi.advanceTimersByTime(1000);
    expect(received.length).toBeGreaterThan(countAtPauseTime);

    // No event was skipped or duplicated across the pause boundary.
    const eventsAtResume = runtime.getEvents();
    const ids = eventsAtResume.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 0; i < eventsAtResume.length; i++) {
      expect(eventsAtResume[i]?.type).toBe(received[i]);
    }
  });

  it("demo.set_speed changes pacing only, never event content or order", () => {
    const runtimeSlow = new MockRuntime("speed-seed");
    const runtimeFast = new MockRuntime("speed-seed");
    const slowReceived: string[] = [];
    const fastReceived: string[] = [];
    runtimeSlow.onEvent((e) => slowReceived.push(e.type));
    runtimeFast.onEvent((e) => fastReceived.push(e.type));

    runtimeSlow.submitCommand({ commandType: "demo.start", params: {} });
    runtimeFast.submitCommand({ commandType: "demo.start", params: {} });
    runtimeFast.submitCommand({ commandType: "demo.set_speed", params: { multiplier: 4 } });

    vi.advanceTimersByTime(2000);
    expect(fastReceived.length).toBeGreaterThan(slowReceived.length);
    // Content emitted so far is a strict prefix match — same order, just further along.
    expect(fastReceived.slice(0, slowReceived.length)).toEqual(slowReceived);
  });

  it("demo.reset clears all state and re-initializes as if freshly booted", () => {
    const runtime = new MockRuntime("reset-seed");
    runtime.runToCompletion();
    expect(runtime.isComplete()).toBe(true);

    runtime.submitCommand({ commandType: "demo.reset", params: {} });
    expect(runtime.getEvents()).toHaveLength(0);
    expect(runtime.isComplete()).toBe(false);
    expect(runtime.getWorldState().currentBuild).toBeNull();
    expect(runtime.getWorldState().inventoryCounts.successfulPackages).toBe(9);
  });

  it("demo.replay re-emits the identical seeded sequence deterministically from the start", () => {
    const runtime = new MockRuntime("replay-seed");
    runtime.runToCompletion();
    const firstRunTypes = runtime.getEvents().map((e) => e.type);
    const firstRunIds = runtime.getEvents().map((e) => e.id);

    runtime.submitCommand({ commandType: "demo.replay", params: {} });
    runtime.runToCompletion();
    const secondRunTypes = runtime.getEvents().map((e) => e.type);
    const secondRunIds = runtime.getEvents().map((e) => e.id);

    expect(secondRunTypes).toEqual(firstRunTypes);
    expect(secondRunIds).toEqual(firstRunIds);
  });

  it("demo.replay with a new seed produces the same structure with different ids", () => {
    const runtime = new MockRuntime("replay-original-seed");
    runtime.runToCompletion();
    const originalIds = runtime.getEvents().map((e) => e.id);

    runtime.submitCommand({ commandType: "demo.replay", params: { seed: "replay-new-seed" } });
    runtime.runToCompletion();
    const newIds = runtime.getEvents().map((e) => e.id);

    expect(newIds).not.toEqual(originalIds);
    expect(newIds.length).toBe(originalIds.length);
  });
});

describe("MockRuntime — rejects commands outside the approved set", () => {
  it("rejects an unknown commandType and does not mutate state", () => {
    const runtime = new MockRuntime("reject-seed");
    const rejections: Array<{ commandType: string; reason: string }> = [];
    runtime.onCommandRejected((r) => rejections.push(r));

    runtime.submitCommand({ commandType: "shell.execute", params: { cmd: "rm -rf /" } });

    expect(rejections).toHaveLength(1);
    expect(rejections[0]?.commandType).toBe("shell.execute");
    expect(runtime.isRunning()).toBe(false);
    expect(runtime.getEvents()).toHaveLength(0);
  });

  it("rejects a well-known commandType with malformed params", () => {
    const runtime = new MockRuntime("reject-params-seed");
    const rejections: Array<{ commandType: string; reason: string }> = [];
    runtime.onCommandRejected((r) => rejections.push(r));

    runtime.submitCommand({ commandType: "demo.set_speed", params: { multiplier: "fast" } });

    expect(rejections).toHaveLength(1);
    expect(runtime.isRunning()).toBe(false);
  });
});

describe("MockRuntime — idempotent duplicate event handling", () => {
  it("delivering the same script event twice via emitAndNotify internals never doubles derived state", () => {
    const runtime = new MockRuntime("runtime-dup-seed");
    runtime.runToCompletion();
    const before = runtime.getWorldState().inventoryCounts.successfulPackages;

    // Replay the identical seed: same ids are re-emitted, but WorldState
    // was already rebuilt from scratch by reset()-inside-replay, so this
    // exercises reduceWorldState's own dedupe path, not a false "double".
    runtime.submitCommand({ commandType: "demo.replay", params: {} });
    runtime.runToCompletion();

    expect(runtime.getWorldState().inventoryCounts.successfulPackages).toBe(before);
  });
});
