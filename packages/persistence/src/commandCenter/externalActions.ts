import {
  EXTERNAL_ACTION_CLASSIFIER_VERSION,
  type EvidenceRef,
  type ExternalAction,
  type ExternalActionPhase,
  type ExternalActionProjection,
  type ExternalActionRegistryEntry,
} from "@foundry/contracts";
import type { SequencedEvent } from "../persistenceService";

/**
 * The external-action classifier registry (Decision C-6).
 *
 * **Every entry names an event type that a real emitter already produces.**
 * There is deliberately no entry for email, publication, application,
 * production mutation, agreement, or payment: those packages do not exist,
 * nothing emits their events, and pre-registering them would assert a
 * capability Foundry does not have. Each adds its own entry at its own rung,
 * beside its own emitter.
 *
 * That is why this is a registry and not a heuristic. "Is this an external
 * action?" is answered by looking a type up in a table, so two readers — and
 * two versions of the code — give the same answer for the same event.
 */
export const EXTERNAL_ACTION_REGISTRY: readonly ExternalActionRegistryEntry[] = [
  {
    eventType: "agentrun.started",
    category: "model_or_remote_agent_invocation",
    phase: "attempted",
    /**
     * Qualification is a property of the payload, not the type. A `mock`
     * runtime reaches nothing outside Foundry; `claude_code` invokes a real
     * model through a real process.
     */
    payloadPredicate: (payload) => payload.runtimeType === "claude_code",
    actionKey: (event) => `agentrun:${event.entityId}`,
    owningRung: "AC-110/AC-111 — execution authorization and the real run",
  },
  {
    eventType: "agentrun.completed",
    category: "model_or_remote_agent_invocation",
    phase: "succeeded",
    actionKey: (event) => `agentrun:${event.entityId}`,
    owningRung: "AC-110/AC-111",
  },
  {
    eventType: "agentrun.failed",
    category: "model_or_remote_agent_invocation",
    phase: "failed",
    actionKey: (event) => `agentrun:${event.entityId}`,
    owningRung: "AC-110/AC-111",
  },
  {
    eventType: "agentrun.timed_out",
    category: "model_or_remote_agent_invocation",
    phase: "failed",
    actionKey: (event) => `agentrun:${event.entityId}`,
    owningRung: "AC-110/AC-111",
  },
];

/**
 * Event types that look consequential but are **not** external actions.
 *
 * Kept as an explicit list rather than left implicit, because "we simply
 * didn't add it" and "we decided it doesn't qualify" are different states and
 * only one of them survives review. Authorizing a run is the clearest case:
 * it is the most consequential thing an operator does, and it changes nothing
 * outside Foundry.
 */
export const EXPLICITLY_NOT_EXTERNAL_ACTIONS: readonly string[] = [
  "operator.execution_authorized",
  "approval.requested",
  "approval.approved",
  "approval.rejected",
  "approval.revision_requested",
  "operator.objective_submitted",
  "build.planned",
  "building.selected",
  "agentrun.evidence_recorded",
];

const PHASE_RANK: Record<ExternalActionPhase, number> = {
  attempted: 0,
  running: 1,
  succeeded: 2,
  failed: 2,
  cancelled: 2,
};

function entryFor(eventType: string, payload: Record<string, unknown>) {
  return EXTERNAL_ACTION_REGISTRY.find(
    (candidate) =>
      candidate.eventType === eventType &&
      (candidate.payloadPredicate ? candidate.payloadPredicate(payload) : true),
  );
}

/** True when this event qualifies under the registry. */
export function isExternalActionEvent(eventType: string, payload: Record<string, unknown>): boolean {
  return entryFor(eventType, payload) !== undefined;
}

function readCostUsd(payload: Record<string, unknown>): number | null {
  const budget = payload.budget;
  if (!budget || typeof budget !== "object") return null;
  const actual = (budget as Record<string, unknown>).actualCostUsd;
  // `null` and `0` are opposite statements; only one of them is safe to
  // record, so an absent or non-numeric cost stays unknown.
  return typeof actual === "number" ? actual : null;
}

/**
 * Projects the classified external actions inside a C-7 interval.
 *
 * Lifecycle events are folded by `actionKey`, so a started/completed pair for
 * one run is **one action in its latest phase**, never two. That is the
 * difference between reporting "one model invocation" and reporting "two
 * external actions" for the single real run Foundry has ever performed.
 */
export function projectExternalActions(
  sequenced: readonly SequencedEvent[],
  fromSequenceExclusive: number,
  toSequenceInclusive: number,
): ExternalActionProjection {
  const byKey = new Map<string, ExternalAction>();

  for (const { sequence, event } of sequenced) {
    if (sequence <= fromSequenceExclusive) continue;
    if (sequence > toSequenceInclusive) continue;

    const payload = event.payload as Record<string, unknown>;
    const entry = entryFor(event.type, payload);
    if (!entry) continue;

    const key = entry.actionKey({
      entityType: event.entityType,
      entityId: event.entityId,
      correlationId: event.correlationId,
      payload,
    });
    const evidence: EvidenceRef = { eventId: event.id, eventType: event.type, sequence };
    const existing = byKey.get(key);
    const cost = readCostUsd(payload);

    if (!existing) {
      byKey.set(key, {
        actionKey: key,
        category: entry.category,
        phase: entry.phase,
        firstObservedAt: event.occurredAt,
        lastObservedAt: event.occurredAt,
        costUsd: cost,
        evidence: [evidence],
        lifecycleEventIds: [event.id],
      });
      continue;
    }

    existing.evidence.push(evidence);
    existing.lifecycleEventIds.push(event.id);
    existing.lastObservedAt = event.occurredAt;
    if (cost !== null) existing.costUsd = cost;
    if (PHASE_RANK[entry.phase] >= PHASE_RANK[existing.phase]) existing.phase = entry.phase;
  }

  const actions = [...byKey.values()];
  return {
    classifierVersion: EXTERNAL_ACTION_CLASSIFIER_VERSION,
    fromSequenceExclusive,
    toSequenceInclusive,
    actions,
    counts: {
      attempted: actions.filter((a) => a.phase === "attempted").length,
      running: actions.filter((a) => a.phase === "running").length,
      succeeded: actions.filter((a) => a.phase === "succeeded").length,
      failed: actions.filter((a) => a.phase === "failed").length,
      cancelled: actions.filter((a) => a.phase === "cancelled").length,
    },
  };
}
