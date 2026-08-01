import type { WorldState } from "@foundry/contracts";
import type { EntityState } from "./reducer";

const ACTIVE_TRANSFER_STATUSES = new Set([
  "created",
  "blocked",
  "ready",
  "loading",
  "in_transit",
  "unloading",
]);

/**
 * Read-optimized WorldState projection (domain-model.md → WorldState) over
 * the full entity store. Not itself a source of truth — a view.
 */
export function projectWorldState(state: EntityState): WorldState {
  return {
    buildings: Object.values(state.buildings),
    agents: Object.values(state.agents),
    currentBuild: state.currentBuildId ? (state.builds[state.currentBuildId] ?? null) : null,
    activeTransfers: Object.values(state.transfers).filter((t) =>
      ACTIVE_TRANSFER_STATUSES.has(t.status),
    ),
    approvals: Object.values(state.approvals),
    inventoryCounts: state.inventoryCounts,
    health: state.health,
    lastProcessedEventId: state.lastProcessedEventId,
  };
}
