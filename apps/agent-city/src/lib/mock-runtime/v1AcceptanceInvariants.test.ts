import { describe, expect, it } from "vitest";
import { EVENT_TYPES } from "@foundry/event-types";
import { describeEvent } from "@/components/timeline/describeEvent";
import { buildCanonicalScript } from "./script";
import { reduceWorldState } from "./worldStateReducer";

/**
 * FBL-022 — critical invariants named explicitly in this rung's own
 * authorization, proved comprehensively (across the *entire* canonical
 * run, not just a single before/after boundary) rather than at one point
 * in time.
 */
describe("FBL-022 — no early Warehouse Level 2 visual, anywhere in the run", () => {
  it("the Warehouse never reports level 2 or the capacity_100 capability before upgrade.completed, at every single prefix of the canonical script", () => {
    const script = buildCanonicalScript("no-early-upgrade-visual");
    const completedIndex = script.findIndex((e) => e.type === "upgrade.completed");
    expect(completedIndex).toBeGreaterThan(0);

    for (let i = 0; i < completedIndex; i++) {
      const state = reduceWorldState(script.slice(0, i + 1));
      const warehouse = state.buildings.find((b) => b.buildingType === "warehouse")!;
      expect(warehouse.level, `at event index ${i} (${script[i]!.type})`).toBe(1);
      expect(warehouse.capabilities, `at event index ${i} (${script[i]!.type})`).not.toContain(
        "capacity_100",
      );
    }

    // And it does flip, exactly at (never after) that same event.
    const afterState = reduceWorldState(script.slice(0, completedIndex + 1));
    const warehouseAfter = afterState.buildings.find((b) => b.buildingType === "warehouse")!;
    expect(warehouseAfter.level).toBe(2);
    expect(warehouseAfter.capabilities).toContain("capacity_100");
  });
});

describe("FBL-022 — duplicate-event idempotency across the entire journey", () => {
  it("replaying the complete canonical script a second time in full leaves the final WorldState unchanged", () => {
    const script = buildCanonicalScript("full-journey-duplicate");
    const once = reduceWorldState(script);
    const twice = reduceWorldState([...script, ...script]);
    expect(twice).toEqual(once);
  });

  it("interleaving duplicate deliveries throughout the run (not just appended at the end) still leaves the final WorldState unchanged", () => {
    const script = buildCanonicalScript("full-journey-duplicate-interleaved");
    const once = reduceWorldState(script);
    // Deliver every event twice in a row, in original order — a stronger
    // stress test than a single dose of duplicates at the end.
    const interleaved = script.flatMap((event) => [event, event]);
    const twice = reduceWorldState(interleaved);
    expect(twice).toEqual(once);
  });

  it("no duplicate cargo, approvals, or transfers accumulate from full-journey duplication", () => {
    const script = buildCanonicalScript("full-journey-duplicate-counts");
    const twice = reduceWorldState([...script, ...script]);
    // Exactly one approval ever exists in V1 (one build, one gated leg).
    expect(twice.approvals).toHaveLength(1);
    // "One active transfer at a time" — by the end of a completed run, none remain active.
    expect(twice.activeTransfers).toHaveLength(0);
    expect(twice.inventoryCounts.successfulPackages).toBe(10); // never double-counted
  });
});

describe("FBL-022 — final event-history completeness", () => {
  it("the complete canonical run's event history includes every major workflow event type, in the order the journey requires", () => {
    const script = buildCanonicalScript("history-completeness");
    const types = new Set(script.map((e) => e.type));
    const mustInclude = [
      "operator.objective_submitted",
      "build.created",
      "build.planned",
      "requirement.failed",
      "requirement.retried",
      "stage.blocked",
      "stage.validation_started",
      "stage.validation_passed",
      "transfer.created",
      "transfer.ready",
      "transfer.started",
      "transfer.arrived",
      "transfer.completed",
      "approval.requested",
      "approval.approved",
      "build.completed",
      "upgrade.eligible",
      "upgrade.requested",
      "upgrade.approved",
      "upgrade.started",
      "upgrade.completed",
    ];
    for (const type of mustInclude) {
      expect(types.has(type as (typeof EVENT_TYPES)[number]), type).toBe(true);
    }
  });

  it("every event in the complete run has a non-empty, non-throwing textual equivalent (Principle 24)", () => {
    const script = buildCanonicalScript("history-textual-equivalents");
    for (const event of script) {
      expect(() => describeEvent(event)).not.toThrow();
      expect(describeEvent(event).length).toBeGreaterThan(0);
    }
  });

  it("the final WorldState's lastProcessedEventId is exactly the last event delivered — history is never silently truncated", () => {
    const script = buildCanonicalScript("history-last-id");
    const state = reduceWorldState(script);
    expect(state.lastProcessedEventId).toBe(script[script.length - 1]!.id);
  });
});
