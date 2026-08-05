import { describe, expect, it } from "vitest";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { activeAgentTraceLeg, deriveAgentTrace } from "./agentTrace";

describe("agent trace", () => {
  it("indexes only declared departures and pairs their declared arrivals", () => {
    const events = buildCanonicalScript("agent-trace-test");
    const legs = deriveAgentTrace(events);

    expect(legs).toHaveLength(events.filter((event) => event.type === "agent.departed").length);
    expect(legs.every((leg) => leg.arrivalEventId !== null)).toBe(true);
    expect(legs.every((leg) => leg.assignmentEventId !== null)).toBe(true);
    expect(legs.map((leg) => leg.sequence)).toEqual(legs.map((_, index) => index + 1));
  });

  it("marks a leg active only between its departure and arrival cursors", () => {
    const legs = deriveAgentTrace(buildCanonicalScript("agent-trace-cursor-test"));
    const first = legs[0]!;

    expect(activeAgentTraceLeg(legs, first.departureCursor)?.id).toBe(first.id);
    expect(activeAgentTraceLeg(legs, first.arrivalCursor!)).toBeNull();
  });
});
