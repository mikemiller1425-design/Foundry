import { z } from "zod";
import { TimestampSchema } from "../common";

/**
 * Scheduled decision batches (Package 1b-ii scope item 2).
 *
 * The policy is operator-owned. Configuring it requires authenticated
 * operator authority and leaves append-only evidence, because a batching
 * schedule decides *when Foundry is allowed to interrupt a person* — a
 * setting the frontend must never be able to change on its own.
 *
 * It ships **disabled and unconfigured** (operator Amendment 4). Inventing a
 * default batch time would be inventing a preference: a system that decided
 * on its own to interrupt at 09:00 would be asserting something about the
 * operator's day that nobody told it.
 */

export const InterruptionCategorySchema = z.enum([
  "urgent_deadline",
  "safety_issue",
  "unexpected_spending",
  "external_action_failure",
  "probable_loss_of_material_value",
]);
export type InterruptionCategory = z.infer<typeof InterruptionCategorySchema>;

/**
 * The ratified defaults.
 *
 * These are **backend-owned** and grant no external authority: qualifying for
 * immediate interruption means a notification may bypass the batch, not that
 * any action may bypass approval. The frontend cannot infer them client-side
 * or add to them — urgency is projected, never decided in a browser.
 */
export const DEFAULT_IMMEDIATE_INTERRUPTION_CATEGORIES: readonly InterruptionCategory[] = [
  "urgent_deadline",
  "safety_issue",
  "unexpected_spending",
  "external_action_failure",
  "probable_loss_of_material_value",
];

export const BatchScheduleSchema = z.discriminatedUnion("kind", [
  /** The shipped state. No schedule has been chosen by anyone. */
  z.object({ kind: z.literal("unconfigured") }),
  z.object({
    kind: z.literal("daily"),
    /** 24-hour local wall time in the policy's timezone, "HH:MM". */
    atLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }),
  z.object({
    kind: z.literal("weekdays"),
    atLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }),
]);
export type BatchSchedule = z.infer<typeof BatchScheduleSchema>;

export const DecisionBatchPolicySchema = z
  .object({
    /** IANA zone. Null until the operator states one — never guessed. */
    timezone: z.string().min(1).nullable(),
    schedule: BatchScheduleSchema,
    /** Computed only when a schedule exists; null otherwise. */
    nextExpectedBatchAt: TimestampSchema.nullable(),
    enabled: z.boolean(),
    immediateInterruptionCategories: z.array(InterruptionCategorySchema),
    configuredAt: TimestampSchema.nullable(),
    /** The authenticated operator who last configured it. */
    configuredBy: z.string().min(1).nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.enabled && value.schedule.kind === "unconfigured") {
      ctx.addIssue({
        code: "custom",
        path: ["enabled"],
        message: "a policy cannot be enabled before a schedule is chosen",
      });
    }
    if (value.enabled && !value.timezone) {
      ctx.addIssue({
        code: "custom",
        path: ["timezone"],
        message: "a policy cannot be enabled without a timezone",
      });
    }
    if (value.schedule.kind === "unconfigured" && value.nextExpectedBatchAt !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["nextExpectedBatchAt"],
        message: "an unconfigured schedule cannot predict a next batch",
      });
    }
  });
export type DecisionBatchPolicy = z.infer<typeof DecisionBatchPolicySchema>;

/** The shipped policy: disabled, unconfigured, no invented time or zone. */
export const UNCONFIGURED_DECISION_BATCH_POLICY: DecisionBatchPolicy = Object.freeze({
  timezone: null,
  schedule: { kind: "unconfigured" as const },
  nextExpectedBatchAt: null,
  enabled: false,
  immediateInterruptionCategories: [...DEFAULT_IMMEDIATE_INTERRUPTION_CATEGORIES],
  configuredAt: null,
  configuredBy: null,
});
