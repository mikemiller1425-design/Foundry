import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";

// docs/02-specification/domain-model.md → Requirement
export const RequirementStatusSchema = z.enum(["pending", "running", "passed", "failed", "waived"]);
export type RequirementStatus = z.infer<typeof RequirementStatusSchema>;

export const RequirementSchema = z.object({
  id: IdSchema,
  stageId: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  status: RequirementStatusSchema,
  required: z.boolean(),
  validatorType: z.string().min(1),
  evidenceIds: z.array(IdSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  retryCount: z.number().int().nonnegative().optional(),
  lastFailureMessage: z.string().optional(),
});
export type Requirement = z.infer<typeof RequirementSchema>;
