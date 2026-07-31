import { z } from "zod";
import { IdSchema, RuntimeTypeSchema, TimestampSchema } from "../common";

// docs/02-specification/domain-model.md → Agent
export const AgentRoleSchema = z.enum(["architect", "builder", "inspector"]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentStatusSchema = z.enum([
  "idle",
  "assigned",
  "traveling",
  "working",
  "waiting",
  "paused",
  "failed",
  "offline",
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AgentSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  role: AgentRoleSchema,
  status: AgentStatusSchema,
  homeBuildingId: IdSchema,
  currentBuildingId: IdSchema,
  authorityLevel: z.number().int().nonnegative(),
  runtimeType: RuntimeTypeSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  lastHeartbeatAt: TimestampSchema,
  currentTaskId: IdSchema.optional(),
  currentStageId: IdSchema.optional(),
  pausedReason: z.string().optional(),
  failureReason: z.string().optional(),
  performanceSummary: z.string().optional(),
  runtimeSessionId: z.string().optional(),
});
export type Agent = z.infer<typeof AgentSchema>;
