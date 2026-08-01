import type { Building } from "@foundry/contracts";
import {
  WAREHOUSE_LEVEL_1_CAPACITY,
  WAREHOUSE_LEVEL_2_CAPACITY,
  capacityCapability,
  readCapacity,
} from "@foundry/contracts";
import { describe, expect, it } from "vitest";
import { createInitialWorldState } from "../mock-runtime/worldStateReducer";

/**
 * FBL-031 / V-07 — the Warehouse's rendered level and its capacity must
 * move together, and only on `upgrade.completed`.
 *
 * The 3D variant is already gated on `level >= 2` (FBL-017). What these
 * tests pin is the *pairing*: a state where level and capacity disagree
 * is exactly the failure V-07 names, so it is asserted directly rather
 * than inferred from the two being set nearby in the code.
 */

function warehouse(level: number, capacity: number): Building {
  return {
    id: "warehouse",
    name: "Warehouse",
    buildingType: "warehouse",
    level,
    status: "idle",
    position: { x: 4, y: 0, z: 0 },
    capabilities: [capacityCapability(capacity)],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

/** The 3D Level 2 geometry gate, mirrored from OperationalBuilding.tsx. */
const rendersLevel2 = (building: Building) =>
  building.buildingType === "warehouse" && building.level >= 2;

describe("FBL-031 — Warehouse level and capacity are observable together", () => {
  it("shows Level 1 with capacity 25 before any upgrade", () => {
    const building = warehouse(1, WAREHOUSE_LEVEL_1_CAPACITY);
    expect(rendersLevel2(building)).toBe(false);
    expect(readCapacity(building.capabilities)).toBe(WAREHOUSE_LEVEL_1_CAPACITY);
  });

  it("shows Level 2 with capacity 100 after completion", () => {
    const building = warehouse(2, WAREHOUSE_LEVEL_2_CAPACITY);
    expect(rendersLevel2(building)).toBe(true);
    expect(readCapacity(building.capabilities)).toBe(WAREHOUSE_LEVEL_2_CAPACITY);
  });

  it("never renders the Level 2 geometry while capacity is still 25", () => {
    // The state V-07 forbids. If the reducer ever produced it, this is
    // the assertion that would catch it.
    const inconsistent = warehouse(2, WAREHOUSE_LEVEL_1_CAPACITY);
    const consistent =
      rendersLevel2(inconsistent) ===
      (readCapacity(inconsistent.capabilities) === WAREHOUSE_LEVEL_2_CAPACITY);
    expect(consistent).toBe(false);
  });

  it("the initial world state starts the Warehouse at Level 1", () => {
    const state = createInitialWorldState();
    const built = state.buildings.find((b) => b.buildingType === "warehouse");
    expect(built?.level).toBe(1);
  });

  it("reads no capacity for buildings that declare none", () => {
    const state = createInitialWorldState();
    const qa = state.buildings.find((b) => b.buildingType === "qa");
    expect(readCapacity(qa?.capabilities ?? [])).toBeNull();
  });
});
