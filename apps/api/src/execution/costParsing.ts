/**
 * Reading what a controlled run actually cost (AC-111, H-2).
 *
 * ## Why this is not optional
 *
 * Before this rung, the entire budget control was one argument handed to
 * Claude Code — `--max-budget-usd` — and Foundry never looked at the
 * result. That made spend the **only** guarantee at this boundary enforced
 * wholly by the thing being constrained. Every other one is enforced from
 * outside: argv by the allowlist, write scope by a git diff, correctness
 * by an independent test suite. `F-116` states the principle directly —
 * the runtime's own stdout is never consulted as a verdict — and a budget
 * nobody checks is the same mistake wearing a different hat.
 *
 * ## Fail closed, always
 *
 * A missing, malformed, non-finite, or negative cost is a **failed run**,
 * never zero. The difference matters: "the run cost nothing" and "we do
 * not know what the run cost" are opposite statements, and only one of
 * them is safe to record. If a future Claude Code release renames or drops
 * the field, this surfaces immediately as a containment failure rather
 * than as a silent stream of free-looking runs.
 *
 * ## Detection, not prevention
 *
 * Stated plainly: this runs **after** the money is spent. It cannot stop
 * an overspend; it can only refuse to call one a success. That is still
 * worth having — an unnoticed overspend recurs, and a recorded one does
 * not — but it must not be described as a spend limit. The limit is
 * `--max-budget-usd`, enforced by the runtime; this is Foundry checking
 * whether the limit held.
 */

/**
 * Field names accepted as the run's total cost, in order of preference.
 *
 * More than one is listed because the exact key cannot be confirmed
 * without a real invocation, which this rung prohibits. Listing candidates
 * is not guessing: if **none** is present the result fails closed, so an
 * unrecognised shape produces a failed run rather than an invented number.
 * The manifest records this as unverified.
 */
export const COST_FIELD_CANDIDATES = ["total_cost_usd", "cost_usd", "totalCostUsd"] as const;

export type CostParseResult =
  | { ok: true; costUsd: number; field: string }
  | { ok: false; code: "unparseable_output" | "missing_cost" | "invalid_cost"; reason: string };

/**
 * Extracts the total cost from a controlled run's structured stdout.
 *
 * The run is invoked with `--output-format json`, so stdout is expected to
 * be one JSON object. Anything else — truncated capture, a plain-text
 * error, an empty string — is unparseable and fails closed.
 */
export function parseRunCostUsd(stdout: string): CostParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return {
      ok: false,
      code: "unparseable_output",
      reason:
        "The run's stdout is not valid JSON, so its cost cannot be read. The run was invoked with `--output-format json`; a non-JSON result means the run did not complete as expected, or its output was truncated by the capture limit.",
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      code: "unparseable_output",
      reason: "The run's structured output is not a JSON object, so its cost cannot be read.",
    };
  }

  const record = parsed as Record<string, unknown>;
  const field = COST_FIELD_CANDIDATES.find((candidate) => candidate in record);

  if (field === undefined) {
    return {
      ok: false,
      code: "missing_cost",
      reason: `The run's structured output carries no recognised cost field (looked for: ${COST_FIELD_CANDIDATES.join(
        ", ",
      )}). The cost is treated as unknown, never as zero — "the run cost nothing" and "we do not know what the run cost" are opposite statements.`,
    };
  }

  const raw = record[field];
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
    return {
      ok: false,
      code: "invalid_cost",
      reason: `The run's cost field \`${field}\` is not a finite non-negative number (received ${JSON.stringify(
        raw,
      )}). A cost that cannot be trusted is treated as unknown.`,
    };
  }

  return { ok: true, costUsd: raw, field };
}

export interface BudgetOutcome {
  authorizedCeilingUsd: number;
  actualCostUsd: number;
  withinCeiling: boolean;
}

/**
 * Compares actual spend to the ceiling the operator authorized.
 *
 * An over-ceiling result is a **containment failure**, and is reported as
 * one even though the money is already gone. Recording it as a success
 * with a footnote would train a reader to ignore the number.
 */
export function evaluateBudget(authorizedCeilingUsd: number, actualCostUsd: number): BudgetOutcome {
  return {
    authorizedCeilingUsd,
    actualCostUsd,
    withinCeiling: actualCostUsd <= authorizedCeilingUsd,
  };
}
