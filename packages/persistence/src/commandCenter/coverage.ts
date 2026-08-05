import type { BriefingInterval, SourceCoverage } from "@foundry/contracts";
import type { SequencedEvent } from "../persistenceService";

/**
 * Source coverage projection (Package 1b-ii scope item 6).
 *
 * Foundry has exactly one connected source: its own operational ledger.
 * Everything else the Command Center is eventually meant to cover — email,
 * calendar, bills, commitments, the NAS — has no adapter, no contract, and no
 * recorded data, so each is projected as `not_connected` **by name**.
 *
 * Naming them is the point. Omitting an unintegrated source would let the
 * briefing read as complete coverage of a smaller world; listing it as
 * `not_connected` says plainly that Foundry is not looking there.
 *
 * **No NAS scan events are emitted and no Package 2 coverage is pretended.**
 * The NAS row below reports `not_connected` because no NAS path has ever been
 * read, which is exactly what the realignment record says.
 */

function noUncertainty() {
  return { result_uncertain: false as const };
}

function zeroCounts() {
  return {
    scanned: 0,
    skipped: 0,
    refused: 0,
    inaccessible: 0,
    unsupported: 0,
    not_yet_scanned: 0,
  };
}

function intervalLabel(interval: BriefingInterval): string {
  return `(${interval.previousAcknowledgedSequence}, ${interval.capturedEndSequence}] by event sequence`;
}

/** Sources the Command Center is meant to cover but which have no integration. */
export const UNINTEGRATED_SOURCES: readonly { id: string; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "calendar", label: "Calendar" },
  { id: "bills", label: "Bills" },
  { id: "commitments", label: "Commitments" },
  { id: "nas", label: "NAS archive" },
];

/**
 * Projects coverage for the interval.
 *
 * The Foundry ledger is the only source that can reach `checked`, and it does
 * so only because the projection genuinely read every event in the interval.
 * The `stopReason` field is left unset for exactly that reason — a pass that
 * ended early would set it, and `isSourceCoverageComplete` consults it rather
 * than trusting the counters to imply completion.
 */
export function projectSourceCoverage(
  sequenced: readonly SequencedEvent[],
  interval: BriefingInterval,
  observedAt: string,
): SourceCoverage[] {
  const inInterval = sequenced.filter(
    (entry) =>
      entry.sequence > interval.previousAcknowledgedSequence &&
      entry.sequence <= interval.capturedEndSequence,
  );

  const ledger: SourceCoverage = {
    sourceId: "foundry_operational_ledger",
    sourceLabel: "Foundry operational ledger",
    declaredScope: "All persisted Foundry events in the interval",
    declaredInterval: intervalLabel(interval),
    connection: "connected",
    progress: "checked",
    uncertainty: noUncertainty(),
    counts: { ...zeroCounts(), scanned: inInterval.length },
    observedAt,
  };

  const unintegrated: SourceCoverage[] = UNINTEGRATED_SOURCES.map((source) => ({
    sourceId: source.id,
    sourceLabel: source.label,
    declaredScope: "Not integrated — no adapter, contract, or recorded data exists",
    declaredInterval: intervalLabel(interval),
    connection: "not_connected" as const,
    // A source that was never read cannot be `checked`. The schema refuses
    // that combination outright, so this is enforced rather than remembered.
    progress: "not_yet_checked" as const,
    uncertainty: noUncertainty(),
    counts: zeroCounts(),
    observedAt,
  }));

  return [ledger, ...unintegrated];
}
