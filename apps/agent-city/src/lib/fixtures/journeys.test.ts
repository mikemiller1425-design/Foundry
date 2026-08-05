import { describe, expect, it } from "vitest";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { reduceWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { FIXTURE_JOURNEYS, fixtureJourneyById, resolveFixtureJourneyCursor } from "./journeys";

describe("fixture journey catalog", () => {
  const script = buildCanonicalScript("fixture-journey-test");

  it("resolves every journey from semantic checkpoints in the canonical script", () => {
    for (const journey of FIXTURE_JOURNEYS) {
      const cursor = resolveFixtureJourneyCursor(journey, script);
      expect(cursor).toBeGreaterThanOrEqual(0);
      expect(cursor).toBeLessThanOrEqual(script.length);
    }
  });

  it("holds the approval-gate journey at a genuinely pending canonical approval", () => {
    const journey = fixtureJourneyById("approval-gate");
    const cursor = resolveFixtureJourneyCursor(journey, script);
    const state = reduceWorldState(script.slice(0, cursor));

    expect(script[cursor - 1]?.type).toBe("approval.requested");
    expect(state.approvals.some((approval) => approval.status === "pending")).toBe(true);
  });

  it("captures travel only after a declared departure event", () => {
    const journey = fixtureJourneyById("transfer-in-motion");
    const cursor = resolveFixtureJourneyCursor(journey, script);

    expect(script[cursor - 1]?.type).toBe("agent.departed");
    expect(script.slice(0, cursor).some((event) => event.type === "agent.departed")).toBe(true);
  });

  it("captures the exception at the declared requirement failure", () => {
    const journey = fixtureJourneyById("validation-exception");
    const cursor = resolveFixtureJourneyCursor(journey, script);

    expect(script[cursor - 1]?.type).toBe("requirement.failed");
  });
});
