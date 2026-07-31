import { BEACON_WORLD_POSITION } from "@/components/world/Lighthouse";
import { WORLD_BUILDINGS, WORLD_VEHICLE } from "@foundry/world-model";
import type { Selection } from "@/components/controls/selection";

// FBL-015 — generalized selectable-world-object registry. FBL-016 extends
// it with the three residences rather than inventing a parallel mechanism
// — that reuse is the rung's own explicit requirement.
export interface SelectableWorldObject {
  id: string;
  kind: Selection["kind"];
  label: string;
  /** World-space point the camera should focus() on when this object is selected. */
  focusPosition: readonly [number, number, number];
}

const RESIDENCE_FOCUS_HEIGHT = 2.05;
const OPERATIONAL_BUILDING_FOCUS_HEIGHT = 2.4;

const RESIDENCE_OBJECTS: readonly SelectableWorldObject[] = WORLD_BUILDINGS.filter(
  (b) => b.buildingType === "home",
).map((b) => ({
  id: b.id,
  kind: "building",
  label: b.name,
  focusPosition: [b.position.x, b.position.y + RESIDENCE_FOCUS_HEIGHT, b.position.z],
}));

// FBL-017 — Construction Office, Warehouse, QA, Deployment Dock,
// Construction Site.
const OPERATIONAL_BUILDING_OBJECTS: readonly SelectableWorldObject[] = WORLD_BUILDINGS.filter(
  (b) => b.buildingType !== "home" && b.buildingType !== "lighthouse",
).map((b) => ({
  id: b.id,
  kind: "building",
  label: b.name,
  focusPosition: [b.position.x, b.position.y + OPERATIONAL_BUILDING_FOCUS_HEIGHT, b.position.z],
}));

// FBL-019 — the single utility vehicle, parked beside its home building
// (WorldCanvas/VehicleSceneObject.tsx: HOME_OFFSET_X = 2.2).
const VEHICLE_FOCUS_HEIGHT = 1.15;
const VEHICLE_HOME_OFFSET_X = 2.2;

const vehicleHomeBuilding = WORLD_BUILDINGS.find((b) => b.id === WORLD_VEHICLE.homeBuildingId);

const VEHICLE_OBJECT: SelectableWorldObject | null = vehicleHomeBuilding
  ? {
      id: WORLD_VEHICLE.id,
      kind: "vehicle",
      label: WORLD_VEHICLE.name,
      focusPosition: [
        vehicleHomeBuilding.position.x + VEHICLE_HOME_OFFSET_X,
        vehicleHomeBuilding.position.y + VEHICLE_FOCUS_HEIGHT,
        vehicleHomeBuilding.position.z,
      ],
    }
  : null;

export const SELECTABLE_WORLD_OBJECTS: readonly SelectableWorldObject[] = [
  { id: "lighthouse", kind: "building", label: "Lighthouse", focusPosition: BEACON_WORLD_POSITION },
  ...RESIDENCE_OBJECTS,
  ...OPERATIONAL_BUILDING_OBJECTS,
  ...(VEHICLE_OBJECT ? [VEHICLE_OBJECT] : []),
];
