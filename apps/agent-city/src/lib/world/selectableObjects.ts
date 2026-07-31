import { BEACON_WORLD_POSITION } from "@/components/world/Lighthouse";
import { WORLD_BUILDINGS } from "@foundry/world-model";
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

export const SELECTABLE_WORLD_OBJECTS: readonly SelectableWorldObject[] = [
  { id: "lighthouse", kind: "building", label: "Lighthouse", focusPosition: BEACON_WORLD_POSITION },
  ...RESIDENCE_OBJECTS,
  ...OPERATIONAL_BUILDING_OBJECTS,
];
