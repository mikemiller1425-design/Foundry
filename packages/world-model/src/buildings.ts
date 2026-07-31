import type { BuildingType, Position } from "@foundry/contracts";

// docs/01-mission/v1-scope.md § "Required world elements";
// docs/02-specification/domain-model.md → Building → V1 limits.
// Stable identifiers + placeholder layout positions for the nine V1
// buildings. Positions are illustrative grid coordinates for later 3D
// rungs (FBL-016+) — no geometry is implied by this package alone.
export interface WorldBuildingDefinition {
  id: string;
  name: string;
  buildingType: BuildingType;
  position: Position;
}

export const WORLD_BUILDINGS: readonly WorldBuildingDefinition[] = [
  {
    id: "lighthouse",
    name: "Lighthouse",
    buildingType: "lighthouse",
    position: { x: 0, y: 0, z: -10 },
  },
  {
    id: "home-architect",
    name: "Architect Residence",
    buildingType: "home",
    position: { x: -8, y: 0, z: 4 },
  },
  {
    id: "home-builder",
    name: "Builder Residence",
    buildingType: "home",
    position: { x: -4, y: 0, z: 4 },
  },
  {
    id: "home-inspector",
    name: "Inspector Residence",
    buildingType: "home",
    position: { x: 0, y: 0, z: 4 },
  },
  {
    id: "construction-office",
    name: "Construction Office",
    buildingType: "construction_office",
    position: { x: -4, y: 0, z: 0 },
  },
  { id: "warehouse", name: "Warehouse", buildingType: "warehouse", position: { x: 4, y: 0, z: 0 } },
  { id: "qa", name: "QA Building", buildingType: "qa", position: { x: 8, y: 0, z: 0 } },
  {
    id: "deployment-dock",
    name: "Deployment Dock",
    buildingType: "deployment_dock",
    position: { x: 12, y: 0, z: 0 },
  },
  {
    id: "construction-site",
    name: "Construction Site",
    buildingType: "construction_site",
    // FBL-017: given a distinct x lane (not shared with any other building)
    // so it never visually collapses into the Construction Office from the
    // canonical camera angle — the two previously shared x = -4, differing
    // only in z, which projected to overlapping screen positions once both
    // had real geometry.
    position: { x: -12, y: 0, z: -2 },
  },
] as const;

export function getWorldBuildingId(buildingType: BuildingType, name?: string): string {
  const match = WORLD_BUILDINGS.find(
    (building) => building.buildingType === buildingType && (!name || building.name === name),
  );
  if (!match) {
    throw new Error(`No world building defined for type "${buildingType}"`);
  }
  return match.id;
}
