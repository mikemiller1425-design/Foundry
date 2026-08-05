// FBL-012 camera and navigation (docs/02-specification/world-model.md →
// "World camera"; interface-model.md → "Central 3D world"). Pure,
// framework-free math: no Three.js/R3F imports, so it is fully unit
// testable under jsdom, unlike anything that touches a real WebGL canvas
// (see WorldCanvas.test.tsx's comment on why R3F itself cannot be
// meaningfully unit tested).

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraSphericalState {
  target: Vec3;
  /** Radians, measured around the world Y axis. Unbounded (wraps). */
  azimuth: number;
  /** Radians from the world +Y axis. Clamped — this is the "controlled orbit". */
  polar: number;
  /** Distance from target to camera. Clamped — the zoom limits. */
  distance: number;
}

// Neighborhood bounds (world-model.md: "cannot become lost under terrain
// or far outside the neighborhood"). The V1 neighborhood's nine buildings
// (packages/world-model) span roughly x: -8..12, z: -10..4 — these bounds
// give generous room around that footprint without allowing indefinite
// drift.
export const CAMERA_BOUNDS = {
  target: { minX: -25, maxX: 25, minY: 0, maxY: 6, minZ: -25, maxZ: 25 },
  minDistance: 6,
  maxDistance: 40,
  // Polar measured from +Y: near 0 is overhead, near PI/2 is horizon-level.
  // Keeping both bounds strictly inside (0, PI/2) means the camera can
  // never orbit under the target and never point straight down/up.
  minPolar: 0.2,
  maxPolar: 1.45,
  // Final world-space Y floor applied to the computed camera position,
  // independent of the polar/distance/target combination that produced
  // it — the hard guarantee that the camera can never travel beneath (or
  // exactly onto) the future ground plane (FBL-013).
  minCameraHeight: 0.5,
} as const;

export const CANONICAL_CAMERA_STATE: CameraSphericalState = {
  // The built district is asymmetrical and extends further south/east.
  // Centering the presentation on its visual mass keeps the neighborhood
  // prominent while retaining room for the Lighthouse as an orientation
  // landmark. This is presentation state only, never world truth.
  target: { x: 1, y: 0.45, z: -2.5 },
  azimuth: Math.PI / 4,
  polar: 0.94,
  distance: 20,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampTarget(target: Vec3): Vec3 {
  const b = CAMERA_BOUNDS.target;
  return {
    x: clamp(target.x, b.minX, b.maxX),
    y: clamp(target.y, b.minY, b.maxY),
    z: clamp(target.z, b.minZ, b.maxZ),
  };
}

export function clampDistance(distance: number): number {
  return clamp(distance, CAMERA_BOUNDS.minDistance, CAMERA_BOUNDS.maxDistance);
}

export function clampPolar(polar: number): number {
  return clamp(polar, CAMERA_BOUNDS.minPolar, CAMERA_BOUNDS.maxPolar);
}

/** Wraps to [0, 2π) rather than clamping — azimuth (spin around the target) is unbounded. */
export function normalizeAzimuth(azimuth: number): number {
  const twoPi = Math.PI * 2;
  return ((azimuth % twoPi) + twoPi) % twoPi;
}

export function clampCameraState(state: CameraSphericalState): CameraSphericalState {
  return {
    target: clampTarget(state.target),
    azimuth: normalizeAzimuth(state.azimuth),
    polar: clampPolar(state.polar),
    distance: clampDistance(state.distance),
  };
}

/**
 * Spherical (target, azimuth, polar, distance) → Cartesian world position.
 * Always clamps the result to `minCameraHeight` as a last step, so no
 * combination of (already-clamped) inputs can produce a position beneath
 * the ground plane.
 */
export function sphericalToPosition(state: CameraSphericalState): Vec3 {
  const { target, azimuth, polar, distance } = state;
  const sinPolar = Math.sin(polar);
  const x = target.x + distance * sinPolar * Math.sin(azimuth);
  const y = target.y + distance * Math.cos(polar);
  const z = target.z + distance * sinPolar * Math.cos(azimuth);
  return { x, y: Math.max(y, CAMERA_BOUNDS.minCameraHeight), z };
}

/**
 * Moves `target` along the current view's camera-relative right/forward
 * axes (projected onto the ground plane), then clamps to bounds. Panning
 * is relative to azimuth so "right" always means right-on-screen.
 */
export function panTarget(state: CameraSphericalState, dx: number, dy: number): Vec3 {
  const right = { x: Math.cos(state.azimuth), z: -Math.sin(state.azimuth) };
  const forward = { x: Math.sin(state.azimuth), z: Math.cos(state.azimuth) };
  return clampTarget({
    x: state.target.x + right.x * dx + forward.x * dy,
    y: state.target.y,
    z: state.target.z + right.z * dx + forward.z * dy,
  });
}

export function orbitState(
  state: CameraSphericalState,
  dAzimuth: number,
  dPolar: number,
): CameraSphericalState {
  return clampCameraState({
    ...state,
    azimuth: state.azimuth + dAzimuth,
    polar: state.polar + dPolar,
  });
}

export function zoomState(state: CameraSphericalState, delta: number): CameraSphericalState {
  return { ...state, distance: clampDistance(state.distance + delta) };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Eases from one camera state toward another. `t` of 1 (or reduced
 * motion — callers pass `t = 1` directly for that case) snaps exactly to
 * `to`, satisfying "reduced-motion-aware focus transitions" without a
 * separate code path.
 */
export function easeCameraState(
  from: CameraSphericalState,
  to: CameraSphericalState,
  t: number,
): CameraSphericalState {
  const clampedT = clamp(t, 0, 1);
  if (clampedT >= 1) return to;
  return {
    target: {
      x: lerp(from.target.x, to.target.x, clampedT),
      y: lerp(from.target.y, to.target.y, clampedT),
      z: lerp(from.target.z, to.target.z, clampedT),
    },
    azimuth: lerp(from.azimuth, to.azimuth, clampedT),
    polar: lerp(from.polar, to.polar, clampedT),
    distance: lerp(from.distance, to.distance, clampedT),
  };
}

/** True once `state` is close enough to `target` that an in-progress focus ease should stop. */
export function isCloseTo(
  state: CameraSphericalState,
  target: CameraSphericalState,
  epsilon = 0.01,
): boolean {
  return (
    Math.abs(state.target.x - target.target.x) < epsilon &&
    Math.abs(state.target.y - target.target.y) < epsilon &&
    Math.abs(state.target.z - target.target.z) < epsilon &&
    Math.abs(state.distance - target.distance) < epsilon
  );
}
