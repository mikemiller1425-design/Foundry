import { EVENT_TYPES } from "@foundry/event-types";
import { describe, expect, it } from "vitest";
import { EVENT_PROJECTION_MAP } from "./eventProjectionMap";

// FBL-021 — event-model.md "Traceability requirement": every V1 event must
// have a reducer/projection handler, a readable event-feed template, a
// visual mapping or explicit "no visual change", at least one automated
// test, and idempotent duplicate handling. `EVENT_PROJECTION_MAP` is typed
// as `Record<FoundryEvent["type"], ...>`, so TypeScript itself already
// rejects a missing entry at compile time — this test is the runtime
// belt-and-suspenders check (and the "at least one automated test" this
// rung's own required-behavior 15 calls for), guarding against the map and
// the authoritative `EVENT_TYPES` list ever silently drifting apart.
describe("EVENT_PROJECTION_MAP — complete traceability coverage", () => {
  it("has exactly one entry per authoritative V1 event type, no more, no fewer", () => {
    const mapKeys = Object.keys(EVENT_PROJECTION_MAP).sort();
    const authoritative = [...EVENT_TYPES].sort();
    expect(mapKeys).toEqual(authoritative);
  });

  it("every entry has a non-empty producer, reducerEffect, representation2D, representation3D, textualEquivalent, and idempotency", () => {
    for (const [type, entry] of Object.entries(EVENT_PROJECTION_MAP)) {
      expect(entry.producer, `${type}.producer`).toBeTruthy();
      expect(entry.reducerEffect, `${type}.reducerEffect`).toBeTruthy();
      expect(entry.representation2D, `${type}.representation2D`).toBeTruthy();
      expect(entry.representation3D, `${type}.representation3D`).toBeTruthy();
      expect(entry.textualEquivalent, `${type}.textualEquivalent`).toBeTruthy();
      expect(entry.idempotency, `${type}.idempotency`).toBeTruthy();
    }
  });

  it("every 'no visual change' 3D entry states an explicit reason, never a bare 'no visual change'", () => {
    for (const [type, entry] of Object.entries(EVENT_PROJECTION_MAP)) {
      if (entry.representation3D.toLowerCase().includes("no visual change")) {
        expect(
          entry.representation3D.length,
          `${type} must give a reason alongside "no visual change"`,
        ).toBeGreaterThan("No visual change:".length);
      }
    }
  });
});
