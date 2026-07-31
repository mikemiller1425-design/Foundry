import type { IndicatorShape } from "@/components/world/ShapeGeometry";
import type { ResidenceState } from "./residenceState";

// docs/02-specification/world-model.md → "Architect / Builder / Inspector
// residences" → State→visual: "Lights/occupancy markers; vacant when agent
// assigned elsewhere". A single declarative table, the same pattern
// lighthouseVisuals.ts established: one source of truth for both the
// renderer (Residence.tsx) and the distinctness unit tests, using shape
// (never color alone) to keep every state distinguishable under reduced
// motion too, since residences carry no motion at all (Principle:
// "Ambient visuals may loop but cannot imply work completion" — a
// persistent identity marker has no completion to imply, so this rung
// keeps residences fully static).
export interface ResidenceVisualSpec {
  state: ResidenceState;
  label: string;
  color: string;
  windowLit: boolean;
  shape: IndicatorShape;
}

export const RESIDENCE_VISUALS: Record<ResidenceState, ResidenceVisualSpec> = {
  occupied_idle: {
    state: "occupied_idle",
    label: "Occupied — idle, window lit",
    color: "#facc15",
    windowLit: true,
    shape: "box",
  },
  vacant_assigned: {
    state: "vacant_assigned",
    label: "Vacant — assigned elsewhere, window dark",
    color: "#38bdf8",
    windowLit: false,
    shape: "cone",
  },
  unavailable: {
    state: "unavailable",
    label: "Unavailable, window dark",
    color: "#52525b",
    windowLit: false,
    shape: "tetrahedron",
  },
  paused: {
    state: "paused",
    label: "Paused, amber marker",
    color: "#f59e0b",
    windowLit: true,
    shape: "octahedron",
  },
  degraded: {
    state: "degraded",
    label: "Degraded, red marker",
    color: "#ef4444",
    windowLit: true,
    shape: "icosahedron",
  },
};

export const ALL_RESIDENCE_VISUAL_STATES: readonly ResidenceState[] = [
  "occupied_idle",
  "vacant_assigned",
  "unavailable",
  "paused",
  "degraded",
];

/** Signature over every non-color dimension — proves no two states differ by color alone. */
export function residenceNonColorSignature(spec: ResidenceVisualSpec): string {
  return [spec.windowLit, spec.shape].join("|");
}
