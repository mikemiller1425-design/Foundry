import type { FoundryEvent } from "@foundry/event-types";

export type EvidenceReferenceState = "recorded" | "reference-only";

export interface EvidenceReference {
  id: string;
  state: EvidenceReferenceState;
  referenceCount: number;
  latestEventId: string;
  latestEventType: string;
  latestOccurredAt: string;
}

export interface OperationalSnapshot {
  buildStatus: string;
  completedStages: number;
  evidenceReferences: number;
  exceptionEvents: number;
  latestEvent: FoundryEvent | null;
}

const EXCEPTION_TYPES = new Set([
  "agent.failed",
  "agentrun.failed",
  "agentrun.timed_out",
  "build.failed",
  "requirement.failed",
  "stage.blocked",
  "stage.failed",
  "stage.validation_failed",
  "transfer.blocked",
  "transfer.failed",
  "upgrade.failed",
]);

const NON_OPERATIONAL_TYPES = new Set([
  "building.selected",
  "operator.command_submitted",
  "operator.command_accepted",
  "operator.command_rejected",
]);

function evidenceIdsForEvent(event: FoundryEvent): string[] {
  if (event.type === "agentrun.evidence_recorded") return [event.payload.evidenceId];
  const payload = event.payload as Record<string, unknown>;
  const evidenceIds = payload.evidenceIds;
  return Array.isArray(evidenceIds)
    ? evidenceIds.filter((value): value is string => typeof value === "string")
    : [];
}

export function selectEvidenceReferences(events: readonly FoundryEvent[]): EvidenceReference[] {
  const recorded = new Set(
    events
      .filter((event) => event.type === "agentrun.evidence_recorded")
      .map((event) =>
        event.type === "agentrun.evidence_recorded" ? event.payload.evidenceId : "",
      ),
  );
  const byId = new Map<string, EvidenceReference>();

  for (const event of events) {
    for (const id of evidenceIdsForEvent(event)) {
      const previous = byId.get(id);
      byId.set(id, {
        id,
        state: recorded.has(id) ? "recorded" : "reference-only",
        referenceCount: (previous?.referenceCount ?? 0) + 1,
        latestEventId: event.id,
        latestEventType: event.type,
        latestOccurredAt: event.occurredAt,
      });
    }
  }

  return [...byId.values()].sort((a, b) => b.latestOccurredAt.localeCompare(a.latestOccurredAt));
}

function buildStatusFromEvents(events: readonly FoundryEvent[]): string {
  let status = "none";
  for (const event of events) {
    switch (event.type) {
      case "build.created":
        status = "planned";
        break;
      case "build.ready":
        status = "ready";
        break;
      case "build.started":
      case "build.resumed":
        status = "running";
        break;
      case "build.paused":
        status = "paused";
        break;
      case "build.completed":
        status = "completed";
        break;
      case "build.failed":
        status = "failed";
        break;
      case "build.cancelled":
        status = "cancelled";
        break;
      default:
        break;
    }
  }
  return status;
}

export function deriveOperationalSnapshot(events: readonly FoundryEvent[]): OperationalSnapshot {
  const operationalEvents = events.filter((event) => !NON_OPERATIONAL_TYPES.has(event.type));
  const completedStageIds = new Set(
    operationalEvents
      .filter((event) => event.type === "stage.completed")
      .map((event) => event.entityId),
  );
  return {
    buildStatus: buildStatusFromEvents(operationalEvents),
    completedStages: completedStageIds.size,
    evidenceReferences: selectEvidenceReferences(operationalEvents).length,
    exceptionEvents: operationalEvents.filter((event) => EXCEPTION_TYPES.has(event.type)).length,
    latestEvent: operationalEvents.at(-1) ?? null,
  };
}

export function deriveOperationalComparison(events: readonly FoundryEvent[]): {
  current: OperationalSnapshot;
  previous: OperationalSnapshot;
} {
  const operationalEvents = events.filter((event) => !NON_OPERATIONAL_TYPES.has(event.type));
  return {
    current: deriveOperationalSnapshot(operationalEvents),
    previous: deriveOperationalSnapshot(operationalEvents.slice(0, -1)),
  };
}
