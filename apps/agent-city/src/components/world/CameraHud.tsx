"use client";

import { useEffect, useState, type RefObject } from "react";
import type { CameraControllerHandle } from "./cameraController";

const POLL_INTERVAL_MS = 150;
const RADIANS_TO_DEGREES = 180 / Math.PI;

// The 2D "Reset View" control required outside the Canvas (world-model.md
// "World camera": reset; interface-model.md keyboard-operation rules),
// plus textual camera instructions and a live position readout — visible
// without relying on any pointer gesture, and operable without touching
// the 3D canvas at all.
export function CameraHud({
  controllerRef,
}: {
  controllerRef: RefObject<CameraControllerHandle | null>;
}) {
  const [readout, setReadout] = useState(
    "Distance: — · Target: (—, —, —) · Azimuth: —° · Elevation: —°",
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const state = controllerRef.current?.getState();
      if (!state) return;
      const elevationDeg = 90 - state.polar * RADIANS_TO_DEGREES;
      const azimuthDeg = state.azimuth * RADIANS_TO_DEGREES;
      setReadout(
        `Distance: ${state.distance.toFixed(1)} · Target: (${state.target.x.toFixed(1)}, ${state.target.y.toFixed(1)}, ${state.target.z.toFixed(1)}) · Azimuth: ${azimuthDeg.toFixed(0)}° · Elevation: ${elevationDeg.toFixed(0)}°`,
      );
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [controllerRef]);

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs text-xs text-neutral-400">
      <button
        type="button"
        onClick={() => controllerRef.current?.reset()}
        className="pointer-events-auto rounded border border-neutral-700 bg-neutral-900/90 px-2 py-1 text-neutral-200 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
      >
        Reset view
      </button>
      <p data-testid="camera-readout" className="mt-1 rounded bg-neutral-900/70 px-2 py-1">
        {readout}
      </p>
      <p className="mt-1 rounded bg-neutral-900/70 px-2 py-1">
        Camera: focus the 3D world (click or Tab into it), then use arrow keys to orbit, Shift+arrow
        keys to pan, +/- to zoom, Home to reset. Drag to orbit, Shift+drag to pan, scroll to zoom.
      </p>
    </div>
  );
}
