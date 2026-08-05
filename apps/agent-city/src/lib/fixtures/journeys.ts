import type { FoundryEvent } from "@foundry/event-types";

export type FixtureJourneyId =
  | "orientation"
  | "work-underway"
  | "transfer-in-motion"
  | "validation-exception"
  | "approval-gate"
  | "completed-run";

interface EventCheckpoint {
  kind: "event";
  eventType: string;
  occurrence?: number;
}

type BoundaryCheckpoint = { kind: "start" } | { kind: "end" };

export interface FixtureJourney {
  id: FixtureJourneyId;
  label: string;
  description: string;
  checkpoint: EventCheckpoint | BoundaryCheckpoint;
}

/**
 * Curated views into the canonical deterministic run. These are presentation
 * checkpoints, not new domain events or alternate operational truth. Every
 * non-boundary checkpoint resolves from an existing canonical event type.
 */
export const FIXTURE_JOURNEYS: readonly FixtureJourney[] = [
  {
    id: "orientation",
    label: "Quiet district",
    description: "Orient in the district before work begins.",
    checkpoint: { kind: "start" },
  },
  {
    id: "work-underway",
    label: "Work underway",
    description: "Follow an agent after canonical work has started.",
    checkpoint: { kind: "event", eventType: "agent.started_work" },
  },
  {
    id: "transfer-in-motion",
    label: "Transfer in motion",
    description: "Inspect the world immediately after a canonical agent departure.",
    checkpoint: { kind: "event", eventType: "agent.departed" },
  },
  {
    id: "validation-exception",
    label: "Validation exception",
    description: "Review a declared mandatory requirement failure before recovery.",
    checkpoint: { kind: "event", eventType: "requirement.failed" },
  },
  {
    id: "approval-gate",
    label: "Approval gate",
    description: "Observe the run paused at its declared operator approval request.",
    checkpoint: { kind: "event", eventType: "approval.requested" },
  },
  {
    id: "completed-run",
    label: "Completed run",
    description: "Explore the final canonical projection after every scripted event.",
    checkpoint: { kind: "end" },
  },
] as const;

/** Resolves a semantic checkpoint to an inclusive playback cursor. */
export function resolveFixtureJourneyCursor(
  journey: FixtureJourney,
  events: readonly FoundryEvent[],
): number {
  const checkpoint = journey.checkpoint;
  if (checkpoint.kind === "start") return 0;
  if (checkpoint.kind === "end") return events.length;

  const wantedOccurrence = checkpoint.occurrence ?? 1;
  let seen = 0;
  const index = events.findIndex((event) => {
    if (event.type !== checkpoint.eventType) return false;
    seen += 1;
    return seen === wantedOccurrence;
  });

  if (index < 0) {
    throw new Error(
      `Fixture journey "${journey.id}" cannot resolve ${checkpoint.eventType} occurrence ${wantedOccurrence}`,
    );
  }
  return index + 1;
}

export function fixtureJourneyById(id: FixtureJourneyId): FixtureJourney {
  const journey = FIXTURE_JOURNEYS.find((candidate) => candidate.id === id);
  if (!journey) throw new Error(`Unknown fixture journey: ${id}`);
  return journey;
}
