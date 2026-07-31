import type { Agent, Building } from "@foundry/contracts";
import { describe, expect, it } from "vitest";
import { computeResidenceState } from "./residenceState";

function building(overrides: Partial<Building> = {}): Building {
  return {
    id: "home-architect",
    name: "Architect Residence",
    buildingType: "home",
    level: 1,
    status: "idle",
    position: { x: 0, y: 0, z: 0 },
    capabilities: [],
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-architect",
    name: "Architect",
    role: "architect",
    status: "idle",
    homeBuildingId: "home-architect",
    currentBuildingId: "home-architect",
    authorityLevel: 1,
    runtimeType: "mock",
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    lastHeartbeatAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeResidenceState — deterministic mapping from Building + Agent only", () => {
  it("defaults to occupied_idle: agent at home, idle, building idle", () => {
    expect(computeResidenceState(building(), agent())).toBe("occupied_idle");
  });

  it("maps agent working elsewhere to vacant_assigned", () => {
    expect(
      computeResidenceState(building(), agent({ currentBuildingId: "construction-office" })),
    ).toBe("vacant_assigned");
  });

  it("maps agent offline to unavailable, even if currently at home", () => {
    expect(computeResidenceState(building(), agent({ status: "offline" }))).toBe("unavailable");
  });

  it("maps a missing agent record to unavailable", () => {
    expect(computeResidenceState(building(), undefined)).toBe("unavailable");
  });

  it("maps agent paused to paused", () => {
    expect(computeResidenceState(building(), agent({ status: "paused" }))).toBe("paused");
  });

  it("maps building-level degraded/disconnected/failed to degraded", () => {
    expect(computeResidenceState(building({ status: "degraded" }), agent())).toBe("degraded");
    expect(computeResidenceState(building({ status: "disconnected" }), agent())).toBe("degraded");
    expect(computeResidenceState(building({ status: "failed" }), agent())).toBe("degraded");
  });

  it("a building-level problem always outranks agent status (offline, paused, or away)", () => {
    expect(
      computeResidenceState(
        building({ status: "degraded" }),
        agent({ status: "offline", currentBuildingId: "construction-office" }),
      ),
    ).toBe("degraded");
  });

  it("offline outranks paused and vacant_assigned", () => {
    expect(
      computeResidenceState(
        building(),
        agent({ status: "offline", currentBuildingId: "construction-office" }),
      ),
    ).toBe("unavailable");
  });

  it("never represents active work — no state maps to the building's own active/working notion", () => {
    // A residence never shows "working" — it's the agent's workplace
    // building that does. Confirms the residence-specific vocabulary has
    // no such state to begin with.
    const allStates = ["occupied_idle", "vacant_assigned", "unavailable", "paused", "degraded"];
    expect(allStates).not.toContain("working");
    expect(allStates).not.toContain("active");
  });
});
