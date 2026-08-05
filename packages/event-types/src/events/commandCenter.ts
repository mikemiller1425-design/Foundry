import { IdSchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

/**
 * Command Center events (Package 1b-ii).
 *
 * **Only three events join the vocabulary here, and each has a real emitter
 * implemented in this package** (operator Amendment 3). The other five
 * Command Center surfaces — mission, external actions, money, coverage,
 * recommendations — are *projections over events that already exist*, so they
 * add nothing: a schema that mentions revenue is not evidence that revenue
 * was received, and an event nothing can emit is a claim the system does not
 * honour (the `AC-107` discipline).
 *
 * Each event below names its command in `COMMAND_DEFINITIONS`, is gated on an
 * authenticated operator in `commandHandler`, persists through the normal
 * append-only log, and is exercised by a test that drives the command.
 */

/**
 * A briefing record is opened, capturing its interval end **once** (C-7).
 *
 * The captured end is a payload field rather than something recomputed at
 * read time, which is what makes a briefing a record instead of a live query
 * that changes its own answer every time it is opened.
 */
export const BriefingCreatedEvent = defineEvent(
  "briefing.created",
  z.object({
    briefingId: IdSchema,
    previousAcknowledgedSequence: z.number().int().nonnegative(),
    capturedEndSequence: z.number().int().nonnegative(),
    sourceCoverageIds: z.array(z.string().min(1)),
    externalActionClassifierVersion: z.number().int().positive(),
  }),
);

/**
 * An authenticated operator states they reviewed the briefing (C-7).
 *
 * This is the **only** thing that advances the cursor. Rendering, reopening,
 * refreshing, and regenerating do not — if viewing advanced it, opening a
 * briefing would silently discard events nobody read.
 *
 * `acknowledgedBy` is written from the authenticated principal, never from
 * the payload, on the same standard as `resolvedBy` on approval resolution.
 */
export const BriefingAcknowledgedEvent = defineEvent(
  "briefing.acknowledged",
  z.object({
    briefingId: IdSchema,
    acknowledgedBy: IdSchema,
  }),
);

/**
 * The operator configures the decision-batch policy.
 *
 * Ships disabled and unconfigured; this event is the only way a schedule or
 * timezone is ever set, and it requires an authenticated operator because the
 * policy governs when Foundry may interrupt a person.
 */
export const DecisionBatchPolicyConfiguredEvent = defineEvent(
  "decisionbatch.policy_configured",
  z.object({
    timezone: z.string().min(1).nullable(),
    schedule: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("unconfigured") }),
      z.object({
        kind: z.literal("daily"),
        atLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      }),
      z.object({
        kind: z.literal("weekdays"),
        atLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      }),
    ]),
    enabled: z.boolean(),
    immediateInterruptionCategories: z.array(z.string().min(1)),
    nextExpectedBatchAt: z.iso.datetime().nullable(),
    configuredBy: IdSchema,
  }),
);

export const COMMAND_CENTER_EVENTS = [
  BriefingCreatedEvent,
  BriefingAcknowledgedEvent,
  DecisionBatchPolicyConfiguredEvent,
] as const;
