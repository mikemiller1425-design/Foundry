import type { CameraSphericalState, Vec3 } from "@/lib/world/cameraMath";

// Imperative handle shared between CameraRig (rendered inside <Canvas>,
// its own separate R3F render tree) and 2D controls/telemetry rendered
// outside the canvas (CameraHud, the "Reset View" control). It is a plain
// mutable ref object, not React context, so it works across both trees
// without needing any context-bridging mechanism.
export interface CameraControllerHandle {
  reset(): void;
  focus(point: Vec3, options?: { distance?: number }): void;
  orbitBy(dAzimuth: number, dPolar: number): void;
  panBy(dx: number, dy: number): void;
  zoomBy(delta: number): void;
  getState(): CameraSphericalState;
}
