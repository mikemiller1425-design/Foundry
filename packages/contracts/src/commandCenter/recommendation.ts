import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";
import { EvidenceRefSchema } from "./attested";

/**
 * Recommended priorities (Package 1b-ii scope item 8).
 *
 * Recommendations are **advisory backend projections, not instructions and
 * not authority**. A recommendation cannot launch a mission, authorize an
 * action, change priority truth, spend, publish, or communicate — it is a
 * sentence about what the operator might want to look at, carrying the
 * evidence that produced it.
 *
 * That constraint is structural here: the type contains no command, no
 * handler reference, and no execution path. There is nothing on a
 * `Recommendation` to invoke.
 */

export const RecommendationConfidenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("deterministic") }),
  z.object({
    kind: z.literal("scored"),
    score: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal("uncertain"),
    uncertaintyReason: z.string().min(1),
  }),
]);
export type RecommendationConfidence = z.infer<typeof RecommendationConfidenceSchema>;

export const RecommendationSchema = z.object({
  recommendationId: IdSchema,
  /** Why this is being suggested, in the operator's terms. */
  reason: z.string().min(1),
  /** The events and entities the reason rests on. Never empty. */
  evidence: z.array(EvidenceRefSchema).min(1),
  supportingEntities: z.array(
    z.object({ entityType: z.string().min(1), entityId: IdSchema }),
  ),
  generatedAt: TimestampSchema,
  /**
   * Which producer generated it. 1b-ii ships deterministic rules only; a
   * model-generated prioritizer is explicitly not authorized, and this field
   * is what would make such a change visible rather than silent.
   */
  ruleVersion: z.string().min(1),
  confidence: RecommendationConfidenceSchema,
  /** Plain-language next step. Advisory text, never a command payload. */
  suggestedNextAction: z.string().min(1),
  /**
   * Whether acting on this would require operator approval. Stated up front
   * so the operator learns the cost of the suggestion before following it.
   */
  wouldRequireOperatorApproval: z.boolean(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

/** The deterministic rule set shipped by 1b-ii. Versioned, so drift is visible. */
export const DETERMINISTIC_RULE_VERSION = "1b-ii.deterministic.1";
