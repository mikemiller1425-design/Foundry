import { z } from "zod";
import { TimestampSchema } from "../common";

/**
 * Source coverage as **four orthogonal dimensions** (Ruling C-3.1, § 7.2 of
 * the 2026-08-05 decision record).
 *
 * The earlier six-state list and Package 2's five-term list shared a defect:
 * both collapsed four independent facts into one field. That is what allowed
 * an unavailable source to render as a clean result — "unavailable" and
 * "checked, found nothing" occupied the same slot, so a rendering could not
 * tell them apart and neither could a reader.
 *
 * Here they cannot collapse, because no single field encodes two of them.
 */

// --- A. Source connection -------------------------------------------------

export const SourceConnectionSchema = z.enum([
  "connected",
  "unavailable",
  "not_connected",
  "excluded",
]);
export type SourceConnection = z.infer<typeof SourceConnectionSchema>;

// --- B. Interval progress -------------------------------------------------

/**
 * `checked` means the declared source and declared interval were processed
 * according to the recorded scope. **It never means the source holds all
 * truth, or that nothing was missed.**
 */
export const IntervalProgressSchema = z.enum([
  "not_yet_checked",
  "checking",
  "partially_checked",
  "checked",
]);
export type IntervalProgress = z.infer<typeof IntervalProgressSchema>;

// --- C. Item disposition --------------------------------------------------

/** Preserves the Package 1a scan vocabulary, joined by `unsupported`. */
export const ItemDispositionSchema = z.enum([
  "scanned",
  "skipped",
  "refused",
  "inaccessible",
  "unsupported",
  "not_yet_scanned",
]);
export type ItemDisposition = z.infer<typeof ItemDispositionSchema>;

// --- D. Uncertainty -------------------------------------------------------

/**
 * A separate quality flag, not a replacement for connection or progress: a
 * `checked` source can still yield uncertain results, so uncertainty composes
 * with any combination of the other three rather than displacing one.
 */
export const UncertaintySchema = z.discriminatedUnion("result_uncertain", [
  z.object({ result_uncertain: z.literal(false) }),
  z.object({
    result_uncertain: z.literal(true),
    // Required when true: an unexplained "uncertain" is not actionable and
    // cannot be audited.
    uncertainty_reason: z.string().min(1),
  }),
]);
export type Uncertainty = z.infer<typeof UncertaintySchema>;

// --- Composed coverage ----------------------------------------------------

export const ItemDispositionCountsSchema = z.object({
  scanned: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  refused: z.number().int().nonnegative(),
  inaccessible: z.number().int().nonnegative(),
  unsupported: z.number().int().nonnegative(),
  not_yet_scanned: z.number().int().nonnegative(),
});
export type ItemDispositionCounts = z.infer<typeof ItemDispositionCountsSchema>;

/**
 * Coverage for exactly one named source over exactly one declared interval.
 *
 * There is no whole-system coverage type, at any scope. That absence is the
 * mechanism: a global "nothing was missed" claim has nowhere to live, so it
 * is unrepresentable rather than merely discouraged.
 *
 * `excluded` requires a reason for the same reason `result_uncertain` does —
 * an exclusion without a stated cause is indistinguishable from an omission.
 */
export const SourceCoverageSchema = z
  .object({
    sourceId: z.string().min(1),
    sourceLabel: z.string().min(1),
    /** What this source was asked for. Coverage always names its scope. */
    declaredScope: z.string().min(1),
    /** The interval, always stated. See briefing.ts for the sequence form. */
    declaredInterval: z.string().min(1),

    connection: SourceConnectionSchema,
    progress: IntervalProgressSchema,
    uncertainty: UncertaintySchema,
    counts: ItemDispositionCountsSchema,

    /** Required when `connection === "excluded"`. */
    exclusionReason: z.string().min(1).optional(),
    /**
     * Why a scan stopped, when it did. `coverage_complete` may never be
     * derived from counters alone — Package 1a's own tests caught a scan
     * cancelled before examining anything that still reported complete
     * coverage, because the counters happened to agree.
     */
    stopReason: z.string().min(1).optional(),
    observedAt: TimestampSchema,
  })
  .superRefine((value, ctx) => {
    if (value.connection === "excluded" && !value.exclusionReason) {
      ctx.addIssue({
        code: "custom",
        path: ["exclusionReason"],
        message: "an excluded source must record why it was excluded",
      });
    }
    if (value.connection !== "connected" && value.progress === "checked") {
      ctx.addIssue({
        code: "custom",
        path: ["progress"],
        message:
          "unavailable, not_connected, and excluded sources can never be 'checked' — they were not read",
      });
    }
  });
export type SourceCoverage = z.infer<typeof SourceCoverageSchema>;

/**
 * Whether coverage of one source may be called complete.
 *
 * Deliberately **not** a counter comparison. A scan that was cancelled,
 * refused, or stopped at a limit can leave counters that look finished; the
 * stop reason is what distinguishes "finished" from "stopped early", so it is
 * part of the computation rather than an annotation beside it.
 */
export function isSourceCoverageComplete(coverage: SourceCoverage): boolean {
  if (coverage.connection !== "connected") return false;
  if (coverage.progress !== "checked") return false;
  if (coverage.counts.not_yet_scanned > 0) return false;
  // A recorded stop reason means something ended the pass before it ran out
  // of work. Counters alone cannot see that.
  if (coverage.stopReason) return false;
  return true;
}

/** Plain frontend labels. The UI translates; it never invents a state. */
export const COVERAGE_LABELS = {
  connected: "Connected",
  unavailable: "Unavailable",
  not_connected: "Not connected",
  excluded: "Excluded",
  not_yet_checked: "Not checked yet",
  checking: "Checking",
  partially_checked: "Partially checked",
  checked: "Checked",
  result_uncertain: "Result uncertain",
} as const;
