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
    <>
      <span
        className="sr-only"
        data-testid="lighthouse-marker"
        data-visible={marker?.visible ?? false}
        data-x-percent={marker?.xPercent ?? ""}
        data-y-percent={marker?.yPercent ?? ""}
        data-state={marker?.state ?? ""}
        data-hovered={marker?.hovered ?? false}
        data-selected={marker?.selected ?? false}
      >
        Lighthouse {marker?.visible ? "visible" : "not visible"} in the 3D world, state:{" "}
        {marker?.state ?? "unknown"}
        {marker?.selected ? ", selected" : ""}.
      </span>
      {marker?.visible && (marker.hovered || marker.selected) && (
        <span
          aria-hidden="true"
          data-testid="lighthouse-world-label"
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-sky-300/25 bg-slate-950/90 px-2.5 py-1.5 text-[10px] whitespace-nowrap text-slate-300 shadow-xl backdrop-blur-md"
          style={{ left: `${marker.xPercent}%`, top: `${marker.yPercent}%` }}
        >
          <strong className="block text-[11px] font-semibold text-white">Lighthouse</strong>
          <span className="text-sky-200/80">{marker.state}</span>
        </span>
      )}
    </>
  );
}
