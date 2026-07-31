import type { LighthouseState } from "./lighthouseState";

// FBL-014 — declarative Lighthouse state→visual mapping
// (docs/02-specification/world-model.md → "Lighthouse" → State→visual:
// "Steady white / rotating blue / yellow attention / orange pulse / red
// rotating / beam dark"). A single source of truth consumed by both the
// R3F rendering component (Lighthouse.tsx) and by unit tests — so a claim
// about what's visually distinguishable is always backed by an assertion
// against the same data the renderer actually uses, not a separate,
// driftable description.
//
// Two independent non-color signals exist per state, so states remain
// distinguishable under reduced motion (shape) and distinguishable even
// with motion (beamMotion): the beam itself (visibility + motion — the
// Lighthouse's defining visual feature) and a small beacon shape at the
// lantern (an additional non-color signal, not a replacement for the
// beam).
export type BeamMotion = "steady" | "rotating" | "pulsing" | "none";
export type BeaconShape = "icosahedron" | "torus" | "cone" | "box" | "octahedron" | "tetrahedron";

export interface LighthouseVisualSpec {
  state: LighthouseState;
  /** Accessible textual label — the state's textual equivalent (world-model.md: "accessible textual name and state"). */
  label: string;
  color: string;
  beamVisible: boolean;
  beamMotion: BeamMotion;
  /** Radians/second when beamMotion is "rotating"; distinguishes active from critical. */
  rotationSpeed: number;
  /** Pulses/second when beamMotion is "pulsing"; distinguishes attention_required from degraded. */
  pulseSpeed: number;
  shape: BeaconShape;
}

export const LIGHTHOUSE_VISUALS: Record<LighthouseState, LighthouseVisualSpec> = {
  healthy: {
    state: "healthy",
    label: "Healthy — steady white beam",
    color: "#f5f5f5",
    beamVisible: true,
    beamMotion: "steady",
    rotationSpeed: 0,
    pulseSpeed: 0,
    shape: "icosahedron",
  },
  active: {
    state: "active",
    label: "Active — rotating blue beam",
    color: "#38bdf8",
    beamVisible: true,
    beamMotion: "rotating",
    rotationSpeed: 1.2,
    pulseSpeed: 0,
    shape: "torus",
  },
  attention_required: {
    state: "attention_required",
    label: "Attention required — yellow attention signal",
    color: "#fbbf24",
    beamVisible: true,
    beamMotion: "pulsing",
    rotationSpeed: 0,
    pulseSpeed: 4,
    shape: "cone",
  },
  degraded: {
    state: "degraded",
    label: "Degraded — orange pulse",
    color: "#fb923c",
    beamVisible: true,
    beamMotion: "pulsing",
    rotationSpeed: 0,
    pulseSpeed: 1.5,
    shape: "box",
  },
  critical: {
    state: "critical",
    label: "Critical — red rotating signal",
    color: "#ef4444",
    beamVisible: true,
    beamMotion: "rotating",
    rotationSpeed: 2.6,
    pulseSpeed: 0,
    shape: "octahedron",
  },
  disconnected: {
    state: "disconnected",
    label: "Disconnected — beam dark",
    color: "#3f3f46",
    beamVisible: false,
    beamMotion: "none",
    rotationSpeed: 0,
    pulseSpeed: 0,
    shape: "tetrahedron",
  },
};

export const ALL_LIGHTHOUSE_STATES: readonly LighthouseState[] = [
  "healthy",
  "active",
  "attention_required",
  "degraded",
  "critical",
  "disconnected",
];

/** A signature over every non-color dimension — used to prove two states never differ by color alone. */
export function nonColorSignature(spec: LighthouseVisualSpec): string {
  return [spec.beamVisible, spec.beamMotion, spec.rotationSpeed, spec.pulseSpeed, spec.shape].join(
    "|",
  );
}

/** The signature that remains once motion is disabled (reduced motion) — shape and beam presence only. */
export function reducedMotionSignature(spec: LighthouseVisualSpec): string {
  return [spec.beamVisible, spec.shape].join("|");
}
