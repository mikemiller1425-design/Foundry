import type { AgentStatus } from "@foundry/contracts";
import { AGENT_STATE_VISUALS } from "@foundry/world-model";
import type { IndicatorShape } from "@/components/world/ShapeGeometry";

// docs/02-specification/world-model.md → "Architect / Builder / Inspector
// agents" → Allowed states / State→visual: "At residence, traveling,
// working at workplace, waiting, paused, failed, returning."
// `AGENT_STATE_VISUALS` (@foundry/world-model, built at FBL-007) already
// supplies the textual description per state; this table adds the color +
// non-color shape signal the renderer (Agent.tsx) needs — the eighth and
// final `AgentStatus` value maps 1:1 onto `ShapeGeometry`'s eighth and
// final shape, the same reuse pattern operationalBuildingVisuals.ts and
// vehicleVisuals.ts already established.
export interface AgentVisualSpec {
  status: AgentStatus;
  label: string;
  color: string;
  shape: IndicatorShape;
}

export const AGENT_VISUALS: Record<AgentStatus, AgentVisualSpec> = {
  idle: { status: "idle", label: AGENT_STATE_VISUALS.idle, color: "#a3a3a3", shape: "box" },
  assigned: {
    status: "assigned",
    label: AGENT_STATE_VISUALS.assigned,
    color: "#fbbf24",
    shape: "cone",
  },
  traveling: {
    status: "traveling",
    label: AGENT_STATE_VISUALS.traveling,
    color: "#38bdf8",
    shape: "torus",
  },
  working: {
    status: "working",
    label: AGENT_STATE_VISUALS.working,
    color: "#4ade80",
    shape: "icosahedron",
  },
  waiting: {
    status: "waiting",
    label: AGENT_STATE_VISUALS.waiting,
    color: "#facc15",
    shape: "cylinder",
  },
  paused: {
    status: "paused",
    label: AGENT_STATE_VISUALS.paused,
    color: "#f59e0b",
    shape: "octahedron",
  },
  failed: {
    status: "failed",
    label: AGENT_STATE_VISUALS.failed,
    color: "#ef4444",
    shape: "tetrahedron",
  },
  offline: {
    status: "offline",
    label: AGENT_STATE_VISUALS.offline,
    color: "#3f3f46",
    shape: "sphere",
  },
};

export const ALL_AGENT_STATUSES: readonly AgentStatus[] = [
  "idle",
  "assigned",
  "traveling",
  "working",
  "waiting",
  "paused",
  "failed",
  "offline",
];

/** Signature over every non-color dimension — proves no two states differ by color alone. */
export function agentNonColorSignature(spec: AgentVisualSpec): string {
  return spec.shape;
}
