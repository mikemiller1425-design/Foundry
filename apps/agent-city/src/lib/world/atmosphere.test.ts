import { describe, expect, it } from "vitest";
import { ATMOSPHERES, atmosphereById } from "./atmosphere";

describe("world atmosphere", () => {
  it("defines unique visual palettes without operational state fields", () => {
    expect(new Set(ATMOSPHERES.map((atmosphere) => atmosphere.id)).size).toBe(ATMOSPHERES.length);
    for (const atmosphere of ATMOSPHERES) {
      expect(Object.keys(atmosphere)).not.toEqual(
        expect.arrayContaining(["events", "severity", "authority", "permissions", "status"]),
      );
      expect(atmosphereById(atmosphere.id)).toBe(atmosphere);
    }
  });
});
