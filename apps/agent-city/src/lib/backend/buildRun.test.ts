import { describe, expect, it, vi } from "vitest";
import { interpretBuildRunResponse, postBuildRun } from "./buildRun";

/**
 * AC-109 — every outcome of starting a run is a rendered outcome.
 *
 * The failure mode this guards is the one AC-103 closed for objectives: a
 * refusal the operator cannot see is indistinguishable from a broken app.
 */

describe("interpretBuildRunResponse", () => {
  it("accepts a 202 and carries the backend's own simulation claim", () => {
    const result = interpretBuildRunResponse(202, {
      accepted: true,
      planId: "plan-1",
      stepCount: 92,
      simulated: true,
      executor: "mock",
    });
    expect(result).toEqual({
      accepted: true,
      planId: "plan-1",
      stepCount: 92,
      simulated: true,
      executor: "mock",
    });
  });

  it("does not invent `simulated` when the backend did not claim it", () => {
    // A client that hard-coded this would keep saying "simulated" even if
    // the backend one day stopped being — the claim has to come from the
    // thing making it.
    expect(interpretBuildRunResponse(202, { accepted: true }).simulated).toBe(false);
  });

  it.each([
    [403, "unauthorized", "Starting a build requires an authenticated operator."],
    [404, "no_plan", "No plan is recorded for build build-1."],
    [409, "not_startable", "Plan plan-1 has not been reviewed."],
  ])("carries the code and reason from a %s", (status, error, reason) => {
    const result = interpretBuildRunResponse(status, {
      accepted: false,
      error,
      reason,
      correctiveAction: "Do the stated thing.",
    });
    expect(result.accepted).toBe(false);
    expect(result.code).toBe(error);
    expect(result.reason).toBe(reason);
    expect(result.correctiveAction).toBe("Do the stated thing.");
  });

  it("still says something when the response has no shape at all", () => {
    const result = interpretBuildRunResponse(500, null);
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/HTTP 500/);
  });

  it("falls back to `message` before inventing its own sentence", () => {
    expect(interpretBuildRunResponse(400, { message: "Body is not valid JSON" }).reason).toBe(
      "Body is not valid JSON",
    );
  });

  it("treats a 200 without `accepted: true` as a refusal, not a success", () => {
    expect(interpretBuildRunResponse(200, { planId: "plan-1" }).accepted).toBe(false);
  });
});

describe("postBuildRun", () => {
  it("posts to the build's start route with the operator credential", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 202,
      json: async () => ({ accepted: true, executor: "mock", simulated: true }),
    })) as unknown as typeof fetch;

    const result = await postBuildRun("http://localhost:4000/", "build-1", "token-1", fetchImpl);

    expect(result.accepted).toBe(true);
    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:4000/builds/build-1/start");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
  });

  it("encodes the build id rather than splicing it into the path raw", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 404,
      json: async () => ({ accepted: false, error: "no_plan", reason: "nope" }),
    })) as unknown as typeof fetch;

    await postBuildRun("http://localhost:4000", "build/../evil", null, fetchImpl);
    const [url] = (fetchImpl as unknown as { mock: { calls: [string][] } }).mock.calls[0] as [
      string,
    ];
    expect(url).toBe("http://localhost:4000/builds/build%2F..%2Fevil/start");
  });

  it("reports an unreachable backend as a refusal with a fix, not a thrown error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch failed");
    }) as unknown as typeof fetch;

    const result = await postBuildRun("http://localhost:4000", "build-1", null, fetchImpl);
    expect(result.accepted).toBe(false);
    expect(result.code).toBe("unreachable");
    expect(result.reason).toBe("fetch failed");
    expect(result.correctiveAction).toMatch(/API process is running/);
  });

  it("omits the Authorization header entirely when no credential is held", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 403,
      json: async () => ({ accepted: false, error: "unauthorized", reason: "no" }),
    })) as unknown as typeof fetch;

    await postBuildRun("http://localhost:4000", "build-1", null, fetchImpl);
    const [, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0] as [string, RequestInit];
    expect("Authorization" in (init.headers as Record<string, string>)).toBe(false);
  });
});
