import { describe, expect, it } from "vitest";
import {
  ALL_RESIDENCE_VISUAL_STATES,
  RESIDENCE_VISUALS,
  residenceNonColorSignature,
} from "./residenceVisuals";

describe("RESIDENCE_VISUALS — every state distinct, never color alone", () => {
  it("defines all five allowed states", () => {
    expect(ALL_RESIDENCE_VISUAL_STATES).toHaveLength(5);
    for (const state of ALL_RESIDENCE_VISUAL_STATES) {
      expect(RESIDENCE_VISUALS[state]).toBeDefined();
    }
  });

  it("no two states share an identical non-color signature (shape/window-lit)", () => {
    const signatures = ALL_RESIDENCE_VISUAL_STATES.map((state) =>
      residenceNonColorSignature(RESIDENCE_VISUALS[state]),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("no two states share an identical color either (belt and suspenders)", () => {
    const colors = ALL_RESIDENCE_VISUAL_STATES.map((state) => RESIDENCE_VISUALS[state].color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("shape alone (the reduced-motion-safe signal) still uniquely identifies every state", () => {
    const shapes = ALL_RESIDENCE_VISUAL_STATES.map((state) => RESIDENCE_VISUALS[state].shape);
    expect(new Set(shapes).size).toBe(shapes.length);
  });
});
