import { z } from "zod";
import { IdSchema, TimestampSchema, V1RiskClassSchema } from "../common";

// docs/02-specification/domain-model.md → Approval
export const ApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "revision_requested",
  "cancelled",
  "expired",
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalSchema = z.object({
  id: IdSchema,
  buildId: IdSchema,
  stageId: IdSchema,
  status: ApprovalStatusSchema,
  riskClass: V1RiskClassSchema,
  title: z.string().min(1),
  reason: z.string().min(1),
  recommendedAction: z.string().min(1),
  evidenceIds: z.array(IdSchema),
  requestedAt: TimestampSchema,
  resolvedAt: TimestampSchema.optional(),
  resolvedBy: IdSchema.optional(),
  resolutionNote: z.string().optional(),
});
export type Approval = z.infer<typeof ApprovalSchema>;
