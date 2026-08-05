"use client";

import { useEffect, useState, type RefObject } from "react";
import type { WorldObjectMarkerMap, WorldObjectMarkerState } from "@/lib/world/objectMarkerState";

const POLL_INTERVAL_MS = 150;

// Visually hidden (screen-reader only) status text per FBL-016+ world
// object, synchronized with each real 3D object's on-screen position — the
// generalized, multi-object counterpart to LighthouseMarker.tsx (FBL-014),
// used by every world object rung from FBL-016 on so Playwright can prove a
// specific object is mounted and rendered without pixel sampling.
export function WorldObjectMarkers({
  markerMapRef,
}: {
  markerMapRef: RefObject<WorldObjectMarkerMap>;
}) {
  const [markers, setMarkers] = useState<WorldObjectMarkerState[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarkers(Array.from(markerMapRef.current.values()));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [markerMapRef]);

  return (
    <>
      {markers.map((marker) => (
        <span key={marker.id}>
          <span
            className="sr-only"
            data-testid="world-object-marker"
            data-object-id={marker.id}
            data-visible={marker.visible}
            data-x-percent={marker.xPercent}
            data-y-percent={marker.yPercent}
            data-state={marker.state}
            data-hovered={marker.hovered}
            data-selected={marker.selected}
          >
            {marker.label} {marker.visible ? "visible" : "not visible"} in the 3D world, state:{" "}
            {marker.state}
            {marker.selected ? ", selected" : ""}.
          </span>
          {marker.visible && (marker.hovered || marker.selected) && (
            <span
              aria-hidden="true"
              data-testid="world-object-label"
              data-object-id={marker.id}
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-sky-300/25 bg-slate-950/90 px-2.5 py-1.5 text-[10px] whitespace-nowrap text-slate-300 shadow-xl backdrop-blur-md"
              style={{ left: `${marker.xPercent}%`, top: `${marker.yPercent}%` }}
            >
              <strong className="block text-[11px] font-semibold text-white">{marker.label}</strong>
              <span className="text-sky-200/80">{marker.state}</span>
            </span>
          )}
        </span>
      ))}
    </>
  );
}
