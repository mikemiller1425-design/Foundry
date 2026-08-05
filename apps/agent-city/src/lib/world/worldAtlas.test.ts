import { describe, expect, it } from "vitest";
import {
  FOUNDRY_DISTRICTS,
  FOUNDRY_PARCELS,
  findFoundryDistrict,
  findFoundryParcel,
} from "./worldAtlas";

describe("fixture world atlas", () => {
  it("keeps every parcel inside a declared district with unique ids", () => {
    const districtIds = new Set(FOUNDRY_DISTRICTS.map((district) => district.id));
    const parcelIds = FOUNDRY_PARCELS.map((parcel) => parcel.id);

    expect(new Set(parcelIds).size).toBe(parcelIds.length);
    expect(FOUNDRY_PARCELS.every((parcel) => districtIds.has(parcel.districtId))).toBe(true);
  });

  it("includes an explicitly unassigned parcel without inventing a tenant", () => {
    const futureYard = findFoundryParcel("future-yard");
    expect(futureYard).toMatchObject({ tenure: "unassigned", tenant: null });
  });

  it("resolves catalog entries without falling back to invented records", () => {
    expect(findFoundryDistrict("agent-city-operations")?.label).toBe("Agent City Operations");
    expect(findFoundryParcel("not-real")).toBeUndefined();
  });

  it("keeps only the implemented fixture district enterable", () => {
    const active = FOUNDRY_DISTRICTS.filter((district) => district.status === "active-fixture");
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ id: "agent-city-operations", center: expect.any(Array) });
    expect(
      FOUNDRY_DISTRICTS.filter((district) => district.status === "uncommissioned").every(
        (district) => district.center === undefined,
      ),
    ).toBe(true);
  });
});
