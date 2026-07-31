import type { IndicatorShape } from "@/components/world/ShapeGeometry";
import { ALL_CARGO_STATES, type CargoState } from "./cargoState";

// docs/02-specification/world-model.md → "Cargo" → State→visual: "Seal
// only when backend authorizes readiness." A declarative table (the same
// pattern every prior FBL-016+ visual table follows): color + shape, so a
// distinctness claim is always backed by the same data the renderer uses.
export interface CargoVisualSpec {
  state: CargoState;
  label: string;
  color: string;
  sealed: boolean;
  shape: IndicatorShape;
}

export const CARGO_VISUALS: Record<CargoState, CargoVisualSpec> = {
  open_incomplete: {
    state: "open_incomplete",
    label: "Open — incomplete",
    color: "#a3a3a3",
    sealed: false,
    shape: "box",
  },
  blocked: {
    state: "blocked",
    label: "Blocked",
    color: "#ef4444",
    sealed: false,
    shape: "octahedron",
  },
  validating: {
    state: "validating",
    label: "Validating",
    color: "#38bdf8",
    sealed: false,
    shape: "cone",
  },
  sealed_ready: {
    state: "sealed_ready",
    label: "Sealed — ready for transfer",
    color: "#4ade80",
    sealed: true,
    shape: "icosahedron",
  },
  in_transit: {
    state: "in_transit",
    label: "In transit",
    color: "#facc15",
    sealed: true,
    shape: "torus",
  },
  received: {
    state: "received",
    label: "Received",
    color: "#34d399",
    sealed: true,
    shape: "sphere",
  },
  rejected: {
    state: "rejected",
    label: "Rejected",
    color: "#dc2626",
    sealed: false,
    shape: "tetrahedron",
  },
};

/** Signature over every non-color dimension — proves no two states differ by color alone. */
export function cargoNonColorSignature(spec: CargoVisualSpec): string {
  return [spec.sealed, spec.shape].join("|");
}

export { ALL_CARGO_STATES };
