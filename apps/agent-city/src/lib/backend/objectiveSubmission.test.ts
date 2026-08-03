import { describe, expect, it, vi } from "vitest";
import {
  interpretObjectiveResponse,
  postObjective,
  type ObjectiveInput,
} from "./objectiveSubmission";

const INPUT: ObjectiveInput = {
  objective: "Add a JSON task store module with a test suite",
  workspace: "foundry_managed",
  riskClass: "R2",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("interpretObjectiveResponse — acceptance", () => {
  it("reads the created project and build from a 201", () => {
    const result = interpretObjectiveResponse(201, {
      accepted: true,
      projectId: "project-1",
      buildId: "build-1",
      objective: INPUT.objective,
    });
    expect(result).toEqual({
      accepted: true,
      projectId: "project-1",
      buildId: "build-1",
      objective: INPUT.objective,
    });
  });

  it("does not treat a 2xx without accepted:true as acceptance", () => {
    expect(interpretObjectiveResponse(200, { projectId: "project-1" }).accepted).toBe(false);
  });
});

describe("interpretObjectiveResponse — every failure is sayable", () => {
  it("prefers the backend's own reason and corrective action", () => {
    const result = interpretObjectiveResponse(409, {
      accepted: false,
      reason: "Project project-1 is still active.",
      correctiveAction: "Remove the database file and restart.",
    });
    expect(result.reason).toBe("Project project-1 is still active.");
    expect(result.correctiveAction).toBe("Remove the database file and restart.");
  });

  it("falls back to `message` for bodies that use it instead of `reason`", () => {
    const result = interpretObjectiveResponse(400, {
      error: "invalid_request",
      message: "Body is not valid JSON",
    });
    expect(result.reason).toBe("Body is not valid JSON");
  });

  it("still produces a sentence when the body is empty, null, or not an object", () => {
    for (const body of [null, undefined, "", 42, []]) {
      const result = interpretObjectiveResponse(500, body);
      expect(result.accepted).toBe(false);
      expect(result.reason).toMatch(/HTTP 500/);
    }
  });

  it("keeps well-formed per-field issues and drops malformed ones", () => {
    const result = interpretObjectiveResponse(400, {
      accepted: false,
      reason: "Out of envelope.",
      issues: [
        { field: "objective", message: "Too short." },
        { field: "workspace" },
        "not an issue",
        { message: "Whole-submission problem." },
      ],
    });
    expect(result.issues).toEqual([
      { field: "objective", message: "Too short." },
      { field: "", message: "Whole-submission problem." },
    ]);
  });

  it("omits issues entirely when none survive", () => {
    expect(interpretObjectiveResponse(400, { issues: ["nope"] }).issues).toBeUndefined();
  });
});

describe("postObjective", () => {
  it("posts the submission to /objectives with the operator credential", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(201, { accepted: true, projectId: "project-1", buildId: "build-1" }),
    );
    const result = await postObjective(
      "http://localhost:4000/",
      INPUT,
      "token-abc",
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.accepted).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:4000/objectives");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-abc");
    expect(JSON.parse(init.body as string)).toEqual(INPUT);
  });

  it("omits the Authorization header when no credential is held", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(403, { accepted: false, reason: "no" }));
    await postObjective("http://localhost:4000", INPUT, null, fetchImpl as unknown as typeof fetch);

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("reports a network failure as a refusal rather than throwing", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    const result = await postObjective(
      "http://localhost:4000",
      INPUT,
      "token",
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("fetch failed");
    expect(result.correctiveAction).toMatch(/API process is running/i);
  });

  it("reports an unparseable response rather than swallowing it", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>502</html>", { status: 502 }));
    const result = await postObjective(
      "http://localhost:4000",
      INPUT,
      "token",
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/HTTP 502/);
  });
});
