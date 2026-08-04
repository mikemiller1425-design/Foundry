import { z } from "zod";
import { IdSchema, TimestampSchema, V1RiskClassSchema } from "./common";
import { BuildStageNameSchema } from "./entities/buildStage";
import { ObjectiveWorkspaceSchema } from "./objective";
import { fingerprintPlan, type BuildPlan } from "./plan";

/**
 * The operator's authorization to execute one stage, once (AC-107).
 *
 * **Contract only.** No gate consumes this yet — that is `AC-110`, and no
 * real runtime is invoked until `AC-111`, each under its own operator
 * authorization. The shape lands first so the constraints are explicit
 * before anything can execute.
 *
 * `F-113` states the two properties this type exists to make expressible:
 *
 * > "No real execution is reachable without an explicit operator
 * > authorization. The authorization is **single-use** and **plan-bound**:
 * > a modified plan invalidates it, and one authorization cannot cover a
 * > second run."
 *
 * How each is carried:
 *
 * - **Plan-bound** — `planFingerprint` pins the exact plan content the
 *   operator reviewed. Re-fingerprinting the current plan and comparing is
 *   how "a modified plan invalidates it" becomes checkable rather than
 *   aspirational. `authorizesPlan()` is that check.
 * - **Single-use** — `scope` names exactly one build and one stage, and
 *   `singleUse` is a literal `true` so an authorization claiming otherwise
 *   is unrepresentable. Enforcing spend-once against persisted state is
 *   `AC-110`'s job; the *claim* cannot be widened here.
 *
 * Workspace and risk class are re-stated rather than inherited, for the
 * same reason they are on the plan: an authorization is the last thing a
 * human reads before something runs, so every constraint it operates under
 * should be visible on its face.
 */

/**
 * A hard ceiling on model spend for one authorized run.
 *
 * Carried on the authorization, not on the plan: spend is a property of
 * running, and the operator authorizing the run is the person who should
 * see and bound it. `Number.isFinite` and a positive minimum mean an
 * unbounded or absent-by-accident budget is not representable — the field
 * is optional, but an *empty* one is not the same as an unlimited one, and
 * `AC-110`/`AC-111` must supply it before a real invocation.
 */
export const MAX_BUDGET_USD_CEILING = 100;
export const BudgetUsdSchema = z.number().positive().max(MAX_BUDGET_USD_CEILING).finite();

export const ExecutionAuthorizationSchema = z
  .object({
    authorizationId: IdSchema,
    /** The plan this authorization was granted against. */
    planId: IdSchema,
    /**
     * The plan's content fingerprint at the moment of authorization.
     * Any later edit changes it, which invalidates this authorization.
     */
    planFingerprint: z.string().min(1),
    projectId: IdSchema,
    buildId: IdSchema,
    /** Exactly one stage. An authorization is never build-wide. */
    stageName: BuildStageNameSchema,
    workspace: ObjectiveWorkspaceSchema,
    riskClass: V1RiskClassSchema,
    maxBudgetUsd: BudgetUsdSchema.optional(),
    /** The authenticated operator, recorded from the credential, never the payload. */
    authorizedBy: IdSchema,
    authorizedAt: TimestampSchema,
    /**
     * Literal `true`. A multi-use authorization cannot be expressed, so
     * "single-use" is a property of the type rather than a rule someone
     * has to remember to apply.
     */
    singleUse: z.literal(true),
  })
  .strict();
export type ExecutionAuthorization = z.infer<typeof ExecutionAuthorizationSchema>;

export type AuthorizationMismatch =
  | "plan_id_mismatch"
  | "plan_modified"
  | "build_mismatch"
  | "project_mismatch"
  | "stage_not_in_plan"
  | "workspace_mismatch"
  | "risk_class_mismatch";

export interface AuthorizationCheck {
  valid: boolean;
  /** Every way the pairing fails, so a reviewer sees all of them at once. */
  mismatches: AuthorizationMismatch[];
}

/**
 * Whether an authorization still authorizes the plan it names.
 *
 * Pure and total: it takes both documents and returns every mismatch it
 * finds rather than throwing on the first. `AC-110` decides what to *do*
 * with the answer; this only makes the answer computable, and computable
 * the same way in every caller.
 *
 * `plan_modified` is the one that matters most — it is `F-113`'s "a
 * modified plan invalidates it", reduced to a fingerprint comparison.
 */
export function authorizesPlan(
  authorization: ExecutionAuthorization,
  plan: BuildPlan,
): AuthorizationCheck {
  const mismatches: AuthorizationMismatch[] = [];

  if (authorization.planId !== plan.planId) mismatches.push("plan_id_mismatch");
  if (authorization.planFingerprint !== fingerprintPlan(plan)) mismatches.push("plan_modified");
  if (authorization.buildId !== plan.buildId) mismatches.push("build_mismatch");
  if (authorization.projectId !== plan.projectId) mismatches.push("project_mismatch");
  if (!plan.stages.some((stage) => stage.name === authorization.stageName)) {
    mismatches.push("stage_not_in_plan");
  }
  if (authorization.workspace !== plan.workspace) mismatches.push("workspace_mismatch");
  if (authorization.riskClass !== plan.riskClass) mismatches.push("risk_class_mismatch");

  return { valid: mismatches.length === 0, mismatches };
}
