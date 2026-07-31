// docs/02-specification/world-model.md → "Road network" → Relationships:
// "Homes↔office; office↔warehouse; warehouse↔QA; QA↔dock; visibility to Lighthouse".
export interface RoadSegmentDefinition {
  id: string;
  fromBuildingId: string;
  toBuildingId: string;
}

export const ROAD_SEGMENTS: readonly RoadSegmentDefinition[] = [
  {
    id: "road-architect-office",
    fromBuildingId: "home-architect",
    toBuildingId: "construction-office",
  },
  {
    id: "road-builder-office",
    fromBuildingId: "home-builder",
    toBuildingId: "construction-office",
  },
  {
    id: "road-inspector-office",
    fromBuildingId: "home-inspector",
    toBuildingId: "construction-office",
  },
  { id: "road-office-warehouse", fromBuildingId: "construction-office", toBuildingId: "warehouse" },
  { id: "road-warehouse-qa", fromBuildingId: "warehouse", toBuildingId: "qa" },
  { id: "road-qa-dock", fromBuildingId: "qa", toBuildingId: "deployment-dock" },
] as const;

// Only the QA↔Dock segment carries the sole approval-gated transfer leg in
// V1 (resolves audit finding B-01) — see domain-model.md Transfer invariants.
export const APPROVAL_GATED_ROAD_SEGMENT_ID = "road-qa-dock";
