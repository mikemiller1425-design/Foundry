import { describe, expect, it } from "vitest";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { describeEvent } from "./describeEvent";

describe("describeEvent", () => {
  it("produces a non-empty readable summary for every event in the canonical script", () => {
    const script = buildCanonicalScript("describe-check");
    for (const event of script) {
      const summary = describeEvent(event);
      expect(typeof summary).toBe("string");
      expect(summary.length).toBeGreaterThan(0);
      expect(summary).not.toMatch(/undefined/);
    }
  });

  it("gives a specific, meaningful message for the intentional requirement failure", () => {
    const script = buildCanonicalScript("describe-failure");
    const failed = script.find((e) => e.type === "requirement.failed")!;
    expect(describeEvent(failed)).toContain("Requirement failed");
    expect(describeEvent(failed)).toContain("error state");
  });

  it("gives a specific message for build.completed and upgrade.completed", () => {
    const script = buildCanonicalScript("describe-completion");
    const buildCompleted = script.find((e) => e.type === "build.completed")!;
    const upgradeCompleted = script.find((e) => e.type === "upgrade.completed")!;
    expect(describeEvent(buildCompleted)).toBe("Build completed");
    expect(describeEvent(upgradeCompleted)).toContain("level 1 → 2");
  });
});
