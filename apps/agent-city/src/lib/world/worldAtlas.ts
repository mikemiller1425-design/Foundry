export type ParcelTenure = "concept-lease" | "unassigned";

export interface FoundryParcel {
  id: string;
  districtId: string;
  label: string;
  purpose: string;
  tenant: string | null;
  tenure: ParcelTenure;
  accent: string;
  center: readonly [number, number, number];
  size: readonly [number, number];
  linkedBuildingIds: readonly string[];
}

export interface FoundryDistrict {
  id: string;
  label: string;
  purpose: string;
  status: "active-fixture" | "uncommissioned";
  accent: string;
  mapPosition: readonly [number, number];
  center?: readonly [number, number, number];
  cameraDistance?: number;
}

export interface FoundryWorldLink {
  id: string;
  fromDistrictId: string;
  toDistrictId: string;
  status: "proposed";
}

/**
 * Frontend-only spatial concepts for exploring the future Foundry model.
 * These records are deliberately not part of WorldState and never imply a
 * legal tenancy, paid entitlement, marketplace listing, or backend grant.
 */
export const FOUNDRY_DISTRICTS: readonly FoundryDistrict[] = [
  {
    id: "agent-city-operations",
    label: "Agent City Operations",
    purpose: "A fixture district for observing agents, work, review, and delivery.",
    status: "active-fixture",
    accent: "#64d8ff",
    mapPosition: [49, 50],
    center: [0, 0.5, -2],
    cameraDistance: 24,
  },
  {
    id: "knowledge-reach",
    label: "Knowledge Reach",
    purpose: "A future concept for research, memory, and shared institutional knowledge.",
    status: "uncommissioned",
    accent: "#9d8cff",
    mapPosition: [22, 25],
  },
  {
    id: "exchange-ward",
    label: "Exchange Ward",
    purpose: "A future concept for transparent service exchange and bounded collaboration.",
    status: "uncommissioned",
    accent: "#f4b860",
    mapPosition: [78, 27],
  },
  {
    id: "commons-basin",
    label: "Commons Basin",
    purpose: "A future concept for public gathering, learning, and world orientation.",
    status: "uncommissioned",
    accent: "#67d4ad",
    mapPosition: [50, 81],
  },
];

export const FOUNDRY_WORLD_LINKS: readonly FoundryWorldLink[] = [
  {
    id: "operations-knowledge",
    fromDistrictId: "agent-city-operations",
    toDistrictId: "knowledge-reach",
    status: "proposed",
  },
  {
    id: "operations-exchange",
    fromDistrictId: "agent-city-operations",
    toDistrictId: "exchange-ward",
    status: "proposed",
  },
  {
    id: "operations-commons",
    fromDistrictId: "agent-city-operations",
    toDistrictId: "commons-basin",
    status: "proposed",
  },
];

export const FOUNDRY_PARCELS: readonly FoundryParcel[] = [
  {
    id: "steward-commons",
    districtId: "agent-city-operations",
    label: "Steward Commons",
    purpose: "Agent residences and human-readable civic orientation.",
    tenant: "Northstar Atelier",
    tenure: "concept-lease",
    accent: "#9d8cff",
    center: [-12, 0.06, -2],
    size: [5.2, 5.4],
    linkedBuildingIds: ["home-architect", "home-builder", "home-inspector"],
  },
  {
    id: "production-row",
    districtId: "agent-city-operations",
    label: "Production Row",
    purpose: "Planning, artifact custody, and quality work made spatial.",
    tenant: "Forgeworks Cooperative",
    tenure: "concept-lease",
    accent: "#64d8ff",
    center: [-4, 0.06, 4],
    size: [10.8, 5.2],
    linkedBuildingIds: ["construction-office", "warehouse", "qa"],
  },
  {
    id: "launch-quarter",
    districtId: "agent-city-operations",
    label: "Launch Quarter",
    purpose: "Delivery preparation, construction progress, and controlled handoff.",
    tenant: "Signal House",
    tenure: "concept-lease",
    accent: "#f4b860",
    center: [7.5, 0.06, 0],
    size: [13.2, 5.2],
    linkedBuildingIds: ["deployment-dock", "construction-site"],
  },
  {
    id: "future-yard",
    districtId: "agent-city-operations",
    label: "Future Yard",
    purpose: "Reserved visual space for a future authorized world program.",
    tenant: null,
    tenure: "unassigned",
    accent: "#73839b",
    center: [12, 0.06, -6.2],
    size: [5.6, 4.2],
    linkedBuildingIds: [],
  },
];

export function findFoundryDistrict(id: string): FoundryDistrict | undefined {
  return FOUNDRY_DISTRICTS.find((district) => district.id === id);
}

export function findFoundryParcel(id: string): FoundryParcel | undefined {
  return FOUNDRY_PARCELS.find((parcel) => parcel.id === id);
}
