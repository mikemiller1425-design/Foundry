import type { AgentRole } from "@foundry/contracts";
import { findFoundryParcel } from "./worldAtlas";

export interface AgentAccessPreview {
  role: AgentRole;
  label: string;
  hypotheticalUse: string;
  boundary: "not-granted";
}

export interface FixtureTenantSpace {
  id: string;
  parcelId: string;
  name: string;
  archetype: string;
  tagline: string;
  accent: string;
  secondary: string;
  agentAccess: readonly AgentAccessPreview[];
}

const STANDARD_AGENT_ACCESS_PREVIEW: readonly AgentAccessPreview[] = [
  {
    role: "architect",
    label: "Architect preview",
    hypotheticalUse: "Explore how a bounded brief might become a reviewable plan.",
    boundary: "not-granted",
  },
  {
    role: "builder",
    label: "Builder preview",
    hypotheticalUse: "Explore how authorized work might appear spatially while underway.",
    boundary: "not-granted",
  },
  {
    role: "inspector",
    label: "Inspector preview",
    hypotheticalUse: "Explore how independent findings and evidence references might be reviewed.",
    boundary: "not-granted",
  },
];

/**
 * Fictional, frontend-local tenant showrooms. They are visual product
 * exploration only and are intentionally absent from WorldState, identity,
 * authorization, billing, and every backend command contract.
 */
export const FIXTURE_TENANT_SPACES: readonly FixtureTenantSpace[] = [
  {
    id: "northstar-atelier",
    parcelId: "steward-commons",
    name: "Northstar Atelier",
    archetype: "Creative studio concept",
    tagline: "A calm room for shaping ambiguous ideas into legible direction.",
    accent: "#9d8cff",
    secondary: "#63d8ff",
    agentAccess: STANDARD_AGENT_ACCESS_PREVIEW,
  },
  {
    id: "forgeworks-cooperative",
    parcelId: "production-row",
    name: "Forgeworks Cooperative",
    archetype: "Production cooperative concept",
    tagline: "A transparent floor for planning, making, inspection, and evidence.",
    accent: "#64d8ff",
    secondary: "#f4b860",
    agentAccess: STANDARD_AGENT_ACCESS_PREVIEW,
  },
  {
    id: "signal-house",
    parcelId: "launch-quarter",
    name: "Signal House",
    archetype: "Launch studio concept",
    tagline: "A focused handoff room for readiness, review, and deliberate release.",
    accent: "#f4b860",
    secondary: "#67d4ad",
    agentAccess: STANDARD_AGENT_ACCESS_PREVIEW,
  },
];

export function findFixtureTenantSpace(id: string): FixtureTenantSpace | undefined {
  return FIXTURE_TENANT_SPACES.find((tenant) => tenant.id === id);
}

export function fixtureTenantForParcel(parcelId: string): FixtureTenantSpace | undefined {
  return FIXTURE_TENANT_SPACES.find((tenant) => tenant.parcelId === parcelId);
}

export function tenantSpaceCatalogIsAligned(): boolean {
  return FIXTURE_TENANT_SPACES.every((tenant) => {
    const parcel = findFoundryParcel(tenant.parcelId);
    return (
      parcel?.tenant === tenant.name &&
      tenant.agentAccess.every((access) => access.boundary === "not-granted")
    );
  });
}
