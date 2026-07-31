// "building" covers world objects (FBL-014's Lighthouse today; residences
// and operational buildings reuse the same kind from FBL-016 on — see
// docs/03-architecture/foundry-build-ladder.md FBL-015 "reusable ... for
// residences and operational buildings in later rungs").
export type Selection =
  { kind: "stage"; id: string } | { kind: "agent"; id: string } | { kind: "building"; id: string };
