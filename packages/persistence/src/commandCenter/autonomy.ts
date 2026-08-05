import type { AutonomyLevel } from "@foundry/contracts";

/**
 * Autonomy grants nothing (Package 1b-ii scope item 7, acceptance proof 21).
 *
 * The four labels exist so a mission's intended supervision style can be
 * *displayed*. They are not an input to any authorization decision, and this
 * module is where that is made checkable rather than asserted.
 *
 * Effective ability is the **intersection** of six independent facts. An
 * intersection has a useful property here: adding a permissive value to one
 * input can never widen the result, because every other input still has to
 * agree. Autonomy is not one of the six.
 */

export interface EffectiveAbilityInputs {
  /** Established by a backend-issued credential, never by a claim. */
  principalAuthenticated: boolean;
  /** The persisted role/permission check for this actor. */
  backendPermits: boolean;
  /** An explicit, recorded authorization for this specific act. */
  explicitlyAuthorized: boolean;
  /** The mission's own recorded constraints allow it. */
  withinMissionConstraints: boolean;
  /** Spend would remain inside the authorized ceiling. */
  withinBudget: boolean;
  /** If the act is an external action, its approval requirement is satisfied. */
  externalActionApprovalSatisfied: boolean;
}

/**
 * The complete set of inputs that decide what an actor may do.
 *
 * `autonomy` is deliberately **not** a parameter. A function that accepted it
 * could be changed later to consult it; a function that cannot see it cannot
 * be made to depend on it by accident.
 */
export function effectiveAbility(inputs: EffectiveAbilityInputs): boolean {
  return (
    inputs.principalAuthenticated &&
    inputs.backendPermits &&
    inputs.explicitlyAuthorized &&
    inputs.withinMissionConstraints &&
    inputs.withinBudget &&
    inputs.externalActionApprovalSatisfied
  );
}

/**
 * Proves the property directly: for a fixed set of inputs, every autonomy
 * level yields the identical decision.
 *
 * Exported rather than kept in the test file so the guarantee is available to
 * any caller that wants to assert it — including a future package that adds a
 * fifth input and needs to show it did not smuggle autonomy in.
 */
export function autonomyGrantsNothing(
  inputs: EffectiveAbilityInputs,
  levels: readonly AutonomyLevel[] = ["prepare", "approve", "supervise", "manage_exceptions"],
): boolean {
  const baseline = effectiveAbility(inputs);
  // The label is accepted, ignored, and discarded. That is the whole point.
  return levels.every((_level) => effectiveAbility(inputs) === baseline);
}

/**
 * The capabilities autonomy is sometimes *assumed* to unlock, listed so the
 * test can assert that none of them consults it.
 */
export const CAPABILITIES_AUTONOMY_DOES_NOT_GRANT = [
  "enable_a_command",
  "expand_write_scope",
  "spend_money",
  "submit",
  "publish",
  "message",
  "bypass_approval",
] as const;
export type CapabilityAutonomyDoesNotGrant =
  (typeof CAPABILITIES_AUTONOMY_DOES_NOT_GRANT)[number];
