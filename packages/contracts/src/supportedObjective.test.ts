import { describe, expect, it } from "vitest";
import {
  SUPPORTED_OBJECTIVE_TEMPLATES,
  isSupportedForRealExecution,
  matchSupportedObjective,
  normalizeObjectiveForMatching,
} from "./supportedObjective";

/**
 * AC-111 — the V1.1 objective decision.
 *
 * V1.1 supports exactly one objective template for real execution. These
 * tests exist to keep the matching rule **deterministic and narrow**: the
 * failure mode worth guarding is not "too strict", it is silently
 * accepting prose the pre-written independent tests do not describe.
 */

describe("matchSupportedObjective", () => {
  it("declares exactly one supported template for V1.1", () => {
    expect(SUPPORTED_OBJECTIVE_TEMPLATES).toHaveLength(1);
    expect(SUPPORTED_OBJECTIVE_TEMPLATES[0]?.id).toBe("task-store-module-v1");
  });

  it("matches the template's own example objective", () => {
    const template = SUPPORTED_OBJECTIVE_TEMPLATES[0]!;
    const result = matchSupportedObjective(template.exampleObjective);
    expect(result.supported).toBe(true);
  });

  it.each([
    "Add a JSON task store module with a test suite",
    "add a TASK STORE module, with tests",
    "  Build   a  task   store   module   plus  a   test  suite  ",
  ])("matches %j — case and whitespace are normalised", (objective) => {
    expect(isSupportedForRealExecution(objective)).toBe(true);
  });

  it.each([
    ["missing 'module'", "Add a task store with a test suite"],
    ["missing 'test'", "Add a JSON task store module"],
    ["missing 'task store'", "Add a persistence module with a test suite"],
    ["entirely unrelated", "Refactor the billing reconciliation pipeline end to end"],
    ["a UI for a task store, which these tests do not describe", "Build a task store UI"],
  ])("refuses when %s", (_label, objective) => {
    const result = matchSupportedObjective(objective);
    expect(result.supported).toBe(false);
  });

  it("explains the rule rather than merely refusing", () => {
    const result = matchSupportedObjective("Do something else entirely");
    expect(result.supported).toBe(false);
    if (result.supported) throw new Error("unreachable");
    // The operator learns what a supported objective must contain…
    expect(result.reason).toContain("task store");
    expect(result.reason).toContain("task-store-module-v1");
    // …and why the restriction exists at all.
    expect(result.reason).toMatch(/never write, modify, or run its own validation/i);
    expect(result.reason).toMatch(/deferred beyond V1\.1/i);
    // …and what they can still do.
    expect(result.correctiveAction).toMatch(/mock executor/i);
  });

  it("is deterministic — the same text always gives the same answer", () => {
    const objective = "Add a JSON task store module with a test suite";
    const first = matchSupportedObjective(objective);
    const second = matchSupportedObjective(objective);
    expect(first).toEqual(second);
  });

  it("does no stemming, no synonyms, and no scoring", () => {
    // "tests" contains "test", so this matches — substring, by design.
    expect(isSupportedForRealExecution("a task store module with tests")).toBe(true);
    // But a near-miss synonym does not, because there is no synonym table.
    expect(isSupportedForRealExecution("a task repository module with specs")).toBe(false);
  });

  it("normalises without altering meaning", () => {
    expect(normalizeObjectiveForMatching("  A  B \n C ")).toBe("a b c");
  });

  it("declares write paths and the independent test path on the template", () => {
    const template = SUPPORTED_OBJECTIVE_TEMPLATES[0]!;
    // H-6: permitted writes are a property of the template, never a caller argument.
    expect(template.allowedWritePaths).toEqual(["src/taskStore.js"]);
    // The Builder must not modify or run this file.
    expect(template.independentTestPath).toBe("test/taskStore.test.js");
    expect(template.allowedWritePaths).not.toContain(template.independentTestPath);
  });
});
