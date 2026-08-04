import { z } from "zod";
import { IdSchema, TimestampSchema, V1RiskClassSchema } from "./common";
import { BuildStageNameSchema } from "./entities/buildStage";
import { ObjectiveWorkspaceSchema } from "./objective";
import { planRevision, type BuildPlan } from "./plan";

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
 * - **Plan-bound** — `planRevision` records which revision of the plan the
 *   operator reviewed, and `authorizesPlan()` reports drift from it.
 *
 *   **This is a change indicator, not the execution binding.**
 *   `planRevision` is a non-cryptographic FNV hash computed anywhere,
 *   including in a browser; it detects edits, and offers nothing against a
 *   party that wants two plans to share a value. Per the operator's
 *   `AC-107` contract review, the authoritative binding required at
 *   `AC-110` is a **backend-generated SHA-256 over canonical persisted
 *   plan content, stored with the `Plan` and compared server-side** — never
 *   computed by, or accepted from, a client. See
 *   `docs/03-architecture/agent-city-v1.1-build-ladder.md` § AC-110 and
 *   `F-113`. Not implemented here; `AC-107` is contract-only.
 * - **Single-use** — the authorization names exactly one build and one
 *   stage, and `singleUse` is a literal `true` so an authorization claiming
 *   otherwise is unrepresentable. Enforcing spend-once against persisted
 *   state is `AC-110`'s job; the *claim* cannot be widened here.
 * - **Budgeted** — `maxBudgetUsd` is required and capped. An authorization
 *   with no spend ceiling cannot be expressed.
 *
 * Workspace and risk class are re-stated rather than inherited, for the
 * same reason they are on the plan: an authorization is the last thing a
 * human reads before something runs, so every constraint it operates under
 * should be visible on its face.
 */

/**
 * A hard ceiling on model spend for one authorized run.
 *
 * **Required on every issued authorization**, and capped at
 * `MAX_BUDGET_USD_CEILING` for V1.1.
 *
 * The first version of this contract made the field optional and claimed
 * in its own comment that "an unbounded or absent-by-accident budget is
 * not representable". That was false: the schema permitted omission, so an
 * authorization with no budget at all parsed cleanly. The operator's
 * `AC-107` contract review required the claim and the schema to agree, and
 * they now do — by making the field required, which is the direction that
 * matches the intent.
 *
 * Carried on the authorization rather than the plan because spend is a
 * property of *running*, and the person authorizing the run is the person
 * who should see and bound it.
 */
export const MAX_BUDGET_USD_CEILING = 25;
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
    planRevision: z.string().min(1),
    projectId: IdSchema,
    buildId: IdSchema,
    /** Exactly one stage. An authorization is never build-wide. */
    stageName: BuildStageNameSchema,
    workspace: ObjectiveWorkspaceSchema,
    riskClass: V1RiskClassSchema,
    /** Required. See `BudgetUsdSchema` — an unbudgeted authorization is unrepresentable. */
    maxBudgetUsd: BudgetUsdSchema,
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

/**
 * An **incomplete, non-authorizing** pre-authorization (AC-107 correction).
 *
 * There is a real need for a half-filled object while an operator is still
 * choosing a stage or a budget. The danger is that such an object drifts
 * into a code path that treats it as permission.
 *
 * This type makes that impossible **by construction**, not by convention.
 * The two schemas are mutually exclusive:
 *
 * - A draft **cannot parse** as an `ExecutionAuthorization`: it lacks
 *   `singleUse`, `authorizedBy`, and `authorizedAt`, all required, and it
 *   carries a `kind` discriminator that `.strict()` refuses there.
 * - An `ExecutionAuthorization` **cannot parse** as a draft: it lacks
 *   `kind` and carries fields `.strict()` refuses here.
 *
 * So there is no object that satisfies both, and no accidental widening
 * path from "the operator was still deciding" to "the operator authorized
 * this". A draft confers nothing; it is a form in progress.
 */
export const ExecutionAuthorizationDraftSchema = z
  .object({
    kind: z.literal("execution_authorization_draft"),
    planId: IdSchema,
    projectId: IdSchema,
    buildId: IdSchema,
    /** Still being chosen — hence optional, and hence not an authorization. */
    stageName: BuildStageNameSchema.optional(),
    planRevision: z.string().min(1).optional(),
    workspace: ObjectiveWorkspaceSchema,
    riskClass: V1RiskClassSchema,
    maxBudgetUsd: BudgetUsdSchema.optional(),
  })
  .strict();
export type ExecutionAuthorizationDraft = z.infer<typeof ExecutionAuthorizationDraftSchema>;

/**
 * True only for a fully-formed authorization.
 *
 * The guard exists so a caller cannot satisfy a type check by asserting;
 * anything reaching an execution path must have passed this.
 */
export function isExecutionAuthorization(value: unknown): value is ExecutionAuthorization {
  return ExecutionAuthorizationSchema.safeParse(value).success;
}

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
 * `plan_modified` reports revision drift. It is a useful signal and it is
 * **not** the execution binding — see the module note above. `AC-110` must
 * gate a real invocation on the backend-generated SHA-256 comparison, not
 * on this.
 */
export function authorizesPlan(
  authorization: ExecutionAuthorization,
  plan: BuildPlan,
): AuthorizationCheck {
  const mismatches: AuthorizationMismatch[] = [];

  if (authorization.planId !== plan.planId) mismatches.push("plan_id_mismatch");
  if (authorization.planRevision !== planRevision(plan)) mismatches.push("plan_modified");
  if (authorization.buildId !== plan.buildId) mismatches.push("build_mismatch");
  if (authorization.projectId !== plan.projectId) mismatches.push("project_mismatch");
  if (!plan.stages.some((stage) => stage.name === authorization.stageName)) {
    mismatches.push("stage_not_in_plan");
  }
  if (authorization.workspace !== plan.workspace) mismatches.push("workspace_mismatch");
  if (authorization.riskClass !== plan.riskClass) mismatches.push("risk_class_mismatch");

  return { valid: mismatches.length === 0, mismatches };
}
