import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";

// docs/02-specification/domain-model.md → Build
export const BuildStatusSchema = z.enum([
  "planned",
  "ready",
  "running",
  "validating",
  "waiting_for_approval",
  "completed",
  "paused",
  "blocked",
  "revision_required",
  "failed",
  "cancelled",
]);
export type BuildStatus = z.infer<typeof BuildStatusSchema>;

export const BuildSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  sequenceNumber: z.number().int().positive(),
  status: BuildStatusSchema,
  objectiveSnapshot: z.string().min(1),
  /**
   * `null` until the Build has a stage.
   *
   * `domain-model.md` lists this among Build's **required fields**, and it
   * stays required — the field is always present. What it may now hold is
   * the state that has always existed and was never representable: a Build
   * created from an objective, before anything has planned a stage for it.
   * Both reducers previously wrote `""` there, which `IdSchema` rejects, so
   * `WorldStateSchema.parse` at the `/world-state` boundary threw for any
   * Build that had not yet reached `stage.created`. In V1 a stage always
   * followed immediately and the gap never opened; AC-103 creates a Build
   * and deliberately stops, which is what surfaced it.
   */
  currentStageId: IdSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  failedAt: TimestampSchema.optional(),
  cancelledAt: TimestampSchema.optional(),
  failureReason: z.string().optional(),
});
export type Build = z.infer<typeof BuildSchema>;
