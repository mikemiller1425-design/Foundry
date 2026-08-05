import type { FoundryEvent } from "@foundry/event-types";
import { describe, expect, it } from "vitest";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { deriveAgentRouteCue, routeSamples } from "./agentSpatialStory";

describe("agent spatial story", () => {
  it("derives a route only from a canonical departure while projected traveling", () => {
    const events = buildCanonicalScript("agent-route-test");
    const departed = events.find((event) => event.type === "agent.departed")!;
    const cue = deriveAgentRouteCue(departed.entityId, "traveling", events);

    expect(cue).toMatchObject({
      agentId: departed.entityId,
      eventId: departed.id,
    });
    expect(cue?.sourceBuildingId).not.toBe(cue?.destinationBuildingId);
    expect(deriveAgentRouteCue(departed.entityId, "working", events)).toBeNull();
  });

  it("refuses routes whose declared buildings are unknown", () => {
    const malformed = {
      id: "route-unknown",
      type: "agent.departed",
      entityId: "agent-1",
      payload: { sourceBuildingId: "unknown", destinationBuildingId: "also-unknown" },
    } as unknown as FoundryEvent;
    expect(deriveAgentRouteCue("agent-1", "traveling", [malformed])).toBeNull();
  });

  it("samples the declared path without changing either endpoint", () => {
    const samples = routeSamples([0, 0.1, 0], [7, 0.1, -7], 8);
    expect(samples).toHaveLength(8);
    expect(samples[0]).toEqual([0, 0.1, 0]);
    expect(samples[7]).toEqual([7, 0.1, -7]);
  });
});
