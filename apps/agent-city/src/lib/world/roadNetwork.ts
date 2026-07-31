import type { Position } from "@foundry/contracts";
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
