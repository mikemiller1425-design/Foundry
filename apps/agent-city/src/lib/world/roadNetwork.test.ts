import type { Transfer } from "@foundry/contracts";
import { describe, expect, it } from "vitest";
import type { RoadSegmentDefinition } from "@foundry/world-model";
import { computeActiveRoadSegmentId, resolveRoadEndpoints } from "./roadNetwork";

function transfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: "t1",
    buildId: "b1",
    stageId: "s1",
    leg: "construction_office_to_warehouse",
    status: "in_transit",
    sourceBuildingId: "construction-office",
    destinationBuildingId: "warehouse",
    artifactIds: [],
    vehicleId: "vehicle-utility-1",
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

// FBL-018 required automated test: a render/geometry smoke test connecting
// the required location pairs (world-model.md "Road network" ->
// Relationships), and a failure test proving an invalid segment (naming a
// building that doesn't exist) is rejected rather than silently rendered.
describe("resolveRoadEndpoints", () => {
  it("resolves every declared segment to real building positions, connecting exactly the required pairs", () => {
    const resolved = resolveRoadEndpoints();
    const pairs = resolved.map((r) => [r.segment.fromBuildingId, r.segment.toBuildingId]);

    expect(pairs).toContainEqual(["home-architect", "construction-office"]);
    expect(pairs).toContainEqual(["home-builder", "construction-office"]);
    expect(pairs).toContainEqual(["home-inspector", "construction-office"]);
    expect(pairs).toContainEqual(["construction-office", "warehouse"]);
    expect(pairs).toContainEqual(["warehouse", "qa"]);
    expect(pairs).toContainEqual(["qa", "deployment-dock"]);
    expect(resolved).toHaveLength(6);

    for (const r of resolved) {
      expect(r.from).toBeDefined();
      expect(r.to).toBeDefined();
    }
  });

  it("never connects a building to itself", () => {
    const resolved = resolveRoadEndpoints();
    for (const r of resolved) {
      expect(r.segment.fromBuildingId).not.toBe(r.segment.toBuildingId);
    }
  });

  it("throws for a segment naming a building that does not exist, rather than silently rendering a route to nowhere", () => {
    const bogus: RoadSegmentDefinition = {
      id: "road-bogus",
      fromBuildingId: "warehouse",
      toBuildingId: "does-not-exist",
    };
    expect(() => resolveRoadEndpoints([bogus])).toThrow(/does-not-exist/);
  });
});

describe("computeActiveRoadSegmentId — highlights a declared route, never authorizes a transfer", () => {
  it("returns null with no active transfer", () => {
    expect(computeActiveRoadSegmentId(undefined)).toBeNull();
  });

  it("returns null before transfer.started (created/blocked/ready/loading) — no route highlighted yet", () => {
    for (const status of ["created", "blocked", "ready", "loading"] as const) {
      expect(computeActiveRoadSegmentId(transfer({ status }))).toBeNull();
    }
  });

  it("highlights the matching segment while in_transit", () => {
    expect(computeActiveRoadSegmentId(transfer({ status: "in_transit" }))).toBe(
      "road-office-warehouse",
    );
  });

  it("highlights the matching segment while unloading (arrived, not yet complete)", () => {
    expect(computeActiveRoadSegmentId(transfer({ status: "unloading" }))).toBe(
      "road-office-warehouse",
    );
  });

  it("returns null if no declared segment connects the transfer's endpoints — never fabricates a route", () => {
    const t = transfer({
      status: "in_transit",
      sourceBuildingId: "home-architect",
      destinationBuildingId: "deployment-dock",
    });
    expect(computeActiveRoadSegmentId(t)).toBeNull();
  });
});
