import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";
import { EvidenceRefSchema } from "./attested";

/**
 * External-action qualification (Decision C-6, § 9 of the 2026-08-05 record).
 *
 * An external action is an attempted or completed **side effect outside
 * Foundry's local operational state**. The distinguishing rule is the side
 * effect, not risk or importance — which is why `operator.execution_authorized`
 * does not qualify however consequential it feels. Authorizing a run changes
 * only Foundry's own records; it is the run that reaches outside.
 *
 * Classification is a **registry, not a judgement**: an event type either has
 * an entry with satisfied payload predicates or it does not. That keeps the
 * answer stable across readers and versions, and it makes "what counts?"
 * answerable by reading a table instead of re-deriving an argument.
 */

export const EXTERNAL_ACTION_CLASSIFIER_VERSION = 1;

export const ExternalActionCategorySchema = z.enum([
  "model_or_remote_agent_invocation",
  "email_or_external_message",
  "job_or_application_submission",
  "public_publication",
  "external_api_mutation",
  "production_system_mutation",
  "agreement_or_signature",
  "payment_or_spend",
  "other_external_change",
]);
export type ExternalActionCategory = z.infer<typeof ExternalActionCategorySchema>;

/** Where an action sits in its own lifecycle. Phases are not separate actions. */
export const ExternalActionPhaseSchema = z.enum([
  "attempted",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export type ExternalActionPhase = z.infer<typeof ExternalActionPhaseSchema>;

/**
 * One registry entry.
 *
 * `payloadPredicate` exists because qualification is not always a property of
 * the event *type*. `agentrun.started` is an external action when its
 * `runtimeType` is `claude_code` and is not when it is `mock` — the mock
 * runtime reaches nothing outside Foundry.
 */
export interface ExternalActionRegistryEntry {
  eventType: string;
  category: ExternalActionCategory;
  phase: ExternalActionPhase;
  /** Narrows qualification within an event type. Absent means "always". */
  payloadPredicate?: (payload: Record<string, unknown>) => boolean;
  /**
   * Groups lifecycle events of one action. Two events returning the same key
   * are the same action in different phases, never two actions.
   */
  actionKey: (event: {
    entityType: string;
    entityId: string;
    correlationId: string;
    payload: Record<string, unknown>;
  }) => string;
  /** The package and rung that implements the emitter for this event type. */
  owningRung: string;
}

export const ExternalActionSchema = z.object({
  actionKey: z.string().min(1),
  category: ExternalActionCategorySchema,
  /** Latest phase reached, resolved across every lifecycle event. */
  phase: ExternalActionPhaseSchema,
  firstObservedAt: TimestampSchema,
  lastObservedAt: TimestampSchema,
  /** Cost when recorded. Null means unknown — never silently zero. */
  costUsd: z.number().nonnegative().nullable(),
  evidence: z.array(EvidenceRefSchema).min(1),
  /** Every event id folded into this one action, for level-3 descent. */
  lifecycleEventIds: z.array(IdSchema).min(1),
});
export type ExternalAction = z.infer<typeof ExternalActionSchema>;

export const ExternalActionProjectionSchema = z.object({
  classifierVersion: z.number().int().positive(),
  /** The interval this projection covers, in C-7 sequence form. */
  fromSequenceExclusive: z.number().int().nonnegative(),
  toSequenceInclusive: z.number().int().nonnegative(),
  actions: z.array(ExternalActionSchema),
  counts: z.object({
    attempted: z.number().int().nonnegative(),
    running: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
  }),
});
export type ExternalActionProjection = z.infer<typeof ExternalActionProjectionSchema>;

/**
 * The exact wording required for a negative result (Decision C-6).
 *
 * Scoped to Foundry's own ledger on purpose. Foundry cannot observe actions
 * taken outside its instrumentation, so it may not speak about them — and a
 * briefing that said "no external actions occurred" would be claiming
 * knowledge of the world rather than of its own records.
 */
export const NO_QUALIFYING_EXTERNAL_ACTIONS_STATEMENT =
  "No qualifying external actions were recorded in Foundry's operational ledger for this briefing interval.";

/**
 * Derives the negative statement, or null when actions exist.
 *
 * This is a **read over an interval**, never a stored event. A synthesized
 * `external_action.none` would manufacture evidence for a non-occurrence —
 * the same defect class as `AC-111`'s dangling `evidenceIds`, where a
 * reference to evidence that did not exist read like an audit trail.
 */
export function deriveNoExternalActionsStatement(
  projection: ExternalActionProjection,
): string | null {
  return projection.actions.length === 0 ? NO_QUALIFYING_EXTERNAL_ACTIONS_STATEMENT : null;
}
