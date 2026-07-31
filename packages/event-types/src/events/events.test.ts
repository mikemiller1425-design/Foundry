import { describe, expect, it } from "vitest";
import { EVENT_TYPES, FoundryEventSchema } from ".";

const base = {
  id: "evt-1",
  occurredAt: "2026-07-30T00:00:00.000Z",
  actorType: "backend" as const,
  actorId: "backend-1",
  entityType: "Build",
  entityId: "build-1",
  correlationId: "corr-1",
  severity: "info" as const,
  schemaVersion: 1,
};

describe("FoundryEventSchema", () => {
  it("accepts a valid system.started event", () => {
    const result = FoundryEventSchema.safeParse({
      ...base,
      type: "system.started",
      payload: { serviceVersion: "1.0.0", neighborhoodId: "neighborhood-1" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid build.completed event", () => {
    const result = FoundryEventSchema.safeParse({
      ...base,
      type: "build.completed",
      entityType: "Build",
      payload: { finalArtifactIds: ["artifact-1"], completedAt: base.occurredAt },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an event type outside the authoritative vocabulary", () => {
    const result = FoundryEventSchema.safeParse({
      ...base,
      type: "build.upgrade_completed", // archived-era name; never valid in V1
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects a known event type with a malformed payload", () => {
    const result = FoundryEventSchema.safeParse({
      ...base,
      type: "build.completed",
      payload: { finalArtifactIds: "not-an-array", completedAt: base.occurredAt },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an envelope missing a required field (correlationId)", () => {
    const { correlationId: _omit, ...withoutCorrelationId } = base;
    void _omit;
    const result = FoundryEventSchema.safeParse({
      ...withoutCorrelationId,
      type: "system.started",
      payload: { serviceVersion: "1.0.0", neighborhoodId: "neighborhood-1" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts an envelope with an optional causationId", () => {
    const result = FoundryEventSchema.safeParse({
      ...base,
      causationId: "evt-0",
      type: "revision.requested",
      entityType: "Revision",
      payload: {
        revisionId: "revision-1",
        stageId: "stage-1",
        reason: "Requirement failed",
        requestedBy: "approval",
      },
    });
    expect(result.success).toBe(true);
  });

  it("EVENT_TYPES enumerates the full, authoritative V1 vocabulary with no duplicates", () => {
    expect(EVENT_TYPES.length).toBeGreaterThan(60);
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length);
    expect(EVENT_TYPES).toContain("system.started");
    expect(EVENT_TYPES).toContain("requirement.passed");
    expect(EVENT_TYPES).not.toContain("requirement.completed");
    expect(EVENT_TYPES).toContain("agent.returned_home");
    expect(EVENT_TYPES).toContain("transfer.blocked");
    expect(EVENT_TYPES).toContain("stage.ready");
    expect(EVENT_TYPES).toContain("build.ready");
    expect(EVENT_TYPES).toContain("build.resumed");
  });

  it("idempotency: two events sharing the same id are structurally valid individually (consumer dedupes by id)", () => {
    const a = FoundryEventSchema.safeParse({
      ...base,
      type: "stage.created",
      entityType: "BuildStage",
      payload: {},
    });
    const b = FoundryEventSchema.safeParse({
      ...base,
      type: "stage.created",
      entityType: "BuildStage",
      payload: {},
    });
    expect(a.success && b.success).toBe(true);
    if (a.success && b.success) {
      expect(a.data.id).toBe(b.data.id);
    }
  });
});
