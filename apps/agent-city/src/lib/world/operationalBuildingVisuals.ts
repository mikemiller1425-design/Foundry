import type { BuildingStatus } from "@foundry/contracts";
import { BUILDING_STATE_VISUALS } from "@foundry/world-model";
import type { IndicatorShape } from "@/components/world/ShapeGeometry";

// docs/02-specification/domain-model.md → "Building" → Allowed states: the
// single generic vocabulary every non-residence, non-Lighthouse building in
// V1 shares (Construction Office, Warehouse, QA, Deployment Dock —
// Construction Site instead uses its own stage-progression vocabulary, see
// constructionSitePhaseVisuals.ts). `BUILDING_STATE_VISUALS`
// (@foundry/world-model, built at FBL-007) already supplies the textual
// description per state; this table adds the color + non-color shape
// signal the renderer (OperationalBuilding.tsx) needs, keeping the same
// declarative-table-backs-both-renderer-and-tests discipline
// lighthouseVisuals.ts / residenceVisuals.ts established.
export interface OperationalBuildingVisualSpec {
  status: BuildingStatus;
  label: string;
  color: string;
  shape: IndicatorShape;
}

export const OPERATIONAL_BUILDING_VISUALS: Record<BuildingStatus, OperationalBuildingVisualSpec> = {
  idle: { status: "idle", label: BUILDING_STATE_VISUALS.idle, color: "#71717a", shape: "box" },
  active: {
    status: "active",
    label: BUILDING_STATE_VISUALS.active,
    color: "#38bdf8",
    shape: "torus",
  },
  waiting: {
    status: "waiting",
    label: BUILDING_STATE_VISUALS.waiting,
    color: "#fbbf24",
    shape: "cone",
  },
  blocked: {
    status: "blocked",
    label: BUILDING_STATE_VISUALS.blocked,
    color: "#f97316",
    shape: "octahedron",
  },
  degraded: {
    status: "degraded",
    label: BUILDING_STATE_VISUALS.degraded,
    color: "#f59e0b",
    shape: "icosahedron",
  },
  failed: {
    status: "failed",
    label: BUILDING_STATE_VISUALS.failed,
    color: "#ef4444",
    shape: "tetrahedron",
  },
  disconnected: {
    status: "disconnected",
    label: BUILDING_STATE_VISUALS.disconnected,
    color: "#3f3f46",
    shape: "sphere",
  },
  upgrading: {
    status: "upgrading",
    label: BUILDING_STATE_VISUALS.upgrading,
    color: "#a78bfa",
    shape: "cylinder",
  },
};

export const ALL_BUILDING_STATUSES: readonly BuildingStatus[] = [
  "idle",
  "active",
  "waiting",
  "blocked",
  "degraded",
  "failed",
  "disconnected",
  "upgrading",
];

/** Signature over every non-color dimension — proves no two states differ by color alone. */
export function operationalBuildingNonColorSignature(spec: OperationalBuildingVisualSpec): string {
  return spec.shape;
}
