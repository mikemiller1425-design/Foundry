import type { FoundryEvent } from "@foundry/event-types";
import { describe, expect, it } from "vitest";
import { mergeEvents, resumeCursor } from "./reconcile";

function evt(id: string): FoundryEvent {
  return {
    id,
    type: "system.started",
    occurredAt: "2026-07-30T00:00:00.000Z",
    actorType: "backend",
    actorId: "backend",
    entityType: "System",
    entityId: "neighborhood-1",
    correlationId: "corr-1",
    severity: "info",
    schemaVersion: 1,
    payload: { serviceVersion: "1.0.0", neighborhoodId: "neighborhood-1" },
  } as FoundryEvent;
}

describe("mergeEvents — duplicate delivery safety (F-09)", () => {
  it("drops an event id already held rather than duplicating it", () => {
    const existing = [evt("a"), evt("b")];
    const merged = mergeEvents(existing, [evt("b"), evt("c")]);
    expect(merged.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("is stable when the entire backlog is redelivered after a reconnect", () => {
    const existing = [evt("a"), evt("b"), evt("c")];
    const merged = mergeEvents(existing, existing);
    expect(merged.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });
});

describe("mergeEvents — ordering", () => {
  it("places events by the authoritative order, not arrival order", () => {
    const existing = [evt("c")];
    const merged = mergeEvents(existing, [evt("a"), evt("b")], ["a", "b", "c"]);
    expect(merged.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps live events that postdate the snapshot after every known event", () => {
    const merged = mergeEvents([evt("live-1")], [evt("a"), evt("b")], ["a", "b"]);
    expect(merged.map((e) => e.id)).toEqual(["a", "b", "live-1"]);
  });

  it("preserves incoming order when no authoritative order is supplied (live stream)", () => {
    const merged = mergeEvents([], [evt("x"), evt("y"), evt("z")]);
    expect(merged.map((e) => e.id)).toEqual(["x", "y", "z"]);
  });
});

describe("resumeCursor", () => {
  it("returns the last held event id, or null for a full resync", () => {
    expect(resumeCursor([])).toBeNull();
    expect(resumeCursor([evt("a"), evt("b")])).toBe("b");
  });
});
