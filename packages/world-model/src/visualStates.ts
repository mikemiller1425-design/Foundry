import type { AgentStatus, BuildingStatus, VehicleStatus } from "@foundry/contracts";

// docs/02-specification/world-model.md — state→visual mapping tables.
// These are textual descriptions only (no rendering implementation); actual
// geometry/materials are a later build-ladder concern (FBL-013+).

// "Lighthouse" → State→visual
export const LIGHTHOUSE_STATE_VISUALS = {
  healthy: "Steady white",
  active: "Rotating blue",
  attention_required: "Yellow attention",
  degraded: "Orange pulse",
  critical: "Red rotating",
  disconnected: "Beam dark",
} as const;

// "Architect / Builder / Inspector agents" → State→visual
export const AGENT_STATE_VISUALS: Record<AgentStatus, string> = {
  idle: "At residence",
  assigned: "At residence, assignment pending",
  traveling: "Traveling",
  working: "Working at workplace",
  waiting: "Waiting",
  paused: "Paused",
  failed: "Failed",
  offline: "Offline",
};

// "Construction office" / generic workplace → State→visual
export const BUILDING_STATE_VISUALS: Record<BuildingStatus, string> = {
  idle: "Dim",
  active: "Lit / work",
  waiting: "Yellow wait",
  blocked: "Flashing blocked",
  degraded: "Amber degraded",
  failed: "Red fail",
  disconnected: "Beam dark",
  upgrading: "Restrained upgrading visual",
};

// "Utility vehicle" → Allowed states / State→visual
export const VEHICLE_STATE_VISUALS: Record<VehicleStatus, string> = {
  parked: "Parked",
  waiting: "Waiting",
  loading: "Loading",
  in_transit: "In transit",
  unloading: "Unloading",
  completed: "Completed (returns to parked)",
  failed: "Failed",
};

// "Construction site" → State→visual (structural progression by completed
// stages, not elapsed time).
export const CONSTRUCTION_SITE_PHASE_VISUALS = {
  foundation: "Foundation",
  frame: "Frame",
  enclosed: "Enclosed",
  inspected: "Inspected",
  completed: "Completed",
} as const;
