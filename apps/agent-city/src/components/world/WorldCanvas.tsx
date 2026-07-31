"use client";

import { Canvas } from "@react-three/fiber";

// FBL-011: bootstraps an empty React Three Fiber canvas in the shell's
// world region (ADR-004). No scene content — no geometry, lights, or
// camera rig — that belongs to later Phase C rungs (FBL-012+). Canvas
// fills and tracks its positioned parent's size automatically (R3F's
// built-in ResizeObserver), which is what satisfies "resize handling"
// at this rung; no manual resize wiring is needed until a camera exists.
export function WorldCanvas() {
  return (
    <Canvas
      aria-hidden="true"
      className="absolute inset-0"
      style={{ position: "absolute", inset: 0 }}
    />
  );
}
