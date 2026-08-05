import { describe, expect, it } from "vitest";
import {
  FIXTURE_TENANT_SPACES,
  fixtureTenantForParcel,
  tenantSpaceCatalogIsAligned,
} from "./tenantSpaces";

describe("fixture tenant spaces", () => {
  it("maps every showroom to its declared fictional parcel tenant", () => {
    expect(tenantSpaceCatalogIsAligned()).toBe(true);
    expect(new Set(FIXTURE_TENANT_SPACES.map((tenant) => tenant.parcelId)).size).toBe(
      FIXTURE_TENANT_SPACES.length,
    );
  });

  it("never assigns a tenant showroom to the unassigned future yard", () => {
    expect(fixtureTenantForParcel("future-yard")).toBeUndefined();
  });

  it("marks every agent role as not granted", () => {
    expect(
      FIXTURE_TENANT_SPACES.flatMap((tenant) => tenant.agentAccess).every(
        (access) => access.boundary === "not-granted",
      ),
    ).toBe(true);
  });
});
