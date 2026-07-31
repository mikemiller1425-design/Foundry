import { describe, expect, it } from "vitest";
import {
  ALL_BUILDING_STATUSES,
  OPERATIONAL_BUILDING_VISUALS,
  operationalBuildingNonColorSignature,
} from "./operationalBuildingVisuals";

describe("OPERATIONAL_BUILDING_VISUALS — every allowed status distinct, never color alone", () => {
  it("defines all eight domain-model.md Building statuses", () => {
    expect(ALL_BUILDING_STATUSES).toHaveLength(8);
    for (const status of ALL_BUILDING_STATUSES) {
      expect(OPERATIONAL_BUILDING_VISUALS[status]).toBeDefined();
    }
  });

  it("no two statuses share an identical non-color signature (shape)", () => {
    const signatures = ALL_BUILDING_STATUSES.map((status) =>
      operationalBuildingNonColorSignature(OPERATIONAL_BUILDING_VISUALS[status]),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("no two statuses share an identical color either", () => {
    const colors = ALL_BUILDING_STATUSES.map((status) => OPERATIONAL_BUILDING_VISUALS[status].color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
