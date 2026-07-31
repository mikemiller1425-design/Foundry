import { describe, expect, it } from "vitest";
import {
  CAMERA_BOUNDS,
  CANONICAL_CAMERA_STATE,
  clampCameraState,
  clampDistance,
  clampPolar,
  clampTarget,
  easeCameraState,
  isCloseTo,
  normalizeAzimuth,
  orbitState,
  panTarget,
  sphericalToPosition,
  zoomState,
} from "./cameraMath";

describe("clampTarget — neighborhood bounds", () => {
  it("passes through a target already inside bounds", () => {
    expect(clampTarget({ x: 1, y: 0, z: -2 })).toEqual({ x: 1, y: 0, z: -2 });
  });

  it("clamps a target far outside bounds on every axis", () => {
    const result = clampTarget({ x: 999, y: 999, z: -999 });
    expect(result.x).toBe(CAMERA_BOUNDS.target.maxX);
    expect(result.y).toBe(CAMERA_BOUNDS.target.maxY);
    expect(result.z).toBe(CAMERA_BOUNDS.target.minZ);
  });
});

describe("clampDistance / clampPolar — zoom limits and controlled orbit", () => {
  it("clamps distance below the minimum and above the maximum", () => {
    expect(clampDistance(0)).toBe(CAMERA_BOUNDS.minDistance);
    expect(clampDistance(1000)).toBe(CAMERA_BOUNDS.maxDistance);
    expect(clampDistance(20)).toBe(20);
  });

  it("clamps polar angle so the camera cannot flip overhead or under the horizon", () => {
    expect(clampPolar(-5)).toBe(CAMERA_BOUNDS.minPolar);
    expect(clampPolar(5)).toBe(CAMERA_BOUNDS.maxPolar);
  });
});

describe("normalizeAzimuth", () => {
  it("wraps values outside [0, 2π) without clamping (azimuth is unbounded)", () => {
    expect(normalizeAzimuth(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 5);
    expect(normalizeAzimuth(3 * Math.PI)).toBeCloseTo(Math.PI, 5);
    expect(normalizeAzimuth(0)).toBe(0);
  });
});

describe("sphericalToPosition — ground-plane guarantee", () => {
  it("never returns a y below minCameraHeight even at extreme polar/target combinations", () => {
    const extremeStates = [
      {
        target: { x: 0, y: 0, z: 0 },
        azimuth: 0,
        polar: CAMERA_BOUNDS.maxPolar,
        distance: CAMERA_BOUNDS.minDistance,
      },
      {
        target: { x: 0, y: CAMERA_BOUNDS.target.maxY, z: 0 },
        azimuth: 1,
        polar: CAMERA_BOUNDS.maxPolar,
        distance: CAMERA_BOUNDS.maxDistance,
      },
      {
        target: { x: 5, y: 0, z: -5 },
        azimuth: 2.5,
        polar: CAMERA_BOUNDS.maxPolar,
        distance: CAMERA_BOUNDS.minDistance,
      },
    ];
    for (const state of extremeStates) {
      const position = sphericalToPosition(state);
      expect(position.y).toBeGreaterThanOrEqual(CAMERA_BOUNDS.minCameraHeight);
    }
  });

  it("places the camera above the target when polar is small (near-overhead)", () => {
    const position = sphericalToPosition({
      target: { x: 0, y: 0, z: 0 },
      azimuth: 0,
      polar: CAMERA_BOUNDS.minPolar,
      distance: 20,
    });
    expect(position.y).toBeGreaterThan(15);
  });
});

describe("panTarget", () => {
  it("moves the target and stays within bounds", () => {
    const state = { ...CANONICAL_CAMERA_STATE, azimuth: 0 };
    const moved = panTarget(state, 2, 0);
    expect(moved.x).not.toBe(state.target.x);
  });

  it("clamps panning that would exceed the neighborhood bounds", () => {
    const state = { ...CANONICAL_CAMERA_STATE, azimuth: 0, target: { x: 0, y: 0, z: 0 } };
    const moved = panTarget(state, 999, 0);
    expect(moved.x).toBeLessThanOrEqual(CAMERA_BOUNDS.target.maxX);
  });
});

describe("orbitState / zoomState", () => {
  it("orbitState clamps polar and normalizes azimuth", () => {
    const result = orbitState(CANONICAL_CAMERA_STATE, 10, 10);
    expect(result.polar).toBe(CAMERA_BOUNDS.maxPolar);
    expect(result.azimuth).toBeGreaterThanOrEqual(0);
    expect(result.azimuth).toBeLessThan(Math.PI * 2);
  });

  it("zoomState clamps distance to the configured limits", () => {
    expect(zoomState(CANONICAL_CAMERA_STATE, -1000).distance).toBe(CAMERA_BOUNDS.minDistance);
    expect(zoomState(CANONICAL_CAMERA_STATE, 1000).distance).toBe(CAMERA_BOUNDS.maxDistance);
  });
});

describe("reset returns the canonical camera position", () => {
  it("CANONICAL_CAMERA_STATE is itself already within all bounds", () => {
    expect(clampCameraState(CANONICAL_CAMERA_STATE)).toEqual(CANONICAL_CAMERA_STATE);
  });
});

describe("easeCameraState — reduced-motion-aware focus transitions", () => {
  const from = CANONICAL_CAMERA_STATE;
  const to = { target: { x: 10, y: 1, z: -10 }, azimuth: 2, polar: 1.2, distance: 10 };

  it("t = 1 (reduced motion's single-step case) snaps exactly to the destination", () => {
    expect(easeCameraState(from, to, 1)).toEqual(to);
  });

  it("t = 0 stays exactly at the origin state", () => {
    expect(easeCameraState(from, to, 0)).toEqual(from);
  });

  it("an intermediate t produces a state strictly between from and to", () => {
    const mid = easeCameraState(from, to, 0.5);
    expect(mid.target.x).toBeGreaterThan(from.target.x);
    expect(mid.target.x).toBeLessThan(to.target.x);
    expect(mid.distance).toBeGreaterThan(to.distance);
    expect(mid.distance).toBeLessThan(from.distance);
  });

  it("isCloseTo recognizes when an eased state has effectively arrived", () => {
    expect(isCloseTo(to, to)).toBe(true);
    expect(isCloseTo(from, to)).toBe(false);
  });
});
