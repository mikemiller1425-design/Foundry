import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common";

/**
 * Intent-candidate foundation (Construction Package 1a).
 *
 * ## The problem this exists to prevent
 *
 * A future package will read the operator's exported conversations looking
 * for durable intent. Those transcripts contain two kinds of text that look
 * identical on the page: things **the operator said**, and things **an
 * assistant suggested**. Nothing about position, formatting, or confidence
 * distinguishes them once they are quoted out of context.
 *
 * If assistant text can become "operator intent" by sitting near it, the
 * Canonical Intent Registry stops being a record of what the operator
 * wants and becomes a record of what was proposed to them. Every
 * consequential decision downstream would then rest on suggestions the
 * operator never adopted.
 *
 * So authorship is a **required, closed field**, `unknown` is a real
 * option, and `assistant`-authored text is structurally barred from
 * canonical promotion. Proximity is not evidence.
 *
 * ## Nothing here is canonical
 *
 * A candidate is provisional by definition. Promotion to canonical intent
 * happens **only** through an explicit, authenticated operator command —
 * never by confidence score, never by age, never in bulk.
 *
 * ## Scope of Package 1a
 *
 * Schemas and the promotion guard. **No extraction runs**, no real
 * transcript is read, and no command or event joins the closed vocabulary
 * yet — that happens at `Package 3`, the rung that produces them. The
 * project's established discipline (`AC-107`) is that an event nothing can
 * emit and no reducer handles is a claim the system does not honour.
 */

// ---------------------------------------------------------------------------
// Authorship — the load-bearing distinction
// ---------------------------------------------------------------------------

/**
 * Who actually said it.
 *
 * `unknown` exists because a transcript sometimes genuinely does not say,
 * and guessing is the failure mode. An `unknown` candidate can be
 * reviewed and corrected by the operator; it cannot be promoted.
 */
export const IntentAuthorshipSchema = z.enum(["operator", "assistant", "unknown"]);
export type IntentAuthorship = z.infer<typeof IntentAuthorshipSchema>;

export const SpeakerAttributionSchema = z
  .object({
    /** Exactly as the source labels the speaker. Not normalised away. */
    rawSpeakerLabel: z.string().min(1),
    authorship: IntentAuthorshipSchema,
    /**
     * How authorship was determined. Recorded so a reviewer can judge the
     * determination rather than trusting it.
     */
    basis: z.enum([
      "explicit_source_role",
      "explicit_speaker_label",
      "operator_correction",
      "undetermined",
    ]),
  })
  .strict();
export type SpeakerAttribution = z.infer<typeof SpeakerAttributionSchema>;

// ---------------------------------------------------------------------------
// Source and excerpt
// ---------------------------------------------------------------------------

export const IntentSourceRefSchema = z
  .object({
    /** Stable id of the source document or conversation. */
    sourceId: z.string().min(1),
    sourceKind: z.enum(["conversation_export", "markdown", "operator_statement", "other"]),
    /** Where in the source. A candidate with no locator is not evidence. */
    locator: z.string().min(1),
    /** NAS asset id, when the source came from the catalog. */
    nasAssetId: z.string().min(1).optional(),
  })
  .strict();
export type IntentSourceRef = z.infer<typeof IntentSourceRefSchema>;

export const IntentExcerptRefSchema = z
  .object({
    /** The supporting text, verbatim. Never paraphrased into evidence. */
    text: z.string().min(1).max(2000),
    startOffset: z.number().int().nonnegative().optional(),
    endOffset: z.number().int().nonnegative().optional(),
  })
  .strict();
export type IntentExcerptRef = z.infer<typeof IntentExcerptRefSchema>;

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

/**
 * What a contradiction is *about*.
 *
 * The distinction matters because not every contradiction is equally
 * consequential. Two candidates disagreeing about a colour preference is
 * noise; two disagreeing about spending authority is a stop condition.
 * `CONSEQUENTIAL_CONTRADICTION_DOMAINS` names the second kind.
 */
export const ContradictionDomainSchema = z.enum([
  "priority",
  "authority",
  "spending",
  "publication",
  "consequential_action",
  "preference",
  "other",
]);
export type ContradictionDomain = z.infer<typeof ContradictionDomainSchema>;

/** Domains where an unresolved contradiction blocks canonical promotion. */
export const CONSEQUENTIAL_CONTRADICTION_DOMAINS: readonly ContradictionDomain[] = [
  "priority",
  "authority",
  "spending",
  "publication",
  "consequential_action",
] as const;

export const ContradictionLinkSchema = z
  .object({
    contradictsCandidateId: IdSchema,
    domain: ContradictionDomainSchema,
    /** Set only by an operator decision, never by the extractor. */
    resolved: z.boolean(),
    note: z.string().max(1000).optional(),
  })
  .strict();
export type ContradictionLink = z.infer<typeof ContradictionLinkSchema>;

export const DuplicateLinkSchema = z
  .object({
    duplicateOfCandidateId: IdSchema,
    /** Why they were judged the same. */
    basis: z.enum(["exact_text", "normalised_text", "operator_merge"]),
  })
  .strict();
export type DuplicateLink = z.infer<typeof DuplicateLinkSchema>;

// ---------------------------------------------------------------------------
// The candidate
// ---------------------------------------------------------------------------

export const IntentCandidateStatusSchema = z.enum([
  "unreviewed",
  "confirmed",
  "rejected",
  "merged",
  "superseded",
]);
export type IntentCandidateStatus = z.infer<typeof IntentCandidateStatusSchema>;

export const OperatorCorrectionSchema = z
  .object({
    correctedBy: IdSchema,
    correctedAt: TimestampSchema,
    /** What the operator actually meant. Replaces the extracted reading. */
    correctedStatement: z.string().min(1).max(2000),
    /** Optional authorship correction — the commonest kind. */
    correctedAuthorship: IntentAuthorshipSchema.optional(),
    note: z.string().max(1000).optional(),
  })
  .strict();
export type OperatorCorrection = z.infer<typeof OperatorCorrectionSchema>;

export const IntentCandidateSchema = z
  .object({
    candidateId: IdSchema,
    /** The extracted reading. Provisional until the operator confirms it. */
    statement: z.string().min(1).max(2000),
    source: IntentSourceRefSchema,
    excerpt: IntentExcerptRefSchema,
    speaker: SpeakerAttributionSchema,
    duplicates: z.array(DuplicateLinkSchema).default([]),
    contradictions: z.array(ContradictionLinkSchema).default([]),
    /** The extractor's confidence. **Never a promotion criterion.** */
    confidence: z.number().min(0).max(1),
    status: IntentCandidateStatusSchema,
    operatorCorrection: OperatorCorrectionSchema.nullable().default(null),
    extractedAt: TimestampSchema,
  })
  .strict();
export type IntentCandidate = z.infer<typeof IntentCandidateSchema>;

// ---------------------------------------------------------------------------
// The promotion guard
// ---------------------------------------------------------------------------

export type PromotionRefusalCode =
  | "not_confirmed_by_operator"
  | "authorship_not_operator"
  | "missing_explicit_operator_command"
  | "unresolved_consequential_contradiction"
  | "superseded_or_rejected"
  | "merged_into_another_candidate";

export interface PromotionRefusal {
  code: PromotionRefusalCode;
  reason: string;
}

export type PromotionDecision =
  | { permitted: true }
  | { permitted: false; refusals: PromotionRefusal[] };

/**
 * The explicit operator act required to promote a candidate.
 *
 * A **command**, not a flag: `authenticatedOperatorId` must come from a
 * verified credential at the call site, and `candidateId` must name the
 * one candidate being promoted. There is no "promote all confirmed"
 * shape here, deliberately — bulk promotion is how a registry fills with
 * things nobody read.
 */
export const CanonicalPromotionCommandSchema = z
  .object({
    candidateId: IdSchema,
    authenticatedOperatorId: IdSchema,
    /** The operator's own words for what is being adopted. */
    canonicalStatement: z.string().min(1).max(2000),
    issuedAt: TimestampSchema,
  })
  .strict();
export type CanonicalPromotionCommand = z.infer<typeof CanonicalPromotionCommandSchema>;

/**
 * Whether a candidate may become canonical intent.
 *
 * Pure, total, and **fail-closed**: it returns every reason it refuses,
 * and the only way to reach `permitted: true` is for all of them to pass.
 * There is no default-allow branch and no confidence threshold — a
 * candidate the extractor was 99% sure about is still just a candidate.
 */
export function evaluateCanonicalPromotion(
  candidate: IntentCandidate,
  command: CanonicalPromotionCommand | null,
): PromotionDecision {
  const refusals: PromotionRefusal[] = [];

  if (!command) {
    refusals.push({
      code: "missing_explicit_operator_command",
      reason:
        "Canonical promotion requires an explicit, authenticated operator command naming this candidate. Nothing becomes canonical by confidence, by age, or in bulk.",
    });
  } else if (command.candidateId !== candidate.candidateId) {
    refusals.push({
      code: "missing_explicit_operator_command",
      reason: `The promotion command names candidate ${command.candidateId}, not ${candidate.candidateId}. A command promotes exactly the candidate it names.`,
    });
  }

  if (candidate.status === "rejected" || candidate.status === "superseded") {
    refusals.push({
      code: "superseded_or_rejected",
      reason: `This candidate is ${candidate.status}; a decision already recorded about it is not re-decided by promoting it.`,
    });
  }
  if (candidate.status === "merged") {
    refusals.push({
      code: "merged_into_another_candidate",
      reason:
        "This candidate was merged into another. Promote the surviving candidate, so the registry holds one statement rather than two that drift.",
    });
  }
  if (candidate.status !== "confirmed") {
    refusals.push({
      code: "not_confirmed_by_operator",
      reason: `A candidate must be \`confirmed\` before it can be promoted; this one is \`${candidate.status}\`.`,
    });
  }

  /**
   * Authorship, after the operator's correction is applied.
   *
   * The correction is what makes this fair rather than merely strict: an
   * assistant-attributed line the operator says was theirs can be
   * corrected, explicitly, and then promoted. What cannot happen is
   * assistant text becoming operator intent because it appeared in the
   * same conversation.
   */
  const effectiveAuthorship =
    candidate.operatorCorrection?.correctedAuthorship ?? candidate.speaker.authorship;
  if (effectiveAuthorship !== "operator") {
    refusals.push({
      code: "authorship_not_operator",
      reason: `This text is attributed to \`${effectiveAuthorship}\` (raw label: "${candidate.speaker.rawSpeakerLabel}"). Assistant-authored and unattributed text cannot become operator intent — proximity in a conversation is not evidence of adoption. If the attribution is wrong, record an operator correction that says so.`,
    });
  }

  const blocking = candidate.contradictions.filter(
    (link) => !link.resolved && CONSEQUENTIAL_CONTRADICTION_DOMAINS.includes(link.domain),
  );
  for (const link of blocking) {
    refusals.push({
      code: "unresolved_consequential_contradiction",
      reason: `An unresolved contradiction in the \`${link.domain}\` domain with candidate ${link.contradictsCandidateId} blocks promotion. Contradictions about priority, authority, spending, publication, or consequential action stop execution rather than being averaged out.`,
    });
  }

  return refusals.length === 0 ? { permitted: true } : { permitted: false, refusals };
}
