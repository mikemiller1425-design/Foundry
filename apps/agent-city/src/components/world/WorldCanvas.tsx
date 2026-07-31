"use client";

import { Canvas } from "@react-three/fiber";
import type { RefObject } from "react";
import { CameraRig } from "./CameraRig";
import type { CameraControllerHandle } from "./cameraController";
import { Environment } from "./Environment";
import type { LighthouseMarkerState } from "./lighthouseMarkerState";
import { LighthouseSceneObject } from "./LighthouseSceneObject";

// FBL-011 bootstrapped an empty R3F canvas in the shell's world region
// (ADR-004); FBL-012 added the camera rig; FBL-013 added the minimal
// environment (ground, lighting, fog); FBL-014 adds the Lighthouse — the
// first persistent world object. Selection (FBL-015) and every other
// world object (residences/buildings/roads/agents/vehicle, FBL-016+) are
// still not present. Canvas fills and tracks its positioned parent's size
// automatically (R3F's built-in ResizeObserver).
//
// `preserveDrawingBuffer` disables a GPU optimization and has no benefit
// in production — it exists only so Playwright can read back real
// rendered pixels (`canvas.toDataURL()`/`drawImage`) to verify the scene
// actually renders. It is gated behind NEXT_PUBLIC_E2E, set only by
// playwright.config.ts's dev-server command, so ordinary `next dev`/
// `next build` runs never pay that cost.
const isE2E = process.env.NEXT_PUBLIC_E2E === "1";

export function WorldCanvas({
  controllerRef,
  lighthouseMarkerRef,
}: {
  controllerRef: RefObject<CameraControllerHandle | null>;
  lighthouseMarkerRef: RefObject<LighthouseMarkerState | null>;
}) {
  return (
    <Canvas
      className="absolute inset-0"
      style={{ position: "absolute", inset: 0 }}
      gl={{ preserveDrawingBuffer: isE2E }}
    >
      <CameraRig controllerRef={controllerRef} />
      <Environment />
      <LighthouseSceneObject markerRef={lighthouseMarkerRef} />
    </Canvas>
  );
}
