"use client";

import { useEffect, useState, type RefObject } from "react";
import type { LighthouseMarkerState } from "./lighthouseMarkerState";

const POLL_INTERVAL_MS = 150;

// Visually hidden (screen-reader only) status text synchronized with the
// real 3D Lighthouse object's on-screen position — the accessible marker
// shell-lighthouse.spec.ts uses to verify the Lighthouse specifically is
// mounted and rendered (not just that the canvas contains some content).
export function LighthouseMarker({
  markerRef,
}: {
  markerRef: RefObject<LighthouseMarkerState | null>;
}) {
  const [marker, setMarker] = useState<LighthouseMarkerState | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setMarker(markerRef.current), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [markerRef]);

  return (
    <span
      className="sr-only"
      data-testid="lighthouse-marker"
      data-visible={marker?.visible ?? false}
      data-x-percent={marker?.xPercent ?? ""}
      data-y-percent={marker?.yPercent ?? ""}
      data-state={marker?.state ?? ""}
    >
      Lighthouse {marker?.visible ? "visible" : "not visible"} in the 3D world, state:{" "}
      {marker?.state ?? "unknown"}.
    </span>
  );
}
