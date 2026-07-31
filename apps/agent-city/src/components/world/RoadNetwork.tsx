"use client";

import { useMemo } from "react";
import { useRuntime } from "@/lib/mock-runtime";
import { computeActiveRoadSegmentId, resolveRoadEndpoints } from "@/lib/world/roadNetwork";
import { WORLD_VEHICLE } from "@foundry/world-model";
import { Road } from "./Road";

// FBL-018 added the full permitted route graph (docs/02-specification/
// world-model.md → "Road network"): homes<->office, office<->warehouse,
// warehouse<->QA, QA<->dock. FBL-021 adds highlighting the one segment the
// vehicle is actively using, purely informational (Required behavior 6)
// — still no selection, no write path back into WorldState.
export function RoadNetwork() {
  const segments = useMemo(() => resolveRoadEndpoints(), []);
  const { worldState } = useRuntime();
  const activeTransfer = worldState.activeTransfers.find((t) => t.vehicleId === WORLD_VEHICLE.id);
  const activeSegmentId = computeActiveRoadSegmentId(activeTransfer);

  return (
    <>
      {segments.map(({ segment, from, to }) => (
        <Road key={segment.id} from={from} to={to} highlighted={segment.id === activeSegmentId} />
      ))}
    </>
  );
}
