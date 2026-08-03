import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENTITY_TYPES, PersistenceService, PrincipalRegistry } from "@foundry/persistence";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

/**
 * AC-103 — `POST /objectives` across the wire.
 *
 * The unit tests in `@foundry/persistence` prove the intake rules; these
 * prove the operator's browser can actually reach them, and that every
 * refusal comes back as something a UI can render rather than an opaque
 * status code.
 */

const OBJECTIVE = "Add a JSON task store module with a test suite";

const SUBMISSION = {
  objective: OBJECTIVE,
  workspace: "foundry_managed",
  riskClass: "R2",
} as const;

let dir: string;
let persistence: PersistenceService;
let server: Server;
let baseUrl: string;
let operatorToken: string;
let builderToken: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "foundry-api-objectives-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));

  const principals = new PrincipalRegistry();
  operatorToken = principals.issueOperatorCredential("operator-1");
  builderToken = principals.issueAgentCredential("agent-builder");

  server = createApp(persistence, principals);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Expected a bound port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

function submit(body: unknown, token?: string) {
  return fetch(`${baseUrl}/objectives`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function snapshotAllPersistedState() {
  return {
    events: persistence.getAllEvents(),
    entities: Object.fromEntries(
      ENTITY_TYPES.map((type) => [type, persistence.listEntities(type)]),
    ),
  };
}

describe("POST /objectives — accepted submission", () => {
  it("returns 201 with the created Project and Build", async () => {
    const res = await submit(SUBMISSION, operatorToken);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(typeof body.projectId).toBe("string");
    expect(typeof body.buildId).toBe("string");
    expect(body.objective).toBe(OBJECTIVE);
    expect(body.events.map((e: { type: string }) => e.type)).toEqual([
      "operator.objective_submitted",
      "build.created",
    ]);
  });

  it("makes the objective visible in the world-state projection the frontend reads", async () => {
    await submit(SUBMISSION, operatorToken);

    const res = await fetch(`${baseUrl}/world-state`);
    const worldState = await res.json();
    expect(worldState.currentBuild.objectiveSnapshot).toBe(OBJECTIVE);
    expect(worldState.currentBuild.status).toBe("planned");
  });

  it("makes both events retrievable from the event log the timeline replays", async () => {
    await submit(SUBMISSION, operatorToken);

    const res = await fetch(`${baseUrl}/events`);
    const events = await res.json();
    expect(events.map((e: { type: string }) => e.type)).toEqual([
      "operator.objective_submitted",
      "build.created",
    ]);
  });
});

describe("POST /objectives — refusals are legible and change nothing", () => {
  it("refuses an anonymous caller with 403 and a stated reason", async () => {
    const before = snapshotAllPersistedState();
    const res = await submit(SUBMISSION);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.accepted).toBe(false);
    expect(body.error).toBe("unauthorized");
    expect(body.reason).toMatch(/authenticated operator/i);
    expect(body.correctiveAction).toBeTruthy();
    expect(snapshotAllPersistedState()).toEqual(before);
  });

  it("refuses an agent credential with 403 — an agent may not commission its own work", async () => {
    const res = await submit(SUBMISSION, builderToken);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("unauthorized");
  });

  it.each([
    ["an objective below the length floor", { ...SUBMISSION, objective: "too short" }],
    ["a disallowed workspace", { ...SUBMISSION, workspace: "/Users/operator/real-project" }],
    ["an R3 risk class", { ...SUBMISSION, riskClass: "R3" }],
    ["an unknown field", { ...SUBMISSION, autoExecute: true }],
  ])("refuses %s with 400, per-field issues, and zero mutation", async (_label, submission) => {
    const before = snapshotAllPersistedState();
    const res = await submit(submission, operatorToken);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.accepted).toBe(false);
    expect(body.error).toBe("invalid_objective");
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
    expect(body.issues[0]).toHaveProperty("field");
    expect(body.issues[0]).toHaveProperty("message");
    expect(snapshotAllPersistedState()).toEqual(before);
  });

  it("refuses malformed JSON with 400 rather than a 500", async () => {
    const before = snapshotAllPersistedState();
    const res = await submit("{not json", operatorToken);

    expect(res.status).toBe(400);
    expect((await res.json()).accepted).toBe(false);
    expect(snapshotAllPersistedState()).toEqual(before);
  });

  it("refuses a second objective with 409 while the first project is open", async () => {
    expect((await submit(SUBMISSION, operatorToken)).status).toBe(201);

    const before = snapshotAllPersistedState();
    const res = await submit(
      { ...SUBMISSION, objective: "Add a second unrelated module with tests" },
      operatorToken,
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("command_rejected");
    expect(body.reason).toMatch(/one active project/i);
    expect(body.correctiveAction).toBeTruthy();
    expect(snapshotAllPersistedState()).toEqual(before);
  });
});

describe("POST /objectives — the closed command vocabulary is untouched", () => {
  it("is not reachable as a command type through POST /commands", async () => {
    const res = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({ commandType: "Objective.Submit", params: SUBMISSION }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_request");
  });

  it("still enforces the bounded objective when Project.Create is posted directly", async () => {
    const before = snapshotAllPersistedState();
    const res = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({
        commandType: "Project.Create",
        entityId: "project-direct",
        params: { objective: "no", projectId: "project-direct" },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(false);
    expect(body.reason).toMatch(/bounded objective/i);
    expect(snapshotAllPersistedState()).toEqual(before);
  });
});
