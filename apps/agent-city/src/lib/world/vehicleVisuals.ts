import type { VehicleStatus } from "@foundry/contracts";
import { VEHICLE_STATE_VISUALS } from "@foundry/world-model";
import type { IndicatorShape } from "@/components/world/ShapeGeometry";

// docs/02-specification/world-model.md → "Utility vehicle" → Allowed
// states / State→visual: "Motion only after transfer.started; cannot load
// unless transfer ready." `VEHICLE_STATE_VISUALS` (@foundry/world-model,
// built at FBL-007) already supplies the textual description per state;
// this table adds the color + non-color shape signal the renderer
// (Vehicle.tsx) needs, the same declarative-table discipline every prior
// FBL-016+ visual table follows.
export interface VehicleVisualSpec {
  status: VehicleStatus;
  label: string;
  color: string;
  shape: IndicatorShape;
}

export const VEHICLE_VISUALS: Record<VehicleStatus, VehicleVisualSpec> = {
  parked: { status: "parked", label: VEHICLE_STATE_VISUALS.parked, color: "#71717a", shape: "box" },
  waiting: {
    status: "waiting",
    label: VEHICLE_STATE_VISUALS.waiting,
    color: "#fbbf24",
    shape: "cone",
  },
  loading: {
    status: "loading",
    label: VEHICLE_STATE_VISUALS.loading,
    color: "#38bdf8",
    shape: "cylinder",
  },
  in_transit: {
    status: "in_transit",
    label: VEHICLE_STATE_VISUALS.in_transit,
    color: "#4ade80",
    shape: "torus",
  },
  unloading: {
    status: "unloading",
    label: VEHICLE_STATE_VISUALS.unloading,
    color: "#38bdf8",
    shape: "octahedron",
  },
  completed: {
    status: "completed",
    label: VEHICLE_STATE_VISUALS.completed,
    color: "#34d399",
    shape: "icosahedron",
  },
  failed: {
    status: "failed",
    label: VEHICLE_STATE_VISUALS.failed,
    color: "#ef4444",
    shape: "tetrahedron",
  },
};

export const ALL_VEHICLE_STATUSES: readonly VehicleStatus[] = [
  "parked",
  "waiting",
  "loading",
  "in_transit",
  "unloading",
  "completed",
  "failed",
];

/** Signature over every non-color dimension — proves no two states differ by color alone. */
export function vehicleNonColorSignature(spec: VehicleVisualSpec): string {
  return spec.shape;
}
