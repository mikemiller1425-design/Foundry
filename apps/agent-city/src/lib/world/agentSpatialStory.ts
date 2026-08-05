import type { AgentStatus } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { WORLD_BUILDINGS } from "@foundry/world-model";

export interface AgentRouteCue {
  agentId: string;
  sourceBuildingId: string;
  destinationBuildingId: string;
  source: readonly [number, number, number];
  destination: readonly [number, number, number];
  eventId: string;
}

function buildingPoint(buildingId: string): readonly [number, number, number] | null {
  const building = WORLD_BUILDINGS.find((candidate) => candidate.id === buildingId);
  return building ? [building.position.x, building.position.y + 0.09, building.position.z] : null;
}

/**
 * Returns a declared source→destination route only while the projected agent
 * is traveling. It does not interpolate the agent or claim their live GPS
 * position: `agent.arrived` remains the sole authority that moves them.
 */
export function deriveAgentRouteCue(
  agentId: string,
  status: AgentStatus,
  events: readonly FoundryEvent[],
): AgentRouteCue | null {
  if (status !== "traveling") return null;
  const departed = [...events]
    .reverse()
    .find((event) => event.entityId === agentId && event.type === "agent.departed");
  if (!departed || departed.type !== "agent.departed") return null;

  const source = buildingPoint(departed.payload.sourceBuildingId);
  const destination = buildingPoint(departed.payload.destinationBuildingId);
  if (!source || !destination) return null;

  return {
    agentId,
    sourceBuildingId: departed.payload.sourceBuildingId,
    destinationBuildingId: departed.payload.destinationBuildingId,
    source,
    destination,
    eventId: departed.id,
  };
}

export function routeSamples(
  source: readonly [number, number, number],
  destination: readonly [number, number, number],
  count = 8,
): readonly (readonly [number, number, number])[] {
  if (count < 2) return [source];
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return source;
    if (index === count - 1) return destination;
    const t = index / (count - 1);
    return [
      source[0] + (destination[0] - source[0]) * t,
      source[1] + (destination[1] - source[1]) * t + Math.sin(Math.PI * t) * 0.34,
      source[2] + (destination[2] - source[2]) * t,
    ] as const;
  });
}
