import type { MonetaryOutcome, MonetaryRecord } from "@foundry/contracts";
import type { SequencedEvent } from "../persistenceService";

/**
 * Monetary projection (Package 1b-ii scope item 5).
 *
 * Reads only what the ledger actually recorded. Foundry has spent money
 * exactly once — the `AC-111` real run, at $0.0790585 — and has never
 * received any. Both facts are projected as they are: the spend appears under
 * `spent`, and `received` is an empty list.
 *
 * **No sample revenue is written anywhere** (operator Amendment 3). An empty
 * revenue section is a true statement about a business that has not yet
 * earned anything; a populated one would be a false statement that happens to
 * make a dashboard look finished.
 */

const TERMINAL_RUN_EVENTS = new Set(["agentrun.completed", "agentrun.failed", "agentrun.timed_out"]);

export function emptyMonetaryOutcome(currency = "USD"): MonetaryOutcome {
  return {
    currency,
    byStatus: {
      projected: [],
      quoted: [],
      invoiced: [],
      received: [],
      spent: [],
      refunded: [],
    },
  };
}

/**
 * Projects monetary records from the persisted log.
 *
 * Only `spent` is populated, because only spend has a real emitter. The other
 * five statuses are represented by the schema and read model — a future
 * package that genuinely receives money adds its own event and emitter, and
 * its amounts appear here without this function changing shape.
 */
export function projectMonetaryOutcome(
  sequenced: readonly SequencedEvent[],
  currency = "USD",
): MonetaryOutcome {
  const outcome = emptyMonetaryOutcome(currency);

  for (const { sequence, event } of sequenced) {
    if (!TERMINAL_RUN_EVENTS.has(event.type)) continue;
    const payload = event.payload as Record<string, unknown>;
    const budget = payload.budget;
    if (!budget || typeof budget !== "object") continue;
    const actual = (budget as Record<string, unknown>).actualCostUsd;
    // Unknown cost stays unknown. Recording it as 0 would state that the run
    // was free, which is a different claim from "we did not capture it".
    if (typeof actual !== "number") continue;

    const record: MonetaryRecord = {
      recordId: `spend:${event.id}`,
      status: "spent",
      currency,
      amount: actual,
      evidence: [{ eventId: event.id, eventType: event.type, sequence }],
      recordedAt: event.occurredAt,
      responsibleEntityType: event.entityType,
      responsibleEntityId: event.entityId,
      note: "Actual cost recorded by a terminal AgentRun event.",
    };
    outcome.byStatus.spent.push(record);
  }

  return outcome;
}
