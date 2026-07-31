import { describe, expect, it } from "vitest";
import type { RoadSegmentDefinition } from "@foundry/world-model";
import { resolveRoadEndpoints } from "./roadNetwork";

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
