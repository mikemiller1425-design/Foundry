import type { FoundryEvent } from "@foundry/event-types";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { describe, expect, it } from "vitest";
import {
  deriveOperationalComparison,
  deriveOperationalSnapshot,
  selectEvidenceReferences,
} from "./operationalSnapshot";

describe("operational snapshot", () => {
  it("distinguishes durable evidence records from unverified references", () => {
    const events = [
      {
        id: "evidence-record",
        type: "agentrun.evidence_recorded",
        occurredAt: "2026-08-04T00:00:01.000Z",
        payload: { evidenceId: "evidence-1", agentRunId: "run-1", evidence: { secret: "x" } },
      },
      {
        id: "run-completed",
        type: "agentrun.completed",
        occurredAt: "2026-08-04T00:00:02.000Z",
        payload: {
          exitCode: 0,
          outputArtifactIds: [],
          evidenceIds: ["evidence-1", "evidence-2"],
        },
      },
    ] as unknown as FoundryEvent[];

    expect(selectEvidenceReferences(events)).toEqual([
      expect.objectContaining({ id: "evidence-1", state: "recorded", referenceCount: 2 }),
      expect.objectContaining({ id: "evidence-2", state: "reference-only", referenceCount: 1 }),
    ]);
  });

  it("counts unique completed stages and cumulative exception events", () => {
    const snapshot = deriveOperationalSnapshot(buildCanonicalScript("memory-snapshot-test"));
    expect(snapshot.buildStatus).toBe("completed");
    expect(snapshot.completedStages).toBeGreaterThan(0);
    expect(snapshot.exceptionEvents).toBeGreaterThan(0);
  });

  it("compares the current projection to exactly the previous operational event", () => {
    const events = buildCanonicalScript("memory-comparison-test");
    const comparison = deriveOperationalComparison(events);
    expect(comparison.current.latestEvent?.id).not.toBe(comparison.previous.latestEvent?.id);
    expect(
      (comparison.current.latestEvent?.occurredAt ?? "").localeCompare(
        comparison.previous.latestEvent?.occurredAt ?? "",
      ),
    ).toBeGreaterThanOrEqual(0);
  });
});
