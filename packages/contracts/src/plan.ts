import { z } from "zod";
import { IdSchema, TimestampSchema, RuntimeTypeSchema, V1RiskClassSchema } from "./common";
import { BUILD_STAGE_SEQUENCE, BuildStageNameSchema } from "./entities/buildStage";
import { ObjectiveTextSchema, ObjectiveWorkspaceSchema } from "./objective";

/**
 * The structured plan an Architect step will produce (AC-107).
 *
 * **Contract only.** Nothing in this rung produces, persists, renders, or
 * acts on a plan — that is `AC-108`. What lands here is the shape, so the
 * boundary is explicit and fail-closed *before* a planner exists rather
 * than being discovered by one.
 *
 * The design intent is that a plan cannot express anything the mission
 * excludes:
 *
 * - **The stage set is fixed, ordered, and complete.** Exactly the seven
 *   names from `v1-scope.md` § "V1 Build Stages", each once, in sequence.
 *   A plan with six stages, a duplicate, a reordering, or an invented name
 *   is rejected. V1.1 keeps the seven fixed; dynamic stage generation is
 *   prohibited work.
 * - **Workspace and risk are re-stated on the plan and re-validated.** They
 *   are not inherited on trust from whatever submitted the objective, so a
 *   planner cannot quietly widen either.
 * - **`.strict()` throughout.** An invented field is refused, not dropped.
 *
 * A plan is a *proposal to be reviewed*, never an authorization. Executing
 * one requires a separate, single-use `ExecutionAuthorization`
 * (`authorization.ts`), and that separation is the point.
 */

export const PLAN_REQUIREMENT_NAME_MAX = 120;
export const PLAN_TEXT_MAX = 500;
export const PLAN_MAX_REQUIREMENTS_PER_STAGE = 12;

const PlanTextSchema = z.string().trim().min(1).max(PLAN_TEXT_MAX);

/**
 * One acceptance criterion a requirement is judged against.
 *
 * Deliberately plain text and deliberately *not* executable. `v1-scope.md`
 * stage 1 names "acceptance criteria" as part of the plan artifact; making
 * them a script or a command would be an executor, which is prohibited
 * work for this rung and for this mission at this point.
 */
export const AcceptanceCriterionSchema = PlanTextSchema;

export const PlannedRequirementSchema = z
  .object({
    name: z.string().trim().min(1).max(PLAN_REQUIREMENT_NAME_MAX),
    description: PlanTextSchema,
    /** Mandatory requirements gate stage completion (invariant 2 / F-04). */
    required: z.boolean(),
    /**
     * How the requirement is judged. Free-form by `domain-model.md` →
     * Requirement, which types it as a string; constrained here only in
     * length so it cannot become a smuggled payload.
     */
    validatorType: z.string().trim().min(1).max(PLAN_REQUIREMENT_NAME_MAX),
    acceptanceCriteria: z
      .array(AcceptanceCriterionSchema)
      .min(1)
      .max(PLAN_MAX_REQUIREMENTS_PER_STAGE),
  })
  .strict();
export type PlannedRequirement = z.infer<typeof PlannedRequirementSchema>;

export const PlannedStageSchema = z
  .object({
    name: BuildStageNameSchema,
    /** 1-based, and checked against the authoritative order by `BuildPlanSchema`. */
    sequence: z.number().int().positive(),
    sourceBuildingId: IdSchema,
    destinationBuildingId: IdSchema,
    /**
     * `mock` | `claude_code` only (`RuntimeTypeSchema`). A plan cannot name
     * a runtime the platform does not have.
     */
    runtime: RuntimeTypeSchema,
    required: z.boolean(),
    requirements: z.array(PlannedRequirementSchema).max(PLAN_MAX_REQUIREMENTS_PER_STAGE),
  })
  .strict();
export type PlannedStage = z.infer<typeof PlannedStageSchema>;

const BuildPlanShape = z
  .object({
    planId: IdSchema,
    projectId: IdSchema,
    buildId: IdSchema,
    /** The objective this plan claims to satisfy, under the same bounds. */
    objective: ObjectiveTextSchema,
    /** Re-stated and re-validated, never inherited on trust. */
    workspace: ObjectiveWorkspaceSchema,
    riskClass: V1RiskClassSchema,
    stages: z.array(PlannedStageSchema),
    createdAt: TimestampSchema,
  })
  .strict();

/**
 * The stage-set rule, applied as a whole-plan check.
 *
 * Per-stage validation can only see one stage. "Exactly the seven, once
 * each, in order" is a property of the list, so it is checked here — and
 * each violation reports the specific stage index, because a plan that is
 * simply "invalid" tells a reviewer nothing about which part to fix.
 */
export const BuildPlanSchema = BuildPlanShape.superRefine((plan, ctx) => {
  const expected = BUILD_STAGE_SEQUENCE;

  if (plan.stages.length !== expected.length) {
    ctx.addIssue({
      code: "custom",
      path: ["stages"],
      message: `A V1.1 plan must contain exactly the ${expected.length} named stages from v1-scope.md § "V1 Build Stages"; received ${plan.stages.length}.`,
    });
    return;
  }

  expected.forEach((name, index) => {
    const stage = plan.stages[index];
    if (!stage) return;
    if (stage.name !== name) {
      ctx.addIssue({
        code: "custom",
        path: ["stages", index, "name"],
        message: `Stage ${index + 1} must be \`${name}\`; received \`${stage.name}\`. The seven stages are fixed and sequential in V1.1.`,
      });
    }
    if (stage.sequence !== index + 1) {
      ctx.addIssue({
        code: "custom",
        path: ["stages", index, "sequence"],
        message: `Stage \`${stage.name}\` must carry sequence ${index + 1}; received ${stage.sequence}.`,
      });
    }
  });
});
export type BuildPlan = z.infer<typeof BuildPlanSchema>;

/**
 * A stable fingerprint of the reviewed plan.
 *
 * `F-113` requires an execution authorization to be **plan-bound**: "a
 * modified plan invalidates it". That needs a value that changes whenever
 * anything an operator reviewed changes, and this is it.
 *
 * Deliberately dependency-free and synchronous: this module is imported by
 * the browser bundle as well as the backend, so `node:crypto` is not
 * available, and an async digest would make the authorization contract
 * awkward for no benefit. It is a **change detector, not a security
 * primitive** — nothing here defends against a chosen-collision attacker,
 * and nothing is asked to. `createdAt` and `planId` are included, so two
 * plans with identical content but different identity are distinguishable.
 */
export function fingerprintPlan(plan: BuildPlan): string {
  // Canonical form: field order fixed here rather than inherited from
  // whatever order the object happened to be built in, so the fingerprint
  // is a function of content and not of construction.
  const canonical = JSON.stringify([
    plan.planId,
    plan.projectId,
    plan.buildId,
    plan.objective,
    plan.workspace,
    plan.riskClass,
    plan.createdAt,
    plan.stages.map((stage) => [
      stage.name,
      stage.sequence,
      stage.sourceBuildingId,
      stage.destinationBuildingId,
      stage.runtime,
      stage.required,
      stage.requirements.map((requirement) => [
        requirement.name,
        requirement.description,
        requirement.required,
        requirement.validatorType,
        requirement.acceptanceCriteria,
      ]),
    ]),
  ]);

  // FNV-1a, 32-bit, doubled over two offsets for a wider value. Chosen for
  // being short, deterministic, and obviously not a cryptographic claim.
  const hash = (seed: number): string => {
    let value = seed;
    for (let i = 0; i < canonical.length; i += 1) {
      value ^= canonical.charCodeAt(i);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    return value.toString(16).padStart(8, "0");
  };

  return `plan-${hash(0x811c9dc5)}${hash(0x9e3779b9)}`;
}
