// Generalizes lighthouseMarkerState.ts's single-object ref pattern to every
// FBL-016+ world object: a plain mutable Map, written every frame (per
// object id) inside <Canvas> by each scene-object bridge, and polled
// outside <Canvas> by WorldObjectMarkers.tsx. If a scene object stops
// mounting, its id's entry stops updating and its "visible" flag can never
// report true again — the same real-browser-testable guarantee
// lighthouseMarkerState.ts already relies on, extended to N objects instead
// of one.
export interface WorldObjectMarkerState {
  id: string;
  label: string;
  visible: boolean;
  xPercent: number;
  yPercent: number;
  state: string;
  hovered: boolean;
  selected: boolean;
}

export type WorldObjectMarkerMap = Map<string, WorldObjectMarkerState>;
