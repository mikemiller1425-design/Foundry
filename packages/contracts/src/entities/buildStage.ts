import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";

// docs/02-specification/domain-model.md → BuildStage
// V1 limits: exactly these seven named stages, in this sequence
// (docs/01-mission/v1-scope.md § "V1 Build Stages").
export const BuildStageNameSchema = z.enum([
  "planning",
  "scaffold",
  "frontend_implementation",
  "backend_implementation",
  "integration",
  "qa_validation",
  "deployment_package",
]);
export type BuildStageName = z.infer<typeof BuildStageNameSchema>;

export const BuildStageStatusSchema = z.enum([
  "planned",
  "ready",
  "running",
  "validating",
  "waiting_for_approval",
  "blocked",
  "revision_required",
  "completed",
  "failed",
  "cancelled",
]);
export type BuildStageStatus = z.infer<typeof BuildStageStatusSchema>;

export const BuildStageSchema = z.object({
  id: IdSchema,
  buildId: IdSchema,
  name: BuildStageNameSchema,
  sequence: z.number().int().positive(),
  status: BuildStageStatusSchema,
  required: z.boolean(),
  sourceBuildingId: IdSchema,
  destinationBuildingId: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  assignedAgentIds: z.array(IdSchema).optional(),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  failedAt: TimestampSchema.optional(),
  retryCount: z.number().int().nonnegative().optional(),
  approvalId: IdSchema.optional(),
});
export type BuildStage = z.infer<typeof BuildStageSchema>;
