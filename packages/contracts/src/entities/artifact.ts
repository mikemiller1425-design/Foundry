import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";

// docs/02-specification/domain-model.md → Artifact
export const ArtifactTypeSchema = z.enum([
  "requirements",
  "plan",
  "source_code",
  "test_report",
  "build_package",
  "log_bundle",
  "approval_evidence",
  "deployment_package",
]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const ArtifactStatusSchema = z.enum([
  "draft",
  "created",
  "validating",
  "validated",
  "rejected",
  "ready",
  "in_transfer",
  "received",
  "archived",
]);
export type ArtifactStatus = z.infer<typeof ArtifactStatusSchema>;

export const ArtifactSchema = z.object({
  id: IdSchema,
  buildId: IdSchema,
  stageId: IdSchema,
  artifactType: ArtifactTypeSchema,
  name: z.string().min(1),
  status: ArtifactStatusSchema,
  storageUri: z.string().min(1),
  checksum: z.string().min(1),
  createdByAgentId: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  parentArtifactId: IdSchema.optional(),
  version: z.number().int().positive().optional(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;
