/**
 * The closed vocabulary of reasons the boundary refuses to run something.
 *
 * Denials are first-class, structured, and always retained as evidence
 * (principle 17: failures remain inspectable). A denial is never an
 * exception thrown into the void and never a silent "returned nothing".
 */
export const DENIAL_CODES = [
  "policy_invalid",
  "risk_class_not_permitted",
  "command_not_allowed",
  "argument_not_allowed",
  "argument_count_exceeded",
  "shell_metacharacter",
  "path_outside_root",
  "path_traversal",
  "symlink_escape",
  "path_unresolvable",
  "environment_not_allowed",
  "network_not_allowed",
  "working_directory_not_declared",
] as const;

export type DenialCode = (typeof DENIAL_CODES)[number];

export interface PolicyDenial {
  code: DenialCode;
  /** Operator-readable explanation. Already redacted by the caller. */
  message: string;
  /** What was rejected (a command name, an argument index, a path). */
  subject?: string;
}

export type PolicyDecision<T> =
  { allowed: true; value: T } | { allowed: false; denial: PolicyDenial };

export function deny(code: DenialCode, message: string, subject?: string): PolicyDecision<never> {
  return { allowed: false, denial: { code, message, subject } };
}

export function allow<T>(value: T): PolicyDecision<T> {
  return { allowed: true, value };
}
