import { WorldStateSchema } from "@foundry/contracts";
import { FoundryEventSchema } from "@foundry/event-types";
import { WORLD_AGENTS, WORLD_BUILDINGS } from "@foundry/world-model";
import { describe, expect, it } from "vitest";

// FBL-007: proves the three shared-contract packages import successfully
// into apps/agent-city and can validate a representative payload each.
describe("shared contracts import into apps/agent-city", () => {
  it("@foundry/contracts: WorldStateSchema validates a minimal world state", () => {
    const result = WorldStateSchema.safeParse({
      buildings: WORLD_BUILDINGS.map((b) => ({
        id: b.id,
        name: b.name,
        buildingType: b.buildingType,
        level: 1,
        status: "idle",
        position: b.position,
        capabilities: [],
        createdAt: "2026-07-30T00:00:00.000Z",
        updatedAt: "2026-07-30T00:00:00.000Z",
      })),
      agents: [],
      currentBuild: null,
      activeTransfers: [],
      approvals: [],
      inventoryCounts: {},
      health: { status: "healthy", reasons: ["nominal"] },
      lastProcessedEventId: null,
    });
    expect(result.success).toBe(true);
  });

  it("@foundry/event-types: FoundryEventSchema validates a system.started event", () => {
    const result = FoundryEventSchema.safeParse({
      id: "evt-1",
      type: "system.started",
      occurredAt: "2026-07-30T00:00:00.000Z",
      actorType: "backend",
      actorId: "backend-1",
      entityType: "System",
      entityId: "system-1",
      correlationId: "corr-1",
      severity: "info",
      schemaVersion: 1,
      payload: { serviceVersion: "1.0.0", neighborhoodId: "neighborhood-1" },
    });
    expect(result.success).toBe(true);
  });

  it("@foundry/world-model: identifiers are usable directly from the app", () => {
    expect(WORLD_BUILDINGS.length).toBe(9);
    expect(WORLD_AGENTS.length).toBe(3);
  });
});
