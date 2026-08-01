import type { FoundryEvent } from "@foundry/event-types";

/**
 * Merges newly-delivered events into a locally-held ordered log.
 *
 * Guarantees (FBL-026):
 * - Duplicate delivery is idempotent — an event id already present is
 *   dropped, so a redelivered backlog after reconnect cannot duplicate
 *   timeline rows or re-apply state (F-09).
 * - Ordering is preserved — the backend log order is authoritative, so
 *   events that arrive out of order relative to what the client already
 *   holds are placed by their authoritative position rather than simply
 *   appended.
 *
 * `authoritativeOrder`, when supplied (a fresh snapshot's full log after
 * reconnect), defines the canonical sequence; otherwise incoming order is
 * treated as canonical, which is correct for a live stream since the
 * server writes frames in commit order.
 */
export function mergeEvents(
  existing: readonly FoundryEvent[],
  incoming: readonly FoundryEvent[],
  authoritativeOrder?: readonly string[],
): FoundryEvent[] {
  const byId = new Map<string, FoundryEvent>();
  for (const event of existing) {
    if (!byId.has(event.id)) byId.set(event.id, event);
  }
  for (const event of incoming) {
    if (!byId.has(event.id)) byId.set(event.id, event);
  }

  if (!authoritativeOrder) {
    return [...byId.values()];
  }

  const rank = new Map(authoritativeOrder.map((id, index) => [id, index]));
  return [...byId.values()].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    // Anything the authoritative order doesn't mention is newer than
    // everything it does (it arrived live, after the snapshot was taken),
    // and keeps its relative arrival order.
    if (ra === undefined && rb === undefined) return 0;
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return ra - rb;
  });
}

/** The id to resume a stream from — the last event the client has durably applied, or null for a full resync. */
export function resumeCursor(events: readonly FoundryEvent[]): string | null {
  return events.length > 0 ? (events[events.length - 1]?.id ?? null) : null;
}
