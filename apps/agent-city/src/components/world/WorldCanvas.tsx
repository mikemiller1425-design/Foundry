"use client";

import { Canvas } from "@react-three/fiber";
import type { RefObject } from "react";
import { CameraRig } from "./CameraRig";
import type { CameraControllerHandle } from "./cameraController";
import { Environment } from "./Environment";

// FBL-011 bootstrapped an empty R3F canvas in the shell's world region
// (ADR-004); FBL-012 added the camera rig; FBL-013 adds the minimal
// environment (ground, lighting, fog). Still no world objects — those
// begin at FBL-014 (Lighthouse). Canvas fills and tracks its positioned
// parent's size automatically (R3F's built-in ResizeObserver).
// `preserveDrawingBuffer` lets Playwright read back real rendered pixels
// (via `canvas.toDataURL()`) to verify the environment actually renders,
// not just that the canvas element exists.
export function WorldCanvas({
  controllerRef,
}: {
  controllerRef: RefObject<CameraControllerHandle | null>;
}) {
  return (
    <Canvas
      className="absolute inset-0"
      style={{ position: "absolute", inset: 0 }}
      gl={{ preserveDrawingBuffer: true }}
    >
      <CameraRig controllerRef={controllerRef} />
      <Environment />
    </Canvas>
  );
}
