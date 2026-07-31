// A plain mutable ref (same cross-render-tree pattern as
// cameraController.ts) written by LighthouseSceneObject (inside <Canvas>,
// every frame) and read by LighthouseMarker (outside <Canvas>, polling on
// an interval) — the real-browser-testable proof that the Lighthouse is
// actually mounted and where it currently projects on screen. If
// LighthouseSceneObject is removed, nothing ever writes here again, so
// `visible` can never become true.
export interface LighthouseMarkerState {
  visible: boolean;
  xPercent: number;
  yPercent: number;
  state: string;
}
