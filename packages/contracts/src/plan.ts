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
 * - **Real execution is allocated to one named stage or none.** The
 *   `claude_code` runtime may be planned only for `backend_implementation`
 *   (`CLAUDE_CODE_STAGE`), and never for more than one stage. A plan
 *   cannot propose two real model invocations, or move the real one
 *   somewhere the specification did not put it.
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
 * The one stage permitted to allocate the `claude_code` runtime.
 *
 * The authoritative rule is **narrower than "at most one"** — it names the
 * stage. `domain-model.md` → AgentRun invariants: *"exactly one `AgentRun`
 * in V1 uses `runtimeType: claude_code` (**the `backend_implementation`
 * stage**, per `v1-scope.md`)"*. `v1-scope.md` stage 4 calls it "the one
 * controlled Claude Code stage, R0–R2 only", and the V1.1 scope § 5.4
 * carries it forward as "**One** real Claude Code stage".
 *
 * So a plan that allocated `claude_code` to `scaffold` would be refused
 * even if it were the only such stage: the constraint is not a budget of
 * one, it is a named stage.
 */
export const CLAUDE_CODE_STAGE = "backend_implementation" as const;

/**
 * Whole-plan rules, applied together.
 *
 * Per-stage validation can only see one stage. "Exactly the seven, once
 * each, in order" and "at most one Claude Code stage, and only that one"
 * are properties of the *list*, so they are checked here — and each
 * violation reports the specific stage index, because a plan that is
 * simply "invalid" tells a reviewer nothing about which part to fix.
 */
export const BuildPlanSchema = BuildPlanShape.superRefine((plan, ctx) => {
  const expected = BUILD_STAGE_SEQUENCE;

  /**
   * Real-execution allocation, checked before the stage-set rules so a
   * plan that is *also* misordered still reports this — it is the
   * constraint with the highest consequence, since it is what decides
   * whether a real model invocation can be planned at all.
   */
  plan.stages.forEach((stage, index) => {
    if (stage.runtime === "claude_code" && stage.name !== CLAUDE_CODE_STAGE) {
      ctx.addIssue({
        code: "custom",
        path: ["stages", index, "runtime"],
        message: `Only the \`${CLAUDE_CODE_STAGE}\` stage may use the \`claude_code\` runtime; stage \`${stage.name}\` may not. V1.1 permits exactly one controlled Claude Code stage, and the specification names which one (domain-model.md → AgentRun invariants; v1-scope.md § "V1 Build Stages").`,
      });
    }
  });

  const claudeCodeStages = plan.stages.filter((stage) => stage.runtime === "claude_code");
  if (claudeCodeStages.length > 1) {
    ctx.addIssue({
      code: "custom",
      path: ["stages"],
      message: `A V1.1 plan may allocate the \`claude_code\` runtime to at most one stage; this plan allocates it to ${claudeCodeStages.length}. Each real invocation costs money and requires its own single-use operator authorization.`,
    });
  }

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
 * A **revision indicator** for a plan. Not a security boundary.
 *
 * ## What this is for
 *
 * Detecting that a plan changed, cheaply, on either side of the wire —
 * "the plan you are looking at is not the plan you reviewed". It is useful
 * for review-time UX and drift detection, and it is deliberately
 * dependency-free and synchronous because `packages/contracts` is imported
 * by the browser bundle, where `node:crypto` does not exist.
 *
 * ## What this is NOT
 *
 * **It is not the execution binding**, and it must not be represented as
 * one. FNV-1a is a non-cryptographic hash: it detects accidental and
 * incidental change, and offers no resistance to a party that wants two
 * different plans to produce the same value. Anything that gates a real
 * model invocation must not rest on it.
 *
 * Per the operator's `AC-107` contract review, the authoritative execution
 * binding required at `AC-110` is a **backend-generated SHA-256 hash of
 * canonical persisted plan content, stored with the `Plan` and compared
 * server-side** — never computed by, or accepted from, a client. That
 * requirement is recorded in `docs/03-architecture/agent-city-v1.1-build-ladder.md`
 * § AC-110 and in `docs/02-specification/v1.1-acceptance.md` `F-113`. It is
 * **not implemented here**; `AC-107` is a contract-only rung.
 *
 * `createdAt` and `planId` are included, so two plans with identical
 * content but different identity are distinguishable.
 */
export function planRevision(plan: BuildPlan): string {
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

  // FNV-1a, 32-bit, doubled over two offsets. Chosen for being short,
  // deterministic, and obviously not a cryptographic claim — see the
  // contract note above for what must gate a real invocation instead.
  const hash = (seed: number): string => {
    let value = seed;
    for (let i = 0; i < canonical.length; i += 1) {
      value ^= canonical.charCodeAt(i);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    return value.toString(16).padStart(8, "0");
  };

  return `rev-${hash(0x811c9dc5)}${hash(0x9e3779b9)}`;
}
