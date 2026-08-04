import type { BuildPlan } from "./plan";
import { planRevision } from "./plan";
import type { ExecutionAuthorization } from "./authorization";

/**
 * Whether an authorization still authorizes the plan it names (AC-107,
 * extended at AC-110).
 *
 * Kept in its own module so the dependency runs one way:
 * `authorization.ts` holds shapes and imports nothing from `plan.ts`,
 * `plan.ts` embeds the authorization on a persisted plan, and this module
 * — which needs both — sits above them. The alternative was a cycle.
 */

export type AuthorizationMismatch =
  | "plan_id_mismatch"
  /** **The binding.** Backend SHA-256 over persisted content disagrees. */
  | "plan_content_hash_mismatch"
  /** A change indicator, reported alongside — never the binding. */
  | "plan_modified"
  | "build_mismatch"
  | "project_mismatch"
  | "stage_not_in_plan"
  | "stage_not_real_execution"
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
 * Pure and total: it takes the documents and returns every mismatch it
 * finds rather than throwing on the first, so a reviewer sees all of them
 * at once rather than peeling them off one deployment at a time.
 *
 * ## The binding, and the thing that is not the binding
 *
 * `currentContentHash` is the **backend-generated SHA-256 over canonical
 * persisted plan content**, recomputed by the caller from what is actually
 * stored. It is a required parameter rather than something derived here on
 * purpose: `@foundry/contracts` is in the browser bundle and holds no
 * `node:crypto`, so this function *cannot* produce the binding itself and
 * therefore cannot be tricked into accepting one it computed from
 * caller-supplied bytes. The only producer is `planContentHash` in
 * `@foundry/persistence`, which is backend-only by construction.
 *
 * `plan_modified` reports `planRevision` drift. It is a useful signal, it
 * is reported alongside, and it is **not** the binding (`F-113a`).
 *
 * `stage_not_real_execution` is the check that keeps an authorization
 * meaningful: authorizing a stage the plan runs with the mock would grant
 * permission for something that was never going to invoke a model.
 */
export function authorizesPlan(
  authorization: ExecutionAuthorization,
  plan: BuildPlan,
  currentContentHash: string,
): AuthorizationCheck {
  const mismatches: AuthorizationMismatch[] = [];

  if (authorization.planId !== plan.planId) mismatches.push("plan_id_mismatch");
  if (authorization.planContentHash !== currentContentHash) {
    mismatches.push("plan_content_hash_mismatch");
  }
  if (authorization.planRevision !== planRevision(plan)) mismatches.push("plan_modified");
  if (authorization.buildId !== plan.buildId) mismatches.push("build_mismatch");
  if (authorization.projectId !== plan.projectId) mismatches.push("project_mismatch");

  const stage = plan.stages.find((entry) => entry.name === authorization.stageName);
  if (!stage) {
    mismatches.push("stage_not_in_plan");
  } else if (stage.runtime !== "claude_code") {
    mismatches.push("stage_not_real_execution");
  }

  if (authorization.workspace !== plan.workspace) mismatches.push("workspace_mismatch");
  if (authorization.riskClass !== plan.riskClass) mismatches.push("risk_class_mismatch");

  return { valid: mismatches.length === 0, mismatches };
}
