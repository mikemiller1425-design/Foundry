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

  // An executable may appear more than once, each entry describing one
  // permitted argument vector — `git status --porcelain` and `git diff`
  // are different capabilities and deserve separate, separately
  // reviewable rules rather than one loose rule covering both.
  const rules = policy.allowedCommands.filter((candidate) => candidate.executable === executable);
  if (rules.length === 0) {
    return deny(
      "command_not_allowed",
      `Executable is not in the policy allowlist: ${executable}`,
      executable,
    );
  }

  let bestDenial: PolicyDecision<ResolvedCommand> | undefined;
  let bestMatched = -1;

  for (const rule of rules) {
    if (args.length > rule.maxArgs) {
      if (bestMatched < 0) {
        bestDenial = deny(
          "argument_count_exceeded",
          `Command ${executable} permits at most ${rule.maxArgs} arguments, received ${args.length}.`,
          executable,
        );
        bestMatched = 0;
      }
      continue;
    }

    const attempt = resolveArguments(rule, context, executable, args);
    if (attempt.decision.allowed) return attempt.decision;

    // Report the denial from whichever rule got furthest, so the
    // evidence names the argument that actually failed rather than
    // whatever the first listed rule happened to object to.
    if (attempt.matched > bestMatched) {
      bestMatched = attempt.matched;
      bestDenial = attempt.decision;
    }
  }

  return (
    bestDenial ??
    deny(
      "argument_not_allowed",
      `No allowlist rule matches this invocation of ${executable}.`,
      executable,
    )
  );
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

interface ArgumentAttempt {
  decision: PolicyDecision<ResolvedCommand>;
  /** How many leading arguments this rule accepted before failing. */
  matched: number;
}

function resolveArguments(
  rule: CommandRule,
  context: ContainmentContext,
  executable: string,
  args: readonly string[],
): ArgumentAttempt {
  const resolved: string[] = [];

  for (const [index, arg] of args.entries()) {
    const argRule: ArgumentRule | undefined = rule.args[index] ?? rule.variadicTail;
    if (!argRule) {
      return {
        matched: index,
        decision: deny(
          "argument_not_allowed",
          `Command ${executable} declares no rule for argument ${index}; extra arguments are denied.`,
          `argv[${index}]`,
        ),
      };
    }

    const decision = applyArgumentRule(argRule, context, executable, index, arg);
    if (!decision.allowed) return { matched: index, decision };
    resolved.push(decision.value);
  }

  // A rule that declares more positional arguments than were supplied
  // has not matched: `git commit -m <msg>` must not be satisfied by a
  // bare `git commit`.
  if (args.length < rule.args.length) {
    return {
      matched: args.length,
      decision: deny(
        "argument_not_allowed",
        `Command ${executable} requires ${rule.args.length} arguments, received ${args.length}.`,
        executable,
      ),
    };
  }

  return { matched: args.length, decision: allow({ executable, args: resolved }) };
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
