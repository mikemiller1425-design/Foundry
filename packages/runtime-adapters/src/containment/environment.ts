import { allow, deny, type PolicyDecision } from "../denial";
import type { RuntimePolicy } from "../policy";

/**
 * Environment containment.
 *
 * The child environment is *constructed*, never inherited. Starting from
 * the parent environment and deleting known-sensitive names is the wrong
 * shape: it fails open for every name nobody thought of (`AWS_*`,
 * `GH_TOKEN`, `npm_config_//registry/:_authToken`, and whatever the next
 * tool invents). Building up from an empty object fails closed instead —
 * an unlisted variable simply does not exist for the child.
 */

/**
 * Names that may never be allowlisted, because they let a caller change
 * *which* binary runs or inject code into it — that would subvert the
 * command allowlist without ever violating it textually.
 */
const NEVER_ALLOWLISTABLE = new Set([
  "PATH",
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
  "DYLD_FRAMEWORK_PATH",
  "NODE_OPTIONS",
  "BASH_ENV",
  "ENV",
  "IFS",
  "PYTHONPATH",
  "PYTHONSTARTUP",
  "PERL5OPT",
  "GIT_SSH",
  "GIT_SSH_COMMAND",
  "GIT_EXTERNAL_DIFF",
  "GIT_PAGER",
]);

export interface BuiltEnvironment {
  env: Record<string, string>;
  /** Names the policy permitted that simply weren't present in the source. */
  missing: string[];
}

export function buildChildEnvironment(
  policy: RuntimePolicy,
  source: Record<string, string | undefined>,
  extra: Record<string, string> = {},
): PolicyDecision<BuiltEnvironment> {
  const env: Record<string, string> = Object.create(null) as Record<string, string>;
  const missing: string[] = [];

  for (const name of policy.allowedEnvironmentVariables) {
    if (NEVER_ALLOWLISTABLE.has(name)) {
      return deny(
        "environment_not_allowed",
        `Environment variable ${name} can redirect or inject into execution and may never be allowlisted.`,
        name,
      );
    }
    const value = source[name];
    if (value === undefined) {
      missing.push(name);
      continue;
    }
    env[name] = value;
  }

  // Values the adapter itself supplies (a run id, a contained working
  // directory) still have to be declared in the allowlist — the adapter
  // gets no privilege the policy did not grant it.
  for (const [name, value] of Object.entries(extra)) {
    if (!policy.allowedEnvironmentVariables.includes(name)) {
      return deny(
        "environment_not_allowed",
        `Adapter attempted to set a non-allowlisted environment variable: ${name}`,
        name,
      );
    }
    env[name] = value;
  }

  return allow({ env, missing });
}
