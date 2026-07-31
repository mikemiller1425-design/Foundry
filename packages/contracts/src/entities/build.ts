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
  currentStageId: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  failedAt: TimestampSchema.optional(),
  cancelledAt: TimestampSchema.optional(),
  failureReason: z.string().optional(),
});
export type Build = z.infer<typeof BuildSchema>;
