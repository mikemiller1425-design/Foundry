import { describe, expect, it } from "vitest";
import { WORLD_AGENTS } from "./agents";
import { getWorldBuildingId, WORLD_BUILDINGS } from "./buildings";
import { ROAD_SEGMENTS } from "./roads";
import { WORLD_VEHICLE } from "./vehicle";
import {
  AGENT_STATE_VISUALS,
  BUILDING_STATE_VISUALS,
  LIGHTHOUSE_STATE_VISUALS,
  VEHICLE_STATE_VISUALS,
} from "./visualStates";

describe("world-model identifiers and layout", () => {
  it("defines exactly the nine required V1 buildings with unique ids", () => {
    expect(WORLD_BUILDINGS).toHaveLength(9);
    expect(new Set(WORLD_BUILDINGS.map((b) => b.id)).size).toBe(9);
  });

  it("defines exactly three residences of buildingType 'home'", () => {
    const homes = WORLD_BUILDINGS.filter((b) => b.buildingType === "home");
    expect(homes).toHaveLength(3);
  });

  it("getWorldBuildingId resolves a known building type and throws for an unknown one", () => {
    expect(getWorldBuildingId("lighthouse")).toBe("lighthouse");
    expect(() =>
      // @ts-expect-error intentionally invalid buildingType for the negative-path test
      getWorldBuildingId("not_a_real_type"),
    ).toThrow();
  });

  it("defines exactly the three required V1 agents, each with a valid home building", () => {
    expect(WORLD_AGENTS).toHaveLength(3);
    const buildingIds = new Set(WORLD_BUILDINGS.map((b) => b.id));
    for (const agent of WORLD_AGENTS) {
      expect(buildingIds.has(agent.homeBuildingId)).toBe(true);
    }
  });

  it("defines exactly one vehicle, homed at a valid building", () => {
    const buildingIds = new Set(WORLD_BUILDINGS.map((b) => b.id));
    expect(buildingIds.has(WORLD_VEHICLE.homeBuildingId)).toBe(true);
  });

  it("road segments only reference defined buildings", () => {
    const buildingIds = new Set(WORLD_BUILDINGS.map((b) => b.id));
    for (const segment of ROAD_SEGMENTS) {
      expect(buildingIds.has(segment.fromBuildingId)).toBe(true);
      expect(buildingIds.has(segment.toBuildingId)).toBe(true);
    }
  });

  it("visual-state maps cover every allowed state with no gaps", () => {
    expect(Object.keys(LIGHTHOUSE_STATE_VISUALS)).toEqual([
      "healthy",
      "active",
      "attention_required",
      "degraded",
      "critical",
      "disconnected",
    ]);
    expect(Object.keys(AGENT_STATE_VISUALS)).toHaveLength(8);
    expect(Object.keys(BUILDING_STATE_VISUALS)).toHaveLength(8);
    expect(Object.keys(VEHICLE_STATE_VISUALS)).toHaveLength(7);
  });
});
