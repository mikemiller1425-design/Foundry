import { z } from "zod";
import { IdSchema, TimestampSchema, V1RiskClassSchema } from "../common";

// docs/02-specification/domain-model.md → Task
export const TaskStatusSchema = z.enum([
  "queued",
  "assigned",
  "running",
  "waiting",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: IdSchema,
  stageId: IdSchema,
  title: z.string().min(1),
  status: TaskStatusSchema,
  assignedAgentId: IdSchema,
  riskClass: V1RiskClassSchema,
  inputArtifactIds: z.array(IdSchema),
  outputArtifactIds: z.array(IdSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  pausedReason: z.string().optional(),
  failureReason: z.string().optional(),
});
export type Task = z.infer<typeof TaskSchema>;
