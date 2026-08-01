import { z } from "zod";
import { V1RiskClassSchema } from "@foundry/contracts";

/**
 * FBL-027 policy vocabulary (ADR-006).
 *
 * Everything here is deny-by-default by construction: a policy is an
 * *enumeration of what is permitted*, and the evaluators in
 * `containment/` only ever answer "allowed" when an explicit entry
 * matches. There is no wildcard, no "deny list" to keep in sync, and no
 * escape hatch — adding a capability requires editing a policy literal,
 * which is a reviewable diff.
 */

/**
 * One permitted argument position or family. Matching is exact-value or
 * a bounded enumeration; there is deliberately no regular-expression
 * matcher, because a permissive regex is the classic way an "allowlist"
 * silently becomes an allow-anything.
 */
export const ArgumentRuleSchema = z.discriminatedUnion("kind", [
  /** The argument must equal this exact literal. */
  z.object({ kind: z.literal("literal"), value: z.string().min(1) }),
  /** The argument must be one of a fixed, enumerated set. */
  z.object({ kind: z.literal("enum"), values: z.array(z.string().min(1)).min(1) }),
  /**
   * The argument is a path, and must canonicalize inside a declared
   * working-directory root. Path shape alone is never sufficient — the
   * containment check in `containment/paths.ts` is what actually decides.
   */
  z.object({ kind: z.literal("containedPath") }),
]);
export type ArgumentRule = z.infer<typeof ArgumentRuleSchema>;

/**
 * One permitted executable and the exact argument vectors it may receive.
 *
 * `executable` is matched against the *literal* command name requested —
 * never against a resolved path, and never through a shell. The runner
 * resolves it to an absolute path itself and spawns without a shell, so
 * the name here can never be reinterpreted as a command line.
 */
export const CommandRuleSchema = z.object({
  executable: z.string().min(1),
  /**
   * Positional rules. `args[i]` governs the i-th argument. An argument
   * vector longer than `args` is denied unless `variadicTail` is set.
   */
  args: z.array(ArgumentRuleSchema).default([]),
  /**
   * Optional rule applied to every argument beyond `args.length`. Used
   * for commands that take an unbounded list of contained paths (e.g.
   * `git add <path>...`). Still deny-by-default per element.
   */
  variadicTail: ArgumentRuleSchema.optional(),
  /** Maximum total argument count, an explicit bound even when variadic. */
  maxArgs: z.number().int().nonnegative().default(16),
});
export type CommandRule = z.infer<typeof CommandRuleSchema>;

export const ExecutionLimitsSchema = z.object({
  /** Wall-clock budget. On expiry the whole process tree is terminated. */
  timeoutMs: z
    .number()
    .int()
    .positive()
    .max(30 * 60_000),
  /** Hard cap on captured stdout, in bytes. Excess is dropped, not buffered. */
  maxStdoutBytes: z
    .number()
    .int()
    .positive()
    .max(64 * 1024 * 1024),
  /** Hard cap on captured stderr, in bytes. */
  maxStderrBytes: z
    .number()
    .int()
    .positive()
    .max(64 * 1024 * 1024),
  /** Hard cap on one evidence record's serialized size, in bytes. */
  maxEvidenceBytes: z
    .number()
    .int()
    .positive()
    .max(64 * 1024 * 1024),
  /** Grace period between SIGTERM and SIGKILL when terminating a tree. */
  killGraceMs: z.number().int().nonnegative().max(60_000).default(2_000),
});
export type ExecutionLimits = z.infer<typeof ExecutionLimitsSchema>;

export const RuntimePolicySchema = z.object({
  /** Stable policy identifier, recorded in every evidence record. */
  id: z.string().min(1),
  /**
   * Absolute paths that bound every filesystem effect of a run. Declared
   * roots are canonicalized (symlinks resolved) at policy-load time, so a
   * root that is itself a symlink is pinned to its real target.
   */
  workingDirectoryRoots: z.array(z.string().min(1)).min(1),
  /** The complete set of permitted commands. Empty means: run nothing. */
  allowedCommands: z.array(CommandRuleSchema).default([]),
  /**
   * Environment variable names that may reach the child process. The
   * child's environment is *built from nothing* and populated only from
   * this list — it never inherits the parent environment.
   */
  allowedEnvironmentVariables: z.array(z.string().min(1)).default([]),
  /**
   * The highest risk class this policy permits. V1 admits R0–R2 only
   * (principle 19); the schema makes R3–R5 unrepresentable rather than
   * merely discouraged.
   */
  maxRiskClass: V1RiskClassSchema,
  limits: ExecutionLimitsSchema,
  /** Whether network access is permitted. V1 default is `false`. */
  allowNetwork: z.boolean().default(false),
  /**
   * Directories searched to turn a bare executable name into an absolute
   * path. Declared explicitly rather than read from `PATH`, because a
   * `PATH`-driven lookup means whoever controls the environment chooses
   * which binary an allowlisted name actually runs — which would defeat
   * the command allowlist without ever appearing to violate it.
   */
  executableSearchPath: z
    .array(z.string().min(1))
    .default(["/usr/bin", "/bin", "/usr/local/bin", "/opt/homebrew/bin"]),
});
export type RuntimePolicy = z.infer<typeof RuntimePolicySchema>;

/** Ordering used to compare a request's risk class against the policy ceiling. */
export const RISK_CLASS_ORDER = { R0: 0, R1: 1, R2: 2 } as const;

/**
 * Parses and freezes a policy. Callers should treat the result as the
 * only legitimate source of permission — an adapter never accepts loose
 * allowlists at call time.
 */
export function defineRuntimePolicy(input: unknown): RuntimePolicy {
  const parsed = RuntimePolicySchema.parse(input);
  return Object.freeze({
    ...parsed,
    workingDirectoryRoots: Object.freeze([...parsed.workingDirectoryRoots]) as string[],
    allowedCommands: Object.freeze([...parsed.allowedCommands]) as CommandRule[],
    allowedEnvironmentVariables: Object.freeze([...parsed.allowedEnvironmentVariables]) as string[],
    limits: Object.freeze({ ...parsed.limits }),
  });
}
