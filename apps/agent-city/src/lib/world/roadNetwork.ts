import type { Position, Transfer } from "@foundry/contracts";
import { ROAD_SEGMENTS, WORLD_BUILDINGS, type RoadSegmentDefinition } from "@foundry/world-model";

// docs/02-specification/world-model.md → "Road network" → Relationships:
// "Homes↔office; office↔warehouse; warehouse↔QA; QA↔dock; visibility to
// Lighthouse". FBL-018 renders only the permitted route graph
// `@foundry/world-model`'s `ROAD_SEGMENTS` already declares (built at
// FBL-007) — this module's only job is resolving each segment's two
// building ids to real world positions, so a segment naming a building
// that doesn't exist in `WORLD_BUILDINGS` fails loudly rather than
// silently rendering a route to nowhere (this rung's own explicit failure
// condition: "A road implying a route that does not exist ... is a
// failure").
export interface RoadEndpoints {
  segment: RoadSegmentDefinition;
  from: Position;
  to: Position;
}

export function resolveRoadEndpoints(segments: readonly RoadSegmentDefinition[] = ROAD_SEGMENTS): RoadEndpoints[] {
  return segments.map((segment) => {
    const from = WORLD_BUILDINGS.find((b) => b.id === segment.fromBuildingId);
    const to = WORLD_BUILDINGS.find((b) => b.id === segment.toBuildingId);
    if (!from) {
      throw new Error(`Road segment "${segment.id}" references unknown building "${segment.fromBuildingId}"`);
    }
    if (!to) {
      throw new Error(`Road segment "${segment.id}" references unknown building "${segment.toBuildingId}"`);
    }
    return { segment, from: from.position, to: to.position };
  });
}

/**
 * FBL-021 — Required behavior 6: "Roads may highlight a declared active
 * route but never authorize a transfer." Highlighting exists purely to
 * show where the vehicle is currently moving — it is derived from (and
 * can only ever reflect) the same Transfer record the vehicle's own
 * position and state read from (`vehiclePosition.ts`), so a road can never
 * highlight ahead of, or in the absence of, a real `transfer.started`. No
 * road segment ever gates or enables a transfer decision — this function
 * has no write path back into `WorldState`.
 */
export function computeActiveRoadSegmentId(
  activeTransfer: Transfer | undefined,
  segments: readonly RoadSegmentDefinition[] = ROAD_SEGMENTS,
): string | null {
  if (!activeTransfer) return null;
  if (activeTransfer.status !== "in_transit" && activeTransfer.status !== "unloading") return null;
  const match = segments.find(
    (s) =>
      (s.fromBuildingId === activeTransfer.sourceBuildingId &&
        s.toBuildingId === activeTransfer.destinationBuildingId) ||
      (s.fromBuildingId === activeTransfer.destinationBuildingId &&
        s.toBuildingId === activeTransfer.sourceBuildingId),
  );
  return match?.id ?? null;
}
