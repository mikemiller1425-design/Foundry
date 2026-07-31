import { describe, expect, it } from "vitest";
import { AGENT_VISUALS, ALL_AGENT_STATUSES, agentNonColorSignature } from "./agentVisuals";

describe("AGENT_VISUALS — every allowed status distinct, never color alone", () => {
  it("defines all eight allowed states (world-model.md 'Architect / Builder / Inspector agents')", () => {
    expect(ALL_AGENT_STATUSES).toHaveLength(8);
    for (const status of ALL_AGENT_STATUSES) {
      expect(AGENT_VISUALS[status]).toBeDefined();
    }
  });

  it("no two statuses share an identical non-color signature (shape)", () => {
    const signatures = ALL_AGENT_STATUSES.map((status) =>
      agentNonColorSignature(AGENT_VISUALS[status]),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("no two statuses share an identical color either", () => {
    const colors = ALL_AGENT_STATUSES.map((status) => AGENT_VISUALS[status].color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
