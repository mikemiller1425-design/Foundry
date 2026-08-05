import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";

/**
 * Briefing interval and cursor (Decision C-7, § 9 of the 2026-08-05 record).
 *
 * Membership is defined by **persisted event sequence numbers, not wall-clock
 * timestamps**. Time is not a reliable membership key: clock skew, backfill,
 * and equal timestamps all make "which events were in that interval?"
 * answerable two ways, and a briefing whose population changes on re-render
 * is not a record of anything.
 *
 * The interval is half-open — `(previousAcknowledgedSequence,
 * capturedEndSequence]` — which guarantees **exactly-once** membership: no
 * event falls into two briefings, and none falls between them.
 */

export const BriefingIntervalSchema = z
  .object({
    /** Exclusive lower bound. The first briefing starts after sequence 0. */
    previousAcknowledgedSequence: z.number().int().nonnegative(),
    /**
     * Inclusive upper bound, **captured once** when the briefing record is
     * created. This is what makes a briefing a record rather than a live
     * query that changes its own answer each time it is opened.
     */
    capturedEndSequence: z.number().int().nonnegative(),
  })
  .superRefine((value, ctx) => {
    if (value.capturedEndSequence < value.previousAcknowledgedSequence) {
      ctx.addIssue({
        code: "custom",
        path: ["capturedEndSequence"],
        message: "capturedEndSequence may never precede previousAcknowledgedSequence",
      });
    }
  });
export type BriefingInterval = z.infer<typeof BriefingIntervalSchema>;

/** True when `sequence` belongs to the interval. Start exclusive, end inclusive. */
export function intervalContains(interval: BriefingInterval, sequence: number): boolean {
  return (
    sequence > interval.previousAcknowledgedSequence && sequence <= interval.capturedEndSequence
  );
}

/**
 * An empty interval is valid and explicit — not an error, and not a gap.
 * It is what "nothing happened since you last acknowledged" looks like.
 */
export function isEmptyInterval(interval: BriefingInterval): boolean {
  return interval.capturedEndSequence === interval.previousAcknowledgedSequence;
}

export const BriefingAcknowledgementSchema = z.object({
  acknowledgedAt: TimestampSchema,
  /** The authenticated operator. Acknowledgement is never anonymous. */
  acknowledgedBy: IdSchema,
});
export type BriefingAcknowledgement = z.infer<typeof BriefingAcknowledgementSchema>;

/**
 * The persisted briefing record.
 *
 * Both bounds are stored, never recomputed at read time. Rendering,
 * reopening, refreshing, or regenerating reads these two numbers; none of
 * those operations may change them, and none may advance the cursor.
 */
export const BriefingRecordSchema = z.object({
  briefingId: IdSchema,
  interval: BriefingIntervalSchema,
  createdAt: TimestampSchema,
  /** Null until an authenticated operator acknowledges having reviewed it. */
  acknowledgement: BriefingAcknowledgementSchema.nullable(),
  /**
   * Source-coverage references for this briefing. Ids only — the coverage
   * records themselves are projected, so a briefing cannot freeze a stale
   * copy of a source's state and present it as current.
   */
  sourceCoverageIds: z.array(z.string().min(1)),
  /** The classifier version used for external-action counts in this interval. */
  externalActionClassifierVersion: z.number().int().positive(),
});
export type BriefingRecord = z.infer<typeof BriefingRecordSchema>;

/**
 * Whether an acknowledgement may advance the cursor to this briefing's end.
 *
 * Cursor advancement is append-only: it may not move backward, and it may not
 * skip past the acknowledged briefing's captured end. Both would silently
 * discard events the operator never saw — the same failure as letting a mere
 * *view* advance the cursor.
 */
export function mayAdvanceCursor(currentCursor: number, briefing: BriefingRecord): boolean {
  if (briefing.interval.previousAcknowledgedSequence !== currentCursor) return false;
  return briefing.interval.capturedEndSequence >= currentCursor;
}
