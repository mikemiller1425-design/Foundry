import { describe, expect, it, vi } from "vitest";
import { fetchExecutionGate, interpretExecutionGateResponse } from "./executionGate";

/**
 * AC-110 — reading the gate from the browser.
 *
 * The load-bearing property is that this module can only ever *narrow*
 * permission. A malformed, missing, or unreachable answer must read as
 * "not permitted"; nothing here may widen into "allowed".
 */

describe("interpretExecutionGateResponse", () => {
  it("reports a permitted verdict, and that it started nothing", () => {
    const report = interpretExecutionGateResponse(
      200,
      { permitted: true, executed: false, refusals: [], currentContentHash: "sha256:abc" },
      "build-1",
      "backend_implementation",
    );
    expect(report.permitted).toBe(true);
    expect(report.executed).toBe(false);
    expect(report.currentContentHash).toBe("sha256:abc");
  });

  it.each([
    ["a missing field", {}],
    ["a truthy non-true value", { permitted: "yes" }],
    ["the number 1", { permitted: 1 }],
    ["a null body", null],
  ])("treats %s as NOT permitted — it can only narrow", (_label, body) => {
    expect(interpretExecutionGateResponse(200, body, "build-1", "backend_implementation").permitted).toBe(
      false,
    );
  });

  it("carries each refusal's reason and corrective action", () => {
    const report = interpretExecutionGateResponse(
      200,
      {
        permitted: false,
        refusals: [{ code: "no_authorization", reason: "none exists", correctiveAction: "issue one" }],
      },
      "build-1",
      "backend_implementation",
    );
    expect(report.refusals).toEqual([
      { code: "no_authorization", reason: "none exists", correctiveAction: "issue one" },
    ]);
  });

  it("survives malformed refusal entries without inventing permission", () => {
    const report = interpretExecutionGateResponse(
      200,
      { permitted: false, refusals: [null, 7, { code: "x" }] },
      "build-1",
      "backend_implementation",
    );
    expect(report.permitted).toBe(false);
    expect(report.refusals).toHaveLength(1);
    expect(report.refusals[0]?.reason).toMatch(/without stating a reason/);
  });

  it("marks a non-2xx answer unavailable rather than refused-for-a-reason", () => {
    const report = interpretExecutionGateResponse(500, {}, "build-1", "backend_implementation");
    expect(report.permitted).toBe(false);
    expect(report.unavailable).toMatch(/HTTP 500/);
  });
});

describe("fetchExecutionGate", () => {
  it("issues a GET with the stage in the query, and encodes both segments", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      json: async () => ({ permitted: false, refusals: [] }),
    })) as unknown as typeof fetch;

    await fetchExecutionGate("http://localhost:4000/", "build/1", "qa_validation", fetchImpl);
    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit?][] } }).mock
      .calls[0] as [string, RequestInit?];
    expect(url).toBe(
      "http://localhost:4000/builds/build%2F1/execution-authorization?stage=qa_validation",
    );
    // No method, no body: a read must not be able to cause what it reports on.
    expect(init).toBeUndefined();
  });

  it("reports an unreachable backend as unavailable, not as refused", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch failed");
    }) as unknown as typeof fetch;

    const report = await fetchExecutionGate("http://x", "build-1", "backend_implementation", fetchImpl);
    expect(report.permitted).toBe(false);
    expect(report.unavailable).toBe("fetch failed");
  });
});
