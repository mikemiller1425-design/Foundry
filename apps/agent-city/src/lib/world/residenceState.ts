import type { Agent, Building } from "@foundry/contracts";

// docs/02-specification/world-model.md → "Architect / Builder / Inspector
// residences" → Allowed states: "Occupied/idle, vacant-assigned,
// unavailable, paused, degraded". A residence is a Building (buildingType
// "home") but Building.status alone (domain-model.md's generic
// idle/active/waiting/blocked/degraded/failed/disconnected/upgrading) does
// not carry "vacant because the resident agent is currently elsewhere" —
// that fact lives on the Agent (event-model.md → "Agent": agent.assigned
// "Frontend: residence vacant/assigned"; agent.returned_home "residence
// occupancy marker returns to occupied/idle"). computeResidenceState
// derives the residence's own five-state vocabulary deterministically from
// both records, the same "one pure function, no timers" approach
// lighthouseState.ts established at FBL-014.
export type ResidenceState =
  | "occupied_idle"
  | "vacant_assigned"
  | "unavailable"
  | "paused"
  | "degraded";

const BUILDING_LEVEL_PROBLEM_STATUSES = new Set<Building["status"]>([
  "degraded",
  "disconnected",
  "failed",
]);

/**
 * Precedence (most severe first), mirroring lighthouseState.ts's rule that
 * a genuine problem always outranks routine status: a building-level
 * problem (degraded/disconnected/failed) > the resident agent being
 * unreachable (offline) > paused > away on assignment (vacant) > the
 * default occupied/idle.
 */
export function computeResidenceState(building: Building, agent: Agent | undefined): ResidenceState {
  if (BUILDING_LEVEL_PROBLEM_STATUSES.has(building.status)) return "degraded";
  if (!agent || agent.status === "offline") return "unavailable";
  if (agent.status === "paused") return "paused";
  if (agent.currentBuildingId !== agent.homeBuildingId) return "vacant_assigned";
  return "occupied_idle";
}

export const RESIDENCE_STATE_SHORT_LABEL: Record<ResidenceState, string> = {
  occupied_idle: "Occupied — idle",
  vacant_assigned: "Vacant — assigned elsewhere",
  unavailable: "Unavailable",
  paused: "Paused",
  degraded: "Degraded",
};

export const ALL_RESIDENCE_STATES: readonly ResidenceState[] = [
  "occupied_idle",
  "vacant_assigned",
  "unavailable",
  "paused",
  "degraded",
];
