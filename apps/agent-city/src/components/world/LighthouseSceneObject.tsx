"use client";

import { useFrame } from "@react-three/fiber";
import { useRuntime } from "@/lib/mock-runtime";
import { computeLighthouseState } from "@/lib/world/lighthouseState";
import { type RefObject, useMemo } from "react";
import { Vector3 } from "three";
import { BEACON_WORLD_POSITION, Lighthouse } from "./Lighthouse";
import type { LighthouseMarkerState } from "./lighthouseMarkerState";

// Bridges the shared runtime context (RuntimeProvider, provided well outside
// <Canvas>) into R3F's separate render tree via its-fine (the same
// mechanism @react-three/fiber's own <Canvas> Bridge relies on) — so this
// can read live WorldState without any props threaded down from AppShell.
//
// Also projects the beacon's world position to screen-space percentages
// every frame and writes them into `markerRef` — the real, targeted signal
// LighthouseMarker (outside the canvas) and shell-lighthouse.spec.ts use to
// prove the Lighthouse specifically is mounted and rendered, not just that
// the canvas contains more than one color.
export function LighthouseSceneObject({
  markerRef,
}: {
  markerRef: RefObject<LighthouseMarkerState | null>;
}) {
  const { worldState } = useRuntime();
  const state = computeLighthouseState(worldState);
  const beaconPosition = useMemo(() => new Vector3(...BEACON_WORLD_POSITION), []);

  useFrame(({ camera }) => {
    const projected = beaconPosition.clone().project(camera);
    const inFrontOfCamera = projected.z < 1;
    const withinFrame = Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1;
    markerRef.current = {
      visible: inFrontOfCamera && withinFrame,
      xPercent: ((projected.x + 1) / 2) * 100,
      yPercent: ((1 - projected.y) / 2) * 100,
      state,
    };
  });

  return <Lighthouse state={state} />;
}
