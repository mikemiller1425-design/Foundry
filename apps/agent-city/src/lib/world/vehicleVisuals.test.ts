import { describe, expect, it } from "vitest";
import { ALL_VEHICLE_STATUSES, VEHICLE_VISUALS, vehicleNonColorSignature } from "./vehicleVisuals";

describe("VEHICLE_VISUALS — every allowed status distinct, never color alone", () => {
  it("defines all seven allowed states (world-model.md 'Utility vehicle')", () => {
    expect(ALL_VEHICLE_STATUSES).toHaveLength(7);
    for (const status of ALL_VEHICLE_STATUSES) {
      expect(VEHICLE_VISUALS[status]).toBeDefined();
    }
  });

  it("no two statuses share an identical non-color signature (shape)", () => {
    const signatures = ALL_VEHICLE_STATUSES.map((status) =>
      vehicleNonColorSignature(VEHICLE_VISUALS[status]),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("defaults to parked with a distinct, neutral signature", () => {
    expect(VEHICLE_VISUALS.parked.shape).toBe("box");
  });
});
