import { describe, expect, it } from "vitest";
import { ALL_CARGO_STATES, CARGO_VISUALS, cargoNonColorSignature } from "./cargoVisuals";

describe("CARGO_VISUALS — every allowed state distinct, never color alone", () => {
  it("defines all seven allowed states (world-model.md 'Cargo')", () => {
    expect(ALL_CARGO_STATES).toHaveLength(7);
    for (const state of ALL_CARGO_STATES) {
      expect(CARGO_VISUALS[state]).toBeDefined();
    }
  });

  it("no two states share an identical non-color signature (sealed flag + shape)", () => {
    const signatures = ALL_CARGO_STATES.map((state) =>
      cargoNonColorSignature(CARGO_VISUALS[state]),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("no two states share an identical color", () => {
    const colors = ALL_CARGO_STATES.map((state) => CARGO_VISUALS[state].color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("only sealed_ready, in_transit, and received report sealed — never the incomplete/blocked/rejected states", () => {
    expect(CARGO_VISUALS.open_incomplete.sealed).toBe(false);
    expect(CARGO_VISUALS.blocked.sealed).toBe(false);
    expect(CARGO_VISUALS.validating.sealed).toBe(false);
    expect(CARGO_VISUALS.rejected.sealed).toBe(false);
    expect(CARGO_VISUALS.sealed_ready.sealed).toBe(true);
    expect(CARGO_VISUALS.in_transit.sealed).toBe(true);
    expect(CARGO_VISUALS.received.sealed).toBe(true);
  });
});
