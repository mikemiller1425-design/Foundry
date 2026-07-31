import type { Position } from "@foundry/contracts";
import { WORLD_BUILDINGS } from "@foundry/world-model";

// docs/03-architecture/foundry-build-ladder.md FBL-020 → "An agent
// occupying two locations simultaneously (even visually) is a failure."
// An agent's `currentBuildingId` (domain-model.md → Agent) is a single
// field, so resolving it to exactly one building position is what makes
// that invariant true by construction — this function can only ever
// return one position per call, never two, and always the position of
// whichever single building `currentBuildingId` currently names.
//
// A small per-agent-index offset keeps multiple agents visually
// distinguishable from each other and from the building itself when more
// than one agent is at the same building — a visual-clarity nicety, not
// part of the "two locations" invariant above.
const AGENT_OFFSETS: readonly (readonly [number, number])[] = [
  [-0.8, 0.8],
  [0.8, 0.8],
  [0, -0.9],
];

export function computeAgentPosition(
  currentBuildingId: string,
  agentIndex: number,
): Position | null {
  const building = WORLD_BUILDINGS.find((b) => b.id === currentBuildingId);
  if (!building) return null;
  const [offsetX, offsetZ] = AGENT_OFFSETS[agentIndex % AGENT_OFFSETS.length]!;
  return {
    x: building.position.x + offsetX,
    y: building.position.y,
    z: building.position.z + offsetZ,
  };
}
