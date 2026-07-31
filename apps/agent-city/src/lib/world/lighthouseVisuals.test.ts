import { describe, expect, it } from "vitest";
import {
  ALL_LIGHTHOUSE_STATES,
  LIGHTHOUSE_VISUALS,
  nonColorSignature,
  reducedMotionSignature,
} from "./lighthouseVisuals";

describe("LIGHTHOUSE_VISUALS — all six allowed states exist", () => {
  it("defines exactly the six allowed states, no more, no fewer", () => {
    expect(Object.keys(LIGHTHOUSE_VISUALS).sort()).toEqual([...ALL_LIGHTHOUSE_STATES].sort());
    expect(ALL_LIGHTHOUSE_STATES).toHaveLength(6);
  });

  it("every state's own `state` field matches its key", () => {
    for (const state of ALL_LIGHTHOUSE_STATES) {
      expect(LIGHTHOUSE_VISUALS[state].state).toBe(state);
    }
  });
});

describe("every state has a distinct combined signal — no state differs by color alone", () => {
  it("no two states share the same non-color signature (beam visibility/motion/speed/shape)", () => {
    const signatures = ALL_LIGHTHOUSE_STATES.map((s) => nonColorSignature(LIGHTHOUSE_VISUALS[s]));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("no two states share the same color either (color is a real signal too, just never the only one)", () => {
    const colors = ALL_LIGHTHOUSE_STATES.map((s) => LIGHTHOUSE_VISUALS[s].color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("for every pair of states, at least one non-color field differs", () => {
    for (const a of ALL_LIGHTHOUSE_STATES) {
      for (const b of ALL_LIGHTHOUSE_STATES) {
        if (a === b) continue;
        const specA = LIGHTHOUSE_VISUALS[a];
        const specB = LIGHTHOUSE_VISUALS[b];
        const onlyColorDiffers =
          specA.beamVisible === specB.beamVisible &&
          specA.beamMotion === specB.beamMotion &&
          specA.rotationSpeed === specB.rotationSpeed &&
          specA.pulseSpeed === specB.pulseSpeed &&
          specA.shape === specB.shape;
        expect(onlyColorDiffers, `${a} vs ${b} must not differ by color alone`).toBe(false);
      }
    }
  });
});

describe("disconnected has no illuminated beam", () => {
  it("beamVisible is false and beamMotion is none for disconnected", () => {
    expect(LIGHTHOUSE_VISUALS.disconnected.beamVisible).toBe(false);
    expect(LIGHTHOUSE_VISUALS.disconnected.beamMotion).toBe("none");
  });

  it("every other state has a visible beam", () => {
    for (const state of ALL_LIGHTHOUSE_STATES) {
      if (state === "disconnected") continue;
      expect(LIGHTHOUSE_VISUALS[state].beamVisible, state).toBe(true);
    }
  });
});

describe("healthy is steady", () => {
  it("beamMotion is steady with no rotation or pulse speed", () => {
    expect(LIGHTHOUSE_VISUALS.healthy.beamMotion).toBe("steady");
    expect(LIGHTHOUSE_VISUALS.healthy.rotationSpeed).toBe(0);
    expect(LIGHTHOUSE_VISUALS.healthy.pulseSpeed).toBe(0);
  });
});

describe("active and critical use distinct rotating behavior", () => {
  it("both rotate, but at different speeds and with different beacon shapes", () => {
    expect(LIGHTHOUSE_VISUALS.active.beamMotion).toBe("rotating");
    expect(LIGHTHOUSE_VISUALS.critical.beamMotion).toBe("rotating");
    expect(LIGHTHOUSE_VISUALS.active.rotationSpeed).not.toBe(
      LIGHTHOUSE_VISUALS.critical.rotationSpeed,
    );
    expect(LIGHTHOUSE_VISUALS.active.shape).not.toBe(LIGHTHOUSE_VISUALS.critical.shape);
  });
});

describe("attention_required and degraded use distinguishable signals", () => {
  it("both pulse, but at different speeds and with different beacon shapes", () => {
    expect(LIGHTHOUSE_VISUALS.attention_required.beamMotion).toBe("pulsing");
    expect(LIGHTHOUSE_VISUALS.degraded.beamMotion).toBe("pulsing");
    expect(LIGHTHOUSE_VISUALS.attention_required.pulseSpeed).not.toBe(
      LIGHTHOUSE_VISUALS.degraded.pulseSpeed,
    );
    expect(LIGHTHOUSE_VISUALS.attention_required.shape).not.toBe(LIGHTHOUSE_VISUALS.degraded.shape);
  });
});

describe("reduced-motion mode preserves a static, non-color distinction", () => {
  it("shape + beam-visibility alone (motion neutralized) still uniquely identify every state", () => {
    const signatures = ALL_LIGHTHOUSE_STATES.map((s) =>
      reducedMotionSignature(LIGHTHOUSE_VISUALS[s]),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("every state has its own distinct beacon shape", () => {
    const shapes = ALL_LIGHTHOUSE_STATES.map((s) => LIGHTHOUSE_VISUALS[s].shape);
    expect(new Set(shapes).size).toBe(shapes.length);
  });
});
