import { BEACON_WORLD_POSITION } from "@/components/world/Lighthouse";

// FBL-015 — generalized selectable-world-object registry. Only the
// Lighthouse exists today; residences/operational buildings (FBL-016+)
// extend this same list rather than inventing a parallel mechanism —
// that reuse is the rung's own explicit requirement.
export interface SelectableWorldObject {
  id: string;
  label: string;
  /** World-space point the camera should focus() on when this object is selected. */
  focusPosition: readonly [number, number, number];
}

export const SELECTABLE_WORLD_OBJECTS: readonly SelectableWorldObject[] = [
  { id: "lighthouse", label: "Lighthouse", focusPosition: BEACON_WORLD_POSITION },
];
