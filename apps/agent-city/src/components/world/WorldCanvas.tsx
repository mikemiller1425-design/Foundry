"use client";

import { Canvas } from "@react-three/fiber";
import type { RefObject } from "react";
import { CameraRig } from "./CameraRig";
import type { CameraControllerHandle } from "./cameraController";

// FBL-011 bootstrapped an empty R3F canvas in the shell's world region
// (ADR-004); FBL-012 adds the camera rig (still no scene content — no
// geometry, lights, or world objects, which begin at FBL-013/FBL-014).
// Canvas fills and tracks its positioned parent's size automatically
// (R3F's built-in ResizeObserver).
export function WorldCanvas({
  controllerRef,
}: {
  controllerRef: RefObject<CameraControllerHandle | null>;
}) {
  return (
    <Canvas className="absolute inset-0" style={{ position: "absolute", inset: 0 }}>
      <CameraRig controllerRef={controllerRef} />
    </Canvas>
  );
}
