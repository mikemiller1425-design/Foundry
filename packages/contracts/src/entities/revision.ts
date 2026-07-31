import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";

// docs/02-specification/domain-model.md → Revision (resolves audit finding B-03)
export const RevisionRequestedBySchema = z.enum(["approval", "operator", "inspector"]);
export type RevisionRequestedBy = z.infer<typeof RevisionRequestedBySchema>;

export const RevisionStatusSchema = z.enum(["requested", "in_progress", "completed", "cancelled"]);
export type RevisionStatus = z.infer<typeof RevisionStatusSchema>;

export const RevisionSchema = z.object({
  id: IdSchema,
  buildId: IdSchema,
  stageId: IdSchema,
  reason: z.string().min(1),
  requestedBy: RevisionRequestedBySchema,
  status: RevisionStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  sourceApprovalId: IdSchema.optional(),
  resolvedAt: TimestampSchema.optional(),
  resultingStageStatus: z.string().optional(),
});
export type Revision = z.infer<typeof RevisionSchema>;
