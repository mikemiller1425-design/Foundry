import { z } from "zod";
import { IdSchema } from "../common";

/**
 * Evidence-bearing absence and evidence-bearing presence (Package 1b-ii,
 * operator Amendment 2).
 *
 * Every Command Center figure is either backed by a persisted event or
 * explicitly marked as never having been recorded. There is no third
 * option, and in particular there is no default: a mission projected from
 * historical build events did not record an autonomy level, and inventing
 * `"supervise"` because the field is non-optional would be a fabricated
 * fact about how that run was governed.
 *
 * The shape enforces this rather than documenting it. `recorded` **requires
 * at least one `EvidenceRef`**, so a value cannot enter a projection without
 * naming the event it came from — which is also what makes acceptance proof
 * 24 (every level-2 figure reaches level-3 evidence) a type-level property
 * rather than a review checklist.
 */

export const EvidenceRefSchema = z.object({
  eventId: IdSchema,
  eventType: z.string().min(1),
  /** Log sequence, when the projection read it from a sequenced source. */
  sequence: z.number().int().positive().optional(),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

/**
 * Why a value is absent.
 *
 * `not_recorded` — the fact was never captured. Historical events predate
 * the field, so no evidence exists anywhere and none ever will.
 *
 * `not_available` — the fact exists but this projection cannot reach it,
 * for example a source that is not connected. Distinct because the two
 * imply different remedies: one is permanent, the other is an integration
 * that does not exist yet.
 */
export const AbsenceStateSchema = z.enum(["not_recorded", "not_available"]);
export type AbsenceState = z.infer<typeof AbsenceStateSchema>;

/** Builds `Attested<T>`: a recorded value with evidence, or a stated absence. */
export function attested<T extends z.ZodTypeAny>(value: T) {
  return z.discriminatedUnion("state", [
    z.object({
      state: z.literal("recorded"),
      value,
      // Minimum one: a recorded value with no evidence is an assertion.
      evidence: z.array(EvidenceRefSchema).min(1),
    }),
    z.object({
      state: AbsenceStateSchema,
      reason: z.string().min(1),
    }),
  ]);
}

export type Attested<T> =
  | { state: "recorded"; value: T; evidence: EvidenceRef[] }
  | { state: AbsenceState; reason: string };

/** Constructs a recorded value. Callers must supply the evidence. */
export function recorded<T>(value: T, evidence: EvidenceRef[]): Attested<T> {
  if (evidence.length === 0) {
    throw new Error("recorded() requires at least one EvidenceRef; use notRecorded() instead");
  }
  return { state: "recorded", value, evidence };
}

/** Constructs a stated absence. The reason is required and never defaulted. */
export function absent<T>(state: AbsenceState, reason: string): Attested<T> {
  return { state, reason };
}

/** True when the value is present. Narrows for callers reading `.value`. */
export function isRecorded<T>(
  a: Attested<T>,
): a is { state: "recorded"; value: T; evidence: EvidenceRef[] } {
  return a.state === "recorded";
}

/** Every evidence reference an attested value carries; empty when absent. */
export function evidenceOf<T>(a: Attested<T>): EvidenceRef[] {
  return isRecorded(a) ? a.evidence : [];
}
