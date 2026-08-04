import { IdSchema } from "@foundry/contracts";
import { z } from "zod";
import { DemoCommandSchema, DemoCommandTypeSchema } from "../commands";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "Operator"
export const OperatorObjectiveSubmittedEvent = defineEvent(
  "operator.objective_submitted",
  z.object({
    objective: z.string().min(1),
    projectId: IdSchema.optional(),
  }),
);

export const OperatorCommandSubmittedEvent = defineEvent(
  "operator.command_submitted",
  DemoCommandSchema,
);

export const OperatorCommandAcceptedEvent = defineEvent(
  "operator.command_accepted",
  z.object({
    commandType: DemoCommandTypeSchema,
    params: z.unknown(),
    resultRef: z.string().optional(),
  }),
);

export const OperatorCommandRejectedEvent = defineEvent(
  "operator.command_rejected",
  z.object({
    // Free-form, not DemoCommandTypeSchema: a command is often rejected
    // precisely because its commandType is not one of the approved values,
    // so this field must still be able to name whatever was submitted.
    commandType: z.string(),
    reason: z.string().min(1),
    correctiveAction: z.string().optional(),
  }),
);

export const OPERATOR_EVENTS = [
  OperatorObjectiveSubmittedEvent,
  OperatorCommandSubmittedEvent,
  OperatorCommandAcceptedEvent,
  OperatorCommandRejectedEvent,
] as const;

/**
 * The V1.1 operator-decision event family (AC-107).
 *
 * The Post-V1 audit §17 recorded that "no event exists for plan review,
 * execution authorization, or an operator's decision to proceed after
 * seeing a plan", and that the V1.1 outcome requires at least one new
 * operator event family. These are it. Plan *production* needs nothing
 * new — `build.planned` already covers it; what was missing is the record
 * of a **human deciding**.
 *
 * **Declared here, deliberately NOT in `OPERATOR_EVENTS`.**
 *
 * `OPERATOR_EVENTS` feeds `ALL_EVENT_SCHEMAS`, which feeds
 * `FoundryEventSchema` and `EVENT_TYPES` — and `EVENT_TYPES` is asserted
 * against the mock runtime's event→world projection map, which must cover
 * every member. Joining the union now would therefore force changes to the
 * mock runtime, whose canonical fixture is the V1 regression baseline and
 * which this mission may not modify.
 *
 * More simply: nothing produces these yet. An event type in the runtime
 * vocabulary that no code can emit and no reducer handles is a claim the
 * system does not honour. They join the union at the rung that produces
 * them — `AC-108` for plan review, `AC-110` for execution authorization —
 * together with their reducer disposition and projection-map entries. The
 * corresponding `event-model.md` amendment records exactly that.
 */

export const OperatorPlanReviewedEvent = defineEvent(
  "operator.plan_reviewed",
  z.object({
    planId: IdSchema,
    buildId: IdSchema,
    /** The reviewed plan's content fingerprint (`fingerprintPlan`). */
    planFingerprint: z.string().min(1),
    /** What the operator decided after reading it. Reviewing is not authorizing. */
    decision: z.enum(["proceed", "rejected", "revision_requested"]),
    reviewedBy: IdSchema,
    note: z.string().optional(),
  }),
);

export const OperatorExecutionAuthorizedEvent = defineEvent(
  "operator.execution_authorized",
  z.object({
    authorizationId: IdSchema,
    planId: IdSchema,
    buildId: IdSchema,
    /**
     * The plan revision the operator reviewed — a change indicator.
     * The authoritative execution binding is the backend-generated
     * SHA-256 over canonical persisted plan content, required at AC-110.
     */
    planRevision: z.string().min(1),
    /**
     * Backend-generated SHA-256 of canonical persisted plan content
     * (AC-107 operator-review correction 2). Optional in the declared
     * shape only because no producer exists yet; AC-110 must require it,
     * compute it server-side, and compare it server-side.
     */
    planContentHash: z.string().min(1).optional(),
    /** Exactly one stage — an authorization is never build-wide. */
    stageName: z.string().min(1),
    riskClass: z.string().min(1),
    workspace: z.string().min(1),
    /** Required — every issued authorization is budgeted. */
    maxBudgetUsd: z.number().positive(),
    authorizedBy: IdSchema,
  }),
);

/**
 * Declared but not yet in the runtime vocabulary. Exported so the shapes
 * are typed and testable now; `AC-108`/`AC-110` move them into
 * `OPERATOR_EVENTS`.
 */
export const V1_1_OPERATOR_DECISION_EVENTS = [
  OperatorPlanReviewedEvent,
  OperatorExecutionAuthorizedEvent,
] as const;
