import { describe, expect, it } from "vitest";
import { residenceIdentityForBuilding } from "./residenceIdentity";

describe("residenceIdentityForBuilding", () => {
  it("gives every canonical residence a distinct authored silhouette identity", () => {
    const identities = [
      residenceIdentityForBuilding("home-architect"),
      residenceIdentityForBuilding("home-builder"),
      residenceIdentityForBuilding("home-inspector"),
    ];
    expect(new Set(identities).size).toBe(3);
  });

  it("refuses to invent an identity for an unknown building", () => {
    expect(() => residenceIdentityForBuilding("home-unknown")).toThrow(
      /No residence identity declared/,
    );
  });
});
