import type { ConnectionStatus, WorldState } from "@foundry/contracts";

/**
 * Bounded exponential backoff for stream reconnection (FBL-026:
 * "Reconnect uses bounded backoff"). Pure and deterministic so the policy
 * is testable without timers or a real network.
 */
export const INITIAL_BACKOFF_MS = 500;
export const MAX_BACKOFF_MS = 15_000;
export const BACKOFF_FACTOR = 2;

export function nextBackoffMs(attempt: number): number {
  if (attempt <= 0) return INITIAL_BACKOFF_MS;
  const raw = INITIAL_BACKOFF_MS * BACKOFF_FACTOR ** attempt;
  return Math.min(raw, MAX_BACKOFF_MS);
}

/**
 * Marks a locally-held projection as no longer authoritative while
 * disconnected (F-10: "Disconnect disables mutations and shows
 * disconnected/stale"). The last-known projection is deliberately
 * retained and *labeled*, never cleared and never advanced — the client
 * must not invent authoritative state for the gap.
 */
export function applyConnectionStatus(
  worldState: WorldState,
  status: ConnectionStatus,
): WorldState {
  if (status === "connected") {
    return {
      ...worldState,
      connectionStatus: "connected",
    };
  }
  return {
    ...worldState,
    connectionStatus: status,
    // Drives the Lighthouse's `disconnected` visual and every 2D surface
    // that reads health, via the existing computeLighthouseState path —
    // no separate parallel "is disconnected" signal to keep in sync.
    health: { status: "disconnected", reasons: ["connection_lost"] },
  };
}

/** Mutation controls must be disabled unless the stream is live (F-10). */
export function areMutationsAllowed(status: ConnectionStatus): boolean {
  return status === "connected";
}
