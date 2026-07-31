import type { StageSummary } from "@/lib/mock-runtime/selectors";
import { describe, expect, it } from "vitest";
import {
  ALL_CONSTRUCTION_SITE_PHASES,
  CONSTRUCTION_SITE_VISUALS,
  computeConstructionSitePhase,
  constructionSiteNonColorSignature,
} from "./constructionSitePhase";

const STAGE_NAMES = [
  "planning",
  "scaffold",
  "frontend_implementation",
  "backend_implementation",
  "integration",
  "qa_validation",
  "deployment_package",
] as const;

function stagesCompletedThrough(count: number): StageSummary[] {
  return STAGE_NAMES.map((name, i) => ({
    id: `stage-${i}`,
    name,
    status: i < count ? "completed" : "planned",
  }));
}

describe("computeConstructionSitePhase — deterministic mapping from completed stage count only", () => {
  it("no stages completed -> foundation", () => {
    expect(computeConstructionSitePhase([])).toBe("foundation");
    expect(computeConstructionSitePhase(stagesCompletedThrough(0))).toBe("foundation");
  });

  it("1-2 stages completed -> frame", () => {
    expect(computeConstructionSitePhase(stagesCompletedThrough(1))).toBe("frame");
    expect(computeConstructionSitePhase(stagesCompletedThrough(2))).toBe("frame");
  });

  it("3-4 stages completed -> enclosed", () => {
    expect(computeConstructionSitePhase(stagesCompletedThrough(3))).toBe("enclosed");
    expect(computeConstructionSitePhase(stagesCompletedThrough(4))).toBe("enclosed");
  });

  it("5-6 stages completed -> inspected", () => {
    expect(computeConstructionSitePhase(stagesCompletedThrough(5))).toBe("inspected");
    expect(computeConstructionSitePhase(stagesCompletedThrough(6))).toBe("inspected");
  });

  it("all 7 stages completed -> completed", () => {
    expect(computeConstructionSitePhase(stagesCompletedThrough(7))).toBe("completed");
  });

  it("progression depends only on completed count, never elapsed time or ordering gaps", () => {
    const outOfOrderButSameCount: StageSummary[] = [
      { id: "s1", name: "integration", status: "completed" },
      { id: "s2", name: "planning", status: "completed" },
    ];
    expect(computeConstructionSitePhase(outOfOrderButSameCount)).toBe("frame");
  });
});

describe("CONSTRUCTION_SITE_VISUALS — every phase distinct, never color alone", () => {
  it("defines all five allowed phases", () => {
    expect(ALL_CONSTRUCTION_SITE_PHASES).toHaveLength(5);
  });

  it("no two phases share an identical non-color signature (shape)", () => {
    const signatures = ALL_CONSTRUCTION_SITE_PHASES.map((phase) =>
      constructionSiteNonColorSignature(CONSTRUCTION_SITE_VISUALS[phase]),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("no two phases share an identical color", () => {
    const colors = ALL_CONSTRUCTION_SITE_PHASES.map((phase) => CONSTRUCTION_SITE_VISUALS[phase].color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
