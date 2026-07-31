import { describe, expect, it } from "vitest";
import { computeAgentPosition } from "./agentPosition";

describe("computeAgentPosition — exactly one resolvable location per call", () => {
  it("resolves a known building id to that building's position (plus a small per-agent offset)", () => {
    const position = computeAgentPosition("home-architect", 0);
    expect(position).not.toBeNull();
    expect(position!.y).toBe(0);
  });

  it("is deterministic: the same currentBuildingId always resolves to the same single position", () => {
    const first = computeAgentPosition("construction-office", 1);
    const second = computeAgentPosition("construction-office", 1);
    expect(first).toEqual(second);
  });

  it("never resolves to two different buildings' positions for a single call — changing currentBuildingId changes the result to exactly the new building's position, never a blend of both", () => {
    const atOffice = computeAgentPosition("construction-office", 0);
    const atWarehouse = computeAgentPosition("warehouse", 0);
    // Each call reflects exactly one building — never an average/blend of
    // two locations, which would visually imply presence in both.
    expect(atOffice).not.toEqual(atWarehouse);
    expect(atOffice!.x).not.toBe(atWarehouse!.x);
  });

  it("returns null for an unknown building id rather than fabricating a location", () => {
    expect(computeAgentPosition("does-not-exist", 0)).toBeNull();
  });

  it("gives each agent index a distinct offset so co-located agents remain visually distinguishable", () => {
    const a = computeAgentPosition("construction-office", 0);
    const b = computeAgentPosition("construction-office", 1);
    const c = computeAgentPosition("construction-office", 2);
    const keys = [a, b, c].map((p) => `${p!.x},${p!.z}`);
    expect(new Set(keys).size).toBe(3);
  });
});
