import type { FoundryEvent } from "@foundry/event-types";
import { WORLD_AGENTS, WORLD_BUILDINGS, WORLD_VEHICLE } from "@foundry/world-model";
import { describe, expect, it } from "vitest";
import { resolveWorldTargetForEvent } from "./worldTargetForEvent";

/**
 * FBL-021A — "jump to world object" resolution.
 *
 * The property that matters is not "does it resolve" but **"does it ever
 * resolve to something it was not told"**. A navigation control that
 * guesses is worse than one that is unavailable: it moves the operator
 * somewhere confidently wrong and they have no way to tell. So the
 * negative cases are asserted as carefully as the positive ones.
 */

/**
 * `FoundryEvent` is a discriminated union, so `Partial<FoundryEvent>` cannot
 * express "this type with these few fields overridden". These fixtures are
 * about resolution behaviour, not schema conformance — the schemas are
 * enforced at construction in `eventFactory.ts` and covered by
 * `packages/event-types`. A loose input keeps the cases readable.
 */
function event(overrides: Record<string, unknown> & { type: string }): FoundryEvent {
  return {
    id: `evt-${overrides.type}-${Math.random()}`,
    occurredAt: "2026-07-30T00:00:00.000Z",
    actorType: "backend",
    actorId: "backend",
    entityType: "System",
    entityId: "system-1",
    correlationId: "build-1",
    severity: "info",
    schemaVersion: 1,
    payload: {},
    ...overrides,
  } as unknown as FoundryEvent;
}

const ARCHITECT = WORLD_AGENTS.find((a) => a.role === "architect")!;
const WAREHOUSE = WORLD_BUILDINGS.find((b) => b.buildingType === "warehouse")!;
const QA = WORLD_BUILDINGS.find((b) => b.buildingType === "qa")!;
const RESIDENCE = WORLD_BUILDINGS.find((b) => b.buildingType === "home")!;
const CONSTRUCTION_SITE = WORLD_BUILDINGS.find((b) => b.buildingType === "construction_site")!;

describe("resolveWorldTargetForEvent — resolvable events", () => {
  it("an agent event resolves to that agent, by its declared entityId", () => {
    const result = resolveWorldTargetForEvent(
      event({ type: "agent.departed", entityType: "Agent", entityId: ARCHITECT.id, payload: {} }),
    );
    expect(result.resolved).toBe(true);
    if (!result.resolved) return;
    expect(result.target.id).toBe(ARCHITECT.id);
    expect(result.target.kind).toBe("agent");
  });

  it("a building event resolves through its declared buildingId payload field", () => {
    const result = resolveWorldTargetForEvent(
      event({
        type: "building.state_changed",
        entityType: "Building",
        entityId: WAREHOUSE.id,
        payload: { buildingId: WAREHOUSE.id, state: "active", reasonEventId: "evt-1" },
      }),
    );
    expect(result.resolved).toBe(true);
    if (!result.resolved) return;
    expect(result.target.id).toBe(WAREHOUSE.id);
    expect(result.target.kind).toBe("building");
  });

  it("stage.started resolves to the building the work actually happens at", () => {
    const result = resolveWorldTargetForEvent(
      event({
        type: "stage.started",
        entityType: "BuildStage",
        entityId: "stage-1",
        payload: { assignedAgentIds: [ARCHITECT.id], sourceBuildingId: QA.id },
      }),
    );
    expect(result.resolved).toBe(true);
    if (!result.resolved) return;
    // Not the stage (not a world object) and not the agent — the declared
    // sourceBuildingId is the only field naming a place.
    expect(result.target.id).toBe(QA.id);
  });

  it("transfer.started resolves to the vehicle it declares", () => {
    const result = resolveWorldTargetForEvent(
      event({
        type: "transfer.started",
        entityType: "Transfer",
        entityId: "transfer-1",
        payload: {
          vehicleId: WORLD_VEHICLE.id,
          sourceBuildingId: WAREHOUSE.id,
          destinationBuildingId: QA.id,
          artifactIds: [],
        },
      }),
    );
    expect(result.resolved).toBe(true);
    if (!result.resolved) return;
    expect(result.target.id).toBe(WORLD_VEHICLE.id);
    expect(result.target.kind).toBe("vehicle");
  });

  it("upgrade.eligible resolves through its declared buildingId", () => {
    const result = resolveWorldTargetForEvent(
      event({
        type: "upgrade.eligible",
        entityType: "Upgrade",
        entityId: "upgrade-1",
        payload: { buildingId: WAREHOUSE.id, upgradeId: "upgrade-1", metrics: {} },
      }),
    );
    expect(result.resolved).toBe(true);
    if (!result.resolved) return;
    expect(result.target.id).toBe(WAREHOUSE.id);
  });

  it("approval.requested resolves to the Lighthouse — the declared attention surface", () => {
    const result = resolveWorldTargetForEvent(
      event({
        type: "approval.requested",
        entityType: "Approval",
        entityId: "approval-1",
        payload: { approvalId: "approval-1", subjectType: "Artifact", subjectId: "artifact-1" },
      }),
    );
    expect(result.resolved).toBe(true);
    if (!result.resolved) return;
    expect(result.target.id).toBe("lighthouse");
  });

  it("every V1 world-object category is reachable", () => {
    const reachable = [
      resolveWorldTargetForEvent(
        event({ type: "approval.requested", entityId: "a", payload: {} }),
      ),
      resolveWorldTargetForEvent(
        event({
          type: "building.state_changed",
          payload: { buildingId: RESIDENCE.id, state: "x", reasonEventId: "e" },
        }),
      ),
      resolveWorldTargetForEvent(
        event({
          type: "building.state_changed",
          payload: { buildingId: WAREHOUSE.id, state: "x", reasonEventId: "e" },
        }),
      ),
      resolveWorldTargetForEvent(
        event({
          type: "building.state_changed",
          payload: { buildingId: CONSTRUCTION_SITE.id, state: "x", reasonEventId: "e" },
        }),
      ),
      resolveWorldTargetForEvent(
        event({ type: "transfer.started", payload: { vehicleId: WORLD_VEHICLE.id } }),
      ),
      resolveWorldTargetForEvent(
        event({ type: "agent.arrived", entityId: ARCHITECT.id, payload: {} }),
      ),
    ];
    expect(reachable.every((r) => r.resolved)).toBe(true);
  });
});

describe("resolveWorldTargetForEvent — deliberately unresolvable events", () => {
  it.each([
    ["build.created", "Build"],
    ["requirement.failed", "Requirement"],
    ["artifact.created", "Artifact"],
    ["system.started", "System"],
    ["agentrun.started", "AgentRun"],
  ])("%s has no world object and says so", (type) => {
    const result = resolveWorldTargetForEvent(event({ type }));
    expect(result.resolved).toBe(false);
    if (result.resolved) return;
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it("transfer.completed does not fall back to the vehicle — it declares no world object", () => {
    // The receipt artifact is not a world object, and assuming "the
    // vehicle" here would be exactly the fabricated jump this forbids.
    const result = resolveWorldTargetForEvent(
      event({
        type: "transfer.completed",
        entityType: "Transfer",
        entityId: "transfer-1",
        payload: { receiptArtifactId: "artifact-1" },
      }),
    );
    expect(result.resolved).toBe(false);
  });

  it("upgrade.completed does not assume the Warehouse — its contract carries no buildingId", () => {
    const result = resolveWorldTargetForEvent(
      event({
        type: "upgrade.completed",
        entityType: "Upgrade",
        entityId: "upgrade-1",
        payload: { fromLevel: 1, toLevel: 2, capabilitiesAdded: ["capacity_100"] },
      }),
    );
    expect(result.resolved).toBe(false);
  });

  it("an id that names nothing in the world does not resolve", () => {
    const result = resolveWorldTargetForEvent(
      event({
        type: "building.state_changed",
        payload: { buildingId: "building-that-does-not-exist", state: "x", reasonEventId: "e" },
      }),
    );
    expect(result.resolved).toBe(false);
  });

  it("resolution never depends on display names — renaming an id breaks the match, not a name lookup", () => {
    const result = resolveWorldTargetForEvent(
      event({ type: "agent.arrived", entityId: "Architect", payload: {} }),
    );
    // "Architect" is the display *name*, not the declared id. A
    // name-guessing implementation would resolve this; a declared-id one
    // must not.
    expect(result.resolved).toBe(false);
  });

  it("is pure: resolving does not mutate the event", () => {
    const source = event({
      type: "transfer.started",
      payload: { vehicleId: WORLD_VEHICLE.id },
    });
    const snapshot = JSON.stringify(source);
    resolveWorldTargetForEvent(source);
    expect(JSON.stringify(source)).toBe(snapshot);
  });
});
