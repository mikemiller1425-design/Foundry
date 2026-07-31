import { describe, expect, it } from "vitest";
import { DEFAULT_SEED } from "./runtime";
import { buildCanonicalScript } from "./script";
import { reduceWorldState } from "./worldStateReducer";

/**
 * FBL-022 — "a recorded run artifact (for later comparison once the
 * backend exists, including at FBL-031)" (foundry-build-ladder.md § FBL-022
 * "Expected files and deliverables"). The checked-in JSON fixture this test
 * snapshots against is the literal recorded run: the complete, ordered
 * event history and the final WorldState projection for the default-seed
 * V1 demo, generated once here and then held stable. Once a real backend
 * exists (FBL-023+), the same fixture is the reference a real run can be
 * diffed against to prove backend-authoritative behavior matches this
 * mock-authoritative baseline (M-05) — it is not itself proof of backend
 * correctness, only the recorded expectation to compare a backend run to.
 */
describe("FBL-022 recorded run artifact", () => {
  it("the canonical V1 demo run (default seed) matches its checked-in recorded-run fixture exactly", async () => {
    const events = buildCanonicalScript(DEFAULT_SEED);
    const finalWorldState = reduceWorldState(events);
    const recordedRun = {
      seed: DEFAULT_SEED,
      eventCount: events.length,
      events,
      finalWorldState,
    };
    await expect(JSON.stringify(recordedRun, null, 2)).toMatchFileSnapshot(
      "./__fixtures__/v1-canonical-run.json",
    );
  });

  it("is fully reproducible: rebuilding the script from scratch twice yields byte-identical events and an identical final WorldState", () => {
    const runA = buildCanonicalScript(DEFAULT_SEED);
    const runB = buildCanonicalScript(DEFAULT_SEED);
    expect(runA).toEqual(runB);
    expect(reduceWorldState(runA)).toEqual(reduceWorldState(runB));
  });
});
