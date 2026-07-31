import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockRuntime } from "./runtime";

/**
 * Runs a headless demo to true completion, including approving the one
 * pending approval the canonical script always produces (F-06: the engine
 * itself pauses there — see the "approval gating" describe block below —
 * so a real decision is required to proceed past it, exactly as it would
 * be for a live operator).
 */
function runFullDemo(runtime: MockRuntime): void {
  runtime.runToCompletion();
  if (runtime.hasPendingApproval()) {
    runtime.resolveApproval("approved", "operator-1");
    runtime.runToCompletion();
  }
}

describe("MockRuntime — complete canonical demo (headless)", () => {
  it("runToCompletion (plus approving the one gated approval) emits the full script exactly once, in order", () => {
    const runtime = new MockRuntime("headless-seed");
    const received: string[] = [];
    runtime.onEvent((e) => received.push(e.type));
    runFullDemo(runtime);
    expect(received).toHaveLength(runtime.getFullScriptLength());
    expect(received[0]).toBe("system.started");
    expect(received[received.length - 1]).toBe("upgrade.completed");
    expect(runtime.isComplete()).toBe(true);
  });

  it("runToCompletion alone halts exactly at the pending approval, short of the full script", () => {
    const runtime = new MockRuntime("headless-halt-seed");
    runtime.runToCompletion();
    expect(runtime.isComplete()).toBe(false);
    expect(runtime.hasPendingApproval()).toBe(true);
    expect(runtime.getEvents().length).toBeLessThan(runtime.getFullScriptLength());
  });

  it("getWorldState reflects a completed build after the full demo (approval included)", () => {
    const runtime = new MockRuntime("headless-world-state");
    runFullDemo(runtime);
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
    // The command's own feedback events (submitted/accepted) are synchronous;
    // *script* playback is what's paced.
    expect(received).toEqual(["operator.command_submitted", "operator.command_accepted"]);

    vi.advanceTimersByTime(200);
    expect(received.length).toBeGreaterThan(2);
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
    runtime.submitCommand({ commandType: "demo.pause", params: {} });
    const countAtPauseTime = received.length;

    vi.advanceTimersByTime(5000);
    expect(received).toHaveLength(countAtPauseTime); // nothing further emitted while paused

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
    // Exclude each runtime's own command-feedback events (their counts
    // differ by design — the fast one issued one extra command) and compare
    // only *script* event order, which must remain an identical prefix.
    const isCommandFeedback = (t: string) => t.startsWith("operator.command_");
    const slowScriptEvents = slowReceived.filter((t) => !isCommandFeedback(t));
    const fastScriptEvents = fastReceived.filter((t) => !isCommandFeedback(t));
    expect(fastScriptEvents.length).toBeGreaterThan(slowScriptEvents.length);
    expect(fastScriptEvents.slice(0, slowScriptEvents.length)).toEqual(slowScriptEvents);
  });

  it("demo.reset clears all state and re-initializes as if freshly booted", () => {
    const runtime = new MockRuntime("reset-seed");
    runFullDemo(runtime);
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
    // The rejection itself is the only (real, auditable) event — no script
    // playback and no domain-state mutation resulted from it.
    const events = runtime.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("operator.command_rejected");
    expect(runtime.getWorldState().currentBuild).toBeNull();
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

describe("MockRuntime — approval gating (F-06: pending approval pauses protected progression)", () => {
  it("auto-pauses the instant approval.requested fires, before the scripted approval.approved", () => {
    const runtime = new MockRuntime("approval-pause-seed");
    runtime.start();
    // fastForwardTo (which runToCompletion uses) itself respects the
    // approval gate, so this halts exactly at the pause point rather than
    // running to the literal end of the script.
    runtime.runToCompletion();

    expect(runtime.hasPendingApproval()).toBe(true);
    expect(runtime.isRunning()).toBe(false);
    expect(runtime.isComplete()).toBe(false);
    const types = runtime.getEvents().map((e) => e.type);
    expect(types[types.length - 1]).toBe("approval.requested");
    expect(types).not.toContain("approval.approved");
  });

  it('resolveApproval("approved") resumes playback and the scripted approval.approved follows', () => {
    const runtime = new MockRuntime("approval-approve-seed");
    runtime.start();
    runtime.runToCompletion(); // runs until the auto-pause at approval.requested, since isComplete() is false
    // runToCompletion cannot pass the auto-pause (it's not "complete" yet);
    // confirm we're gated, then approve and finish.
    expect(runtime.hasPendingApproval()).toBe(true);
    expect(runtime.isComplete()).toBe(false);

    runtime.resolveApproval("approved", "operator-1");
    runtime.runToCompletion();

    expect(runtime.isComplete()).toBe(true);
    expect(runtime.getEvents().map((e) => e.type)).toContain("approval.approved");
    expect(runtime.getWorldState().currentBuild?.status).toBe("completed");
  });

  it('resolveApproval("rejected") injects a real approval.rejected event and does not fabricate further progress', () => {
    const runtime = new MockRuntime("approval-reject-seed");
    runtime.start();
    runtime.runToCompletion();
    expect(runtime.hasPendingApproval()).toBe(true);

    runtime.resolveApproval("rejected", "operator-1", "Evidence insufficient");

    const types = runtime.getEvents().map((e) => e.type);
    expect(types).toContain("approval.rejected");
    expect(types).not.toContain("approval.approved");
    expect(runtime.getWorldState().approvals[0]?.status).toBe("rejected");
    expect(runtime.getWorldState().currentBuild?.status).not.toBe("completed");
  });

  it('resolveApproval("revision_requested") injects the full revision chain', () => {
    const runtime = new MockRuntime("approval-revision-seed");
    runtime.start();
    runtime.runToCompletion();
    expect(runtime.hasPendingApproval()).toBe(true);

    runtime.resolveApproval("revision_requested", "operator-1", "Please re-check evidence");

    const types = runtime.getEvents().map((e) => e.type);
    expect(types).toContain("approval.revision_requested");
    expect(types).toContain("revision.requested");
    expect(types).toContain("revision.started");
    expect(types).toContain("revision.completed");
    expect(runtime.getWorldState().approvals[0]?.status).toBe("revision_requested");
  });

  it("resolveApproval is a no-op when there is no pending approval", () => {
    const runtime = new MockRuntime("approval-noop-seed");
    const before = runtime.getEvents().length;
    runtime.resolveApproval("approved", "operator-1");
    expect(runtime.getEvents()).toHaveLength(before);
  });
});
