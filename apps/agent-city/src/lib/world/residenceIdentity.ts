export type ResidenceIdentity = "architect" | "builder" | "inspector";

const RESIDENCE_IDENTITY_BY_BUILDING_ID: Readonly<Record<string, ResidenceIdentity>> = {
  "home-architect": "architect",
  "home-builder": "builder",
  "home-inspector": "inspector",
};

export function residenceIdentityForBuilding(buildingId: string): ResidenceIdentity {
  const identity = RESIDENCE_IDENTITY_BY_BUILDING_ID[buildingId];
  if (!identity) throw new Error(`No residence identity declared for ${buildingId}`);
  return identity;
}
