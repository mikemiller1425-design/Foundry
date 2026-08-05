// "building" covers world objects (FBL-014's Lighthouse today; residences
// and operational buildings reuse the same kind from FBL-016 on — see
// docs/03-architecture/foundry-build-ladder.md FBL-015 "reusable ... for
// residences and operational buildings in later rungs"). "vehicle" is its
// own kind (FBL-019) since the utility vehicle is a distinct domain entity
// (domain-model.md → Vehicle), not a Building.
export type Selection =
  | { kind: "district"; id: string }
  | { kind: "parcel"; id: string }
  | { kind: "stage"; id: string }
  | { kind: "agent"; id: string }
  | { kind: "building"; id: string }
  | { kind: "vehicle"; id: string };
