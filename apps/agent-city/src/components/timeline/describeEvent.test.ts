import type { FoundryEvent } from "@foundry/event-types";
import { describe, expect, it } from "vitest";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { describeEvent } from "./describeEvent";

describe("describeEvent", () => {
  it("produces a non-empty readable summary for every event in the canonical script", () => {
    const script = buildCanonicalScript("describe-check");
    for (const event of script) {
      const summary = describeEvent(event);
      expect(typeof summary).toBe("string");
      expect(summary.length).toBeGreaterThan(0);
      expect(summary).not.toMatch(/undefined/);
    }
  });

  it("gives a specific, meaningful message for the intentional requirement failure", () => {
    const script = buildCanonicalScript("describe-failure");
    const failed = script.find((e) => e.type === "requirement.failed")!;
    expect(describeEvent(failed)).toContain("Requirement failed");
    expect(describeEvent(failed)).toContain("error state");
  });

  it("gives a specific message for build.completed and upgrade.completed", () => {
    const script = buildCanonicalScript("describe-completion");
    const buildCompleted = script.find((e) => e.type === "build.completed")!;
    const upgradeCompleted = script.find((e) => e.type === "upgrade.completed")!;
    expect(describeEvent(buildCompleted)).toBe("Build completed");
    expect(describeEvent(upgradeCompleted)).toContain("level 1 → 2");
  });
});

/**
 * AC-103 regression — the objective is displayed exactly once.
 *
 * Submitting an objective produces two events that both carry the
 * objective text in their payload. Both descriptions used to quote it, so
 * the operator read the same sentence in two consecutive rows and
 * reasonably concluded the objective had been submitted twice. Only the
 * row that reports the submission states the text.
 */
describe("describeEvent — the submitted objective appears once (AC-103)", () => {
  const OBJECTIVE = "Add a JSON task store module with a test suite";

  function objectiveSubmitted(): FoundryEvent {
    return {
      id: "evt-1",
      type: "operator.objective_submitted",
      occurredAt: "2026-08-03T00:00:00.000Z",
      actorType: "operator",
      actorId: "operator-1",
      entityType: "Project",
      entityId: "project-1",
      correlationId: "project-1",
      severity: "info",
      schemaVersion: 1,
      payload: { objective: OBJECTIVE, projectId: "project-1" },
    } as FoundryEvent;
  }

  function buildCreated(): FoundryEvent {
    return {
      id: "evt-2",
      type: "build.created",
      occurredAt: "2026-08-03T00:00:01.000Z",
      actorType: "operator",
      actorId: "operator-1",
      entityType: "Build",
      entityId: "build-1",
      correlationId: "build-1",
      severity: "info",
      schemaVersion: 1,
      payload: { projectId: "project-1", buildId: "build-1", objective: OBJECTIVE },
    } as FoundryEvent;
  }

  it("quotes the objective in exactly one of the two rows a submission produces", () => {
    const rows = [objectiveSubmitted(), buildCreated()].map(describeEvent);
    expect(rows.filter((row) => row.includes(OBJECTIVE))).toHaveLength(1);
  });

  it("states the objective on the row that reports its submission", () => {
    expect(describeEvent(objectiveSubmitted())).toBe(
      `Operator submitted objective: "${OBJECTIVE}"`,
    );
  });

  it("reports the new fact on the build row without repeating the objective", () => {
    const row = describeEvent(buildCreated());
    expect(row).toBe("Build created for the submitted objective");
    expect(row).not.toContain(OBJECTIVE);
  });

  it("still carries the objective in the payload, so nothing is lost from the inspector", () => {
    expect((buildCreated().payload as { objective: string }).objective).toBe(OBJECTIVE);
  });
});
