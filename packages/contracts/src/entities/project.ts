import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";

// docs/02-specification/domain-model.md → Project
export const ProjectStatusSchema = z.enum([
  "draft",
  "active",
  "completed",
  "archived",
  "cancelled",
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  objective: z.string().min(1),
  status: ProjectStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  archivedAt: TimestampSchema.optional(),
});
export type Project = z.infer<typeof ProjectSchema>;
