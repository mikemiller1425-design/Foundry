import { z } from "zod";

/**
 * Supported objective templates for real execution (AC-111).
 *
 * ## The decision this encodes
 *
 * V1.1 supports **exactly one** objective template for real execution, and
 * says so out loud. The alternative — accepting arbitrary prose and hoping
 * the pre-written independent tests happen to describe it — would break
 * the guarantee the whole mission rests on:
 *
 * > The Builder cannot write, modify, or execute its own validation.
 * > `v1.1-mission.md` calls this "the load-bearing guarantee of the entire
 * > mission" and "non-negotiable."
 *
 * A general objective needs a generated test suite, and whatever generates
 * it must not be the Builder. That is a real design problem with real
 * options (an Architect that emits executable criteria; a second, separately
 * authorized model invocation), and **general objective-to-test generation
 * is deferred beyond V1.1**. Pretending otherwise by accepting any text and
 * running fixed tests against it would be the dishonest version.
 *
 * ## What "matching" means here
 *
 * Matching is a **deterministic keyword conjunction over normalised text**,
 * not interpretation. An objective matches a template when every one of the
 * template's `requiredTerms` appears in the normalised objective. There is
 * no model, no fuzzy matching, no synonym table, and no scoring — those
 * would all be ways of silently reinterpreting what the operator asked for.
 *
 * An objective that does not match is **refused, with the rule stated**, so
 * the operator learns what a supported objective must contain rather than
 * being told "no".
 *
 * The mock orchestration (AC-109) is unaffected: it runs any bounded
 * objective, because nothing there executes. This gate applies only where
 * real execution is at stake.
 */

export const SupportedObjectiveIdSchema = z.enum(["task-store-module-v1"]);
export type SupportedObjectiveId = z.infer<typeof SupportedObjectiveIdSchema>;

export interface SupportedObjectiveTemplate {
  /** Stable identifier, recorded in the authorization and in evidence. */
  id: SupportedObjectiveId;
  /** One line an operator can read. */
  summary: string;
  /**
   * Every term must be present in the normalised objective. Lower-case;
   * matching is substring-on-normalised-text, so multi-word terms are
   * matched as phrases.
   */
  requiredTerms: readonly string[];
  /**
   * Relative paths the controlled stage may modify. **Derived from the
   * template, never from a caller argument** — a call site that could
   * widen this would widen containment without touching a policy file.
   */
  allowedWritePaths: readonly string[];
  /**
   * The independent test file Foundry runs. Written by the fixture in
   * advance; the Builder is told not to modify it and, having no shell,
   * could not run it either.
   */
  independentTestPath: string;
  /** What the operator is shown when their objective does not match. */
  exampleObjective: string;
}

export const SUPPORTED_OBJECTIVE_TEMPLATES: readonly SupportedObjectiveTemplate[] = [
  {
    id: "task-store-module-v1",
    summary:
      "A single ES module exporting `createTaskStore`, with add/complete/delete/serialise behaviour, judged by a pre-written independent test suite.",
    // Deliberately specific. "task store" alone would match an objective
    // about a UI for a task store, which these tests do not describe.
    requiredTerms: ["task store", "module", "test"],
    allowedWritePaths: ["src/taskStore.js"],
    independentTestPath: "test/taskStore.test.js",
    exampleObjective: "Add a JSON task store module with a test suite",
  },
] as const;

/** Lower-case, collapse whitespace. No stemming, no synonyms, no scoring. */
export function normalizeObjectiveForMatching(objective: string): string {
  return objective.toLowerCase().replace(/\s+/g, " ").trim();
}

export type SupportedObjectiveMatch =
  | { supported: true; template: SupportedObjectiveTemplate }
  | { supported: false; reason: string; correctiveAction: string };

/**
 * Resolves an objective to a supported template, or explains why not.
 *
 * Total and deterministic: same text in, same answer out, with no clock,
 * no randomness, and no state. The refusal names the rule rather than
 * merely reporting failure.
 */
export function matchSupportedObjective(objective: string): SupportedObjectiveMatch {
  const normalized = normalizeObjectiveForMatching(objective);

  for (const template of SUPPORTED_OBJECTIVE_TEMPLATES) {
    if (template.requiredTerms.every((term) => normalized.includes(term))) {
      return { supported: true, template };
    }
  }

  const requirements = SUPPORTED_OBJECTIVE_TEMPLATES.map(
    (template) =>
      `\`${template.id}\` requires all of: ${template.requiredTerms
        .map((term) => `"${term}"`)
        .join(", ")} (example: "${template.exampleObjective}")`,
  ).join("; ");

  return {
    supported: false,
    reason:
      `This objective does not match any supported execution template, so there is no independent test suite that describes it. ` +
      `V1.1 supports exactly one template for real execution because the Builder must never write, modify, or run its own validation — ` +
      `a general objective would need a generated test suite, and generating one is deferred beyond V1.1. ${requirements}.`,
    correctiveAction:
      "Submit an objective matching a supported template, or run this build with the mock executor, which accepts any bounded objective because nothing executes.",
  };
}

/** True when real execution could be authorized for this objective. */
export function isSupportedForRealExecution(objective: string): boolean {
  return matchSupportedObjective(objective).supported;
}
