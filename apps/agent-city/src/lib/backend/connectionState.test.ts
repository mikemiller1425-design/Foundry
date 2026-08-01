import type { WorldState } from "@foundry/contracts";
import { describe, expect, it } from "vitest";
import {
  applyConnectionStatus,
  areMutationsAllowed,
  INITIAL_BACKOFF_MS,
  MAX_BACKOFF_MS,
  nextBackoffMs,
} from "./connectionState";

const baseWorldState: WorldState = {
  buildings: [],
  agents: [],
  currentBuild: null,
  activeTransfers: [],
  approvals: [],
  inventoryCounts: { successfulPackages: 9 },
  health: { status: "healthy", reasons: ["nominal"] },
  lastProcessedEventId: "evt-1",
};

describe("nextBackoffMs — bounded exponential backoff", () => {
  it("starts at the initial delay and grows exponentially", () => {
    expect(nextBackoffMs(0)).toBe(INITIAL_BACKOFF_MS);
    expect(nextBackoffMs(1)).toBe(INITIAL_BACKOFF_MS * 2);
    expect(nextBackoffMs(2)).toBe(INITIAL_BACKOFF_MS * 4);
  });

  it("never exceeds the maximum, however many attempts have failed", () => {
    for (const attempt of [10, 50, 1000]) {
      expect(nextBackoffMs(attempt)).toBe(MAX_BACKOFF_MS);
      expect(nextBackoffMs(attempt)).toBeLessThanOrEqual(MAX_BACKOFF_MS);
    }
  });
});

describe("applyConnectionStatus — stale labeling (F-10)", () => {
  it("marks health disconnected while disconnected, so the Lighthouse shows disconnected", () => {
    const result = applyConnectionStatus(baseWorldState, "disconnected");
    expect(result.connectionStatus).toBe("disconnected");
    expect(result.health.status).toBe("disconnected");
    expect(result.health.reasons).toContain("connection_lost");
  });

  it("retains the last-known projection rather than clearing or advancing it", () => {
    const withData: WorldState = {
      ...baseWorldState,
      inventoryCounts: { successfulPackages: 10 },
      lastProcessedEventId: "evt-42",
    };
    const result = applyConnectionStatus(withData, "disconnected");
    expect(result.inventoryCounts).toEqual({ successfulPackages: 10 });
    expect(result.lastProcessedEventId).toBe("evt-42");
  });

  it("restores a normal projection when connected", () => {
    const result = applyConnectionStatus(baseWorldState, "connected");
    expect(result.connectionStatus).toBe("connected");
    expect(result.health.status).toBe("healthy");
  });
});

describe("areMutationsAllowed — F-10 mutation controls", () => {
  it("permits mutations only while connected", () => {
    expect(areMutationsAllowed("connected")).toBe(true);
    expect(areMutationsAllowed("stale")).toBe(false);
    expect(areMutationsAllowed("disconnected")).toBe(false);
  });
});
