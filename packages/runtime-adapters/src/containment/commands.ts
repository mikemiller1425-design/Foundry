import { allow, deny, type PolicyDecision } from "../denial";
import type { ArgumentRule, CommandRule, RuntimePolicy } from "../policy";
import { resolveContainedPath, type ContainmentContext } from "./paths";

/**
 * Command policy evaluation (ADR-006 "command policy").
 *
 * Two independent defenses, deliberately kept independent:
 *
 * 1. The runner never uses a shell (`shell: false`, always), so
 *    metacharacters are inert data rather than syntax.
 * 2. This evaluator refuses them anyway.
 *
 * The second is not redundant with the first. A request containing `;`
 * or `$(...)` is an *injection attempt*, and the difference between
 * "inert" and "refused and recorded" is whether an operator ever finds
 * out it happened. Defense 1 makes exploitation impossible; defense 2
 * makes the attempt visible.
 */

/** Characters that carry meaning to a shell. Presence alone is a denial. */
const SHELL_METACHARACTERS = /[;&|<>$`\n\r(){}[\]!*?~#\\'"]/;

export interface ResolvedCommand {
  executable: string;
  /** Argument vector after path arguments are canonicalized to real paths. */
  args: string[];
}

export function evaluateCommand(
  policy: RuntimePolicy,
  context: ContainmentContext,
  executable: string,
  args: readonly string[],
): PolicyDecision<ResolvedCommand> {
  const metacharacterCheck = rejectMetacharacters(executable, args);
  if (!metacharacterCheck.allowed) return metacharacterCheck;

  const rule = policy.allowedCommands.find((candidate) => candidate.executable === executable);
  if (!rule) {
    return deny(
      "command_not_allowed",
      `Executable is not in the policy allowlist: ${executable}`,
      executable,
    );
  }

  if (args.length > rule.maxArgs) {
    return deny(
      "argument_count_exceeded",
      `Command ${executable} permits at most ${rule.maxArgs} arguments, received ${args.length}.`,
      executable,
    );
  }

  return resolveArguments(rule, context, executable, args);
}

function rejectMetacharacters(
  executable: string,
  args: readonly string[],
): PolicyDecision<never | true> {
  if (SHELL_METACHARACTERS.test(executable) || executable.includes("\0")) {
    return deny(
      "shell_metacharacter",
      "Executable name contains shell metacharacters.",
      executable,
    );
  }
  for (const [index, arg] of args.entries()) {
    if (SHELL_METACHARACTERS.test(arg) || arg.includes("\0")) {
      return deny(
        "shell_metacharacter",
        `Argument ${index} contains shell metacharacters, which is treated as an injection attempt.`,
        `argv[${index}]`,
      );
    }
  }
  return allow(true);
}

function resolveArguments(
  rule: CommandRule,
  context: ContainmentContext,
  executable: string,
  args: readonly string[],
): PolicyDecision<ResolvedCommand> {
  const resolved: string[] = [];

  for (const [index, arg] of args.entries()) {
    const argRule: ArgumentRule | undefined = rule.args[index] ?? rule.variadicTail;
    if (!argRule) {
      return deny(
        "argument_not_allowed",
        `Command ${executable} declares no rule for argument ${index}; extra arguments are denied.`,
        `argv[${index}]`,
      );
    }

    const decision = applyArgumentRule(argRule, context, executable, index, arg);
    if (!decision.allowed) return decision;
    resolved.push(decision.value);
  }

  return allow({ executable, args: resolved });
}

function applyArgumentRule(
  argRule: ArgumentRule,
  context: ContainmentContext,
  executable: string,
  index: number,
  arg: string,
): PolicyDecision<string> {
  switch (argRule.kind) {
    case "literal":
      return arg === argRule.value
        ? allow(arg)
        : deny(
            "argument_not_allowed",
            `Command ${executable} argument ${index} must be exactly "${argRule.value}".`,
            `argv[${index}]`,
          );

    case "enum":
      return argRule.values.includes(arg)
        ? allow(arg)
        : deny(
            "argument_not_allowed",
            `Command ${executable} argument ${index} is not one of the permitted values.`,
            `argv[${index}]`,
          );

    case "containedPath": {
      // A path argument is only as safe as its canonical location, so it
      // goes through the exact same containment decision every other
      // path in the system uses — no parallel, weaker check here.
      const contained = resolveContainedPath(context, arg);
      if (!contained.allowed) return contained;
      return allow(contained.value);
    }
  }
}
