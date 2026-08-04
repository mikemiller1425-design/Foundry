import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";

// docs/02-specification/domain-model.md → BuildStage
// V1 limits: exactly these seven named stages, in this sequence
// (docs/01-mission/v1-scope.md § "V1 Build Stages").
/**
 * The seven stage names, **in their authoritative sequence** (AC-107).
 *
 * Transcribed from `docs/01-mission/v1-scope.md` § "V1 Build Stages",
 * which states: *"No V1 build may use a stage name outside this table. Any
 * future stage requires a mission amendment, not a silent addition during
 * implementation."* `domain-model.md` → BuildStage repeats the constraint.
 *
 * The *order* is new here, and it is what a plan needs. The enum below
 * already made an unknown name unrepresentable; nothing expressed that the
 * seven are sequential, so a plan listing them in any order — or listing
 * five of them — was previously representable. `BuildPlanSchema` uses this
 * to require exactly these seven, exactly once, in exactly this order.
 *
 * V1.1 keeps the seven fixed. Dynamic or generated stage sets are
 * prohibited work for this mission.
 */
export const BUILD_STAGE_SEQUENCE = [
  "planning",
  "scaffold",
  "frontend_implementation",
  "backend_implementation",
  "integration",
  "qa_validation",
  "deployment_package",
] as const;

export const BuildStageNameSchema = z.enum(BUILD_STAGE_SEQUENCE);
export type BuildStageName = z.infer<typeof BuildStageNameSchema>;

/** 1-based position in the authoritative sequence, or `undefined` if unknown. */
export function buildStageSequenceNumber(name: string): number | undefined {
  const index = (BUILD_STAGE_SEQUENCE as readonly string[]).indexOf(name);
  return index === -1 ? undefined : index + 1;
}

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
