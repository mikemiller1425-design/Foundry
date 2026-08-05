import type { BriefingRecord } from "@foundry/contracts";

/**
 * Briefing cursor derivation (Decision C-7).
 *
 * The cursor is not a stored counter that something increments. It is
 * **derived from the acknowledged briefings**, which makes it impossible for
 * it to drift away from the records it is supposed to summarise, and makes
 * "advance the cursor" and "record an acknowledgement" the same act rather
 * than two that could disagree.
 */

/**
 * The current cursor: the highest captured end among acknowledged briefings,
 * or 0 when none has been acknowledged.
 *
 * Monotonic by construction — taking a maximum cannot move backward, so the
 * append-only rule is a property of the derivation rather than a check
 * someone has to remember to write.
 */
export function deriveCursor(briefings: readonly BriefingRecord[]): number {
  return briefings.reduce(
    (cursor, briefing) =>
      briefing.acknowledgement ? Math.max(cursor, briefing.interval.capturedEndSequence) : cursor,
    0,
  );
}

/** The interval a new briefing would cover, given the current cursor and log head. */
export function nextBriefingInterval(
  briefings: readonly BriefingRecord[],
  latestSequence: number,
): { previousAcknowledgedSequence: number; capturedEndSequence: number } {
  const previousAcknowledgedSequence = deriveCursor(briefings);
  return {
    previousAcknowledgedSequence,
    // Captured once, here. Every later read of this briefing uses the stored
    // number; none recomputes it from a newer log head.
    capturedEndSequence: Math.max(previousAcknowledgedSequence, latestSequence),
  };
}

export type AcknowledgementRefusal =
  | "unknown_briefing"
  | "already_acknowledged"
  | "would_skip_events"
  | "would_move_backward";

/**
 * Whether an acknowledgement may be applied.
 *
 * `already_acknowledged` is a refusal rather than an error because that is
 * what makes duplicate and concurrent acknowledgement idempotent: the second
 * caller is told the cursor already reflects this briefing, and the cursor
 * moves exactly once.
 *
 * `would_skip_events` catches acknowledging a later briefing while an earlier
 * one is still open. Allowing it would advance the cursor past events the
 * operator never saw — the same silent discard that letting a *view* advance
 * the cursor would cause.
 */
export function checkAcknowledgement(
  briefing: BriefingRecord | undefined,
  currentCursor: number,
): { ok: true } | { ok: false; refusal: AcknowledgementRefusal } {
  if (!briefing) return { ok: false, refusal: "unknown_briefing" };
  if (briefing.acknowledgement) return { ok: false, refusal: "already_acknowledged" };
  if (briefing.interval.previousAcknowledgedSequence > currentCursor) {
    return { ok: false, refusal: "would_skip_events" };
  }
  if (briefing.interval.capturedEndSequence < currentCursor) {
    return { ok: false, refusal: "would_move_backward" };
  }
  return { ok: true };
}
