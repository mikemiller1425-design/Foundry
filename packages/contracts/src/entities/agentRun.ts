import { z } from "zod";
import { IdSchema, RuntimeTypeSchema, TimestampSchema, V1RiskClassSchema } from "../common";

// docs/02-specification/domain-model.md → AgentRun (resolves audit finding B-04)
export const AgentRunStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "timed_out",
]);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const AgentRunSchema = z.object({
  id: IdSchema,
  agentId: IdSchema,
  taskId: IdSchema,
  runtimeType: RuntimeTypeSchema,
  status: AgentRunStatusSchema,
  riskClass: V1RiskClassSchema,
  startedAt: TimestampSchema,
  completedAt: TimestampSchema.optional(),
  exitCode: z.number().int().optional(),
  logRef: z.string().optional(),
  outputArtifactIds: z.array(IdSchema).optional(),
  evidenceIds: z.array(IdSchema).optional(),
  failureCode: z.string().optional(),
  failureMessage: z.string().optional(),
  // Forward-compatible optional hook for a later mission (Future Registry
  // Treasury); unused and not displayed in V1. See domain-model.md AgentRun.
  costUsd: z.number().nonnegative().optional(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;
