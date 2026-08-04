import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLAUDE_CODE_STAGE, planRevision, type PersistedPlan } from "@foundry/contracts";
import {
  ENTITY_TYPES,
  PersistenceService,
  PrincipalRegistry,
  planContentHash,
} from "@foundry/persistence";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

/**
 * AC-110 — the execution authorization gate across the wire.
 *
 * The unit tests prove the rules; these prove the operator's browser can
 * reach them, that the gate reports in both directions, and that reading
 * or being refused by it changes nothing.
 */

const OBJECTIVE = "Add a JSON task store module with a test suite";

let dir: string;
let persistence: PersistenceService;
let server: Server;
let baseUrl: string;
let operatorToken: string;
let builderToken: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "foundry-api-authorization-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));

  const principals = new PrincipalRegistry();
  operatorToken = principals.issueOperatorCredential("operator-1");
  builderToken = principals.issueAgentCredential("agent-builder");

  server = createApp(persistence, principals, { orchestratorStepDelayMs: 0 });
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

function headers(token?: string | null) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function submitObjective(): Promise<{ buildId: string; planId: string }> {
  const res = await fetch(`${baseUrl}/objectives`, {
    method: "POST",
    headers: headers(operatorToken),
    body: JSON.stringify({ objective: OBJECTIVE, workspace: "foundry_managed", riskClass: "R2" }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { buildId: string; planId: string };
}

async function reviewPlan(planId: string, buildId: string, decision = "proceed") {
  const persisted = persistence.getEntity<PersistedPlan>("plans", planId) as PersistedPlan;
  const res = await fetch(`${baseUrl}/commands`, {
    method: "POST",
    headers: headers(operatorToken),
    body: JSON.stringify({
      commandType: "Plan.Review",
      entityId: planId,
      params: {
        planId,
        buildId,
        reviewedRevision: planRevision(persisted.plan),
        decision,
      },
    }),
  });
  expect(((await res.json()) as { accepted: boolean }).accepted).toBe(true);
}

/**
 * `token` uses `null` for "send no credential", never `undefined`.
 *
 * A default parameter fires on `undefined`, so an explicit
 * `authorize(..., undefined)` silently sent the operator's token and the
 * "uncredentialed caller" case passed while testing nothing. `null` is not
 * a default trigger, so the absent case is actually absent.
 */
async function authorize(
  planId: string,
  buildId: string,
  overrides: Record<string, unknown> = {},
  token: string | null = operatorToken,
) {
  const persisted = persistence.getEntity<PersistedPlan>("plans", planId) as PersistedPlan;
  const res = await fetch(`${baseUrl}/commands`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      commandType: "Plan.Authorize",
      entityId: planId,
      params: {
        planId,
        buildId,
        stageName: CLAUDE_CODE_STAGE,
        maxBudgetUsd: 5,
        acknowledgedContentHash: persisted.contentHash,
        ...overrides,
      },
    }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function gate(buildId: string, stage?: string) {
  const query = stage ? `?stage=${encodeURIComponent(stage)}` : "";
  return fetch(`${baseUrl}/builds/${buildId}/execution-authorization${query}`);
}

function snapshotAllPersistedState() {
  return {
    events: persistence.getAllEvents(),
    entities: Object.fromEntries(
      ENTITY_TYPES.map((type) => [type, persistence.listEntities(type)]),
    ),
  };
}

describe("AC-110 GET /builds/{id}/execution-authorization — the gate, both directions", () => {
  it("REFUSES before anything is authorized, and reports why", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);

    const body = (await (await gate(buildId)).json()) as Record<string, unknown>;
    expect(body.permitted).toBe(false);
    expect(body.executed).toBe(false);
    expect((body.refusals as { code: string }[]).map((r) => r.code)).toEqual(["no_authorization"]);
    expect(body.authorization).toBeNull();
  });

  it("PERMITS once authorized — and reports that it started nothing", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);
    expect((await authorize(planId, buildId)).body.accepted).toBe(true);

    const body = (await (await gate(buildId)).json()) as Record<string, unknown>;
    expect(body.permitted).toBe(true);
    expect(body.refusals).toEqual([]);
    expect(body.executed).toBe(false);
    expect(String(body.note)).toMatch(/Nothing is started, spent, or scheduled/i);
    expect((body.authorization as { stageName: string }).stageName).toBe(CLAUDE_CODE_STAGE);
    expect(body.currentContentHash).toBe(
      planContentHash((persistence.getEntity<PersistedPlan>("plans", planId) as PersistedPlan).plan),
    );
  });

  it("REFUSES a stage the authorization does not name", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);
    await authorize(planId, buildId);

    const body = (await (await gate(buildId, "integration")).json()) as Record<string, unknown>;
    expect(body.permitted).toBe(false);
    expect((body.refusals as { code: string }[]).map((r) => r.code)).toContain(
      "stage_not_authorized",
    );
  });

  it("answers 400 for a stage name that is not one of the seven", async () => {
    const { buildId } = await submitObjective();
    const res = await gate(buildId, "not_a_stage");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("unknown_stage");
  });

  it("reads change nothing at all — zero side effects (F-114)", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);
    await authorize(planId, buildId);

    const before = snapshotAllPersistedState();
    await gate(buildId);
    await gate(buildId, "integration");
    await gate("build-that-does-not-exist");
    expect(snapshotAllPersistedState()).toEqual(before);
  });

  it("never dispatches: no AgentRun exists after a permitted verdict", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);
    await authorize(planId, buildId);
    expect((await (await gate(buildId)).json() as { permitted: boolean }).permitted).toBe(true);

    expect(persistence.listEntities("agentRuns")).toHaveLength(0);
    expect(persistence.listEntities("buildStages")).toHaveLength(0);
    expect(
      persistence.getAllEvents().some((event) => event.type.startsWith("agentrun.")),
    ).toBe(false);
  });
});

describe("AC-110 Plan.Authorize over the wire", () => {
  it("issues one authorization and records it in world state", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);

    const { body } = await authorize(planId, buildId);
    expect(body.accepted).toBe(true);

    const world = (await (await fetch(`${baseUrl}/world-state`)).json()) as {
      currentPlan: PersistedPlan;
    };
    expect(world.currentPlan.authorization).toMatchObject({
      authorizedBy: "operator-1",
      stageName: CLAUDE_CODE_STAGE,
      maxBudgetUsd: 5,
      singleUse: true,
    });
    // The binding travels to the client so the operator can see what was
    // bound — it is a fact to display, never a value the client supplies.
    expect(world.currentPlan.authorization?.planContentHash).toBe(world.currentPlan.contentHash);
  });

  it("refuses an agent credential and an uncredentialed caller, with zero mutation", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);

    const before = snapshotAllPersistedState();

    const asAgent = await authorize(planId, buildId, {}, builderToken);
    expect(asAgent.body.accepted).toBe(false);
    expect(String(asAgent.body.reason)).toMatch(/authenticated operator/i);

    const asNobody = await authorize(planId, buildId, {}, null);
    expect(asNobody.body.accepted).toBe(false);
    expect(String(asNobody.body.reason)).toMatch(/authenticated operator/i);

    expect(snapshotAllPersistedState()).toEqual(before);
    expect(
      (await (await gate(buildId)).json() as { permitted: boolean }).permitted,
    ).toBe(false);
  });

  it("refuses a second authorization, and the gate still reports the first", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);
    expect((await authorize(planId, buildId)).body.accepted).toBe(true);

    const second = await authorize(planId, buildId, { maxBudgetUsd: 25 });
    expect(second.body.accepted).toBe(false);
    expect(String(second.body.reason)).toMatch(/single-use and is not reissued/i);

    const body = (await (await gate(buildId)).json()) as Record<string, unknown>;
    expect((body.authorization as { maxBudgetUsd: number }).maxBudgetUsd).toBe(5);
  });

  it("emits the declared event, with the backend's own hash on it", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);
    await authorize(planId, buildId);

    const events = (await (await fetch(`${baseUrl}/events`)).json()) as {
      type: string;
      payload: Record<string, unknown>;
    }[];
    const authorized = events.filter((e) => e.type === "operator.execution_authorized");
    expect(authorized).toHaveLength(1);
    expect(authorized[0]?.payload.planContentHash).toBe(
      planContentHash((persistence.getEntity<PersistedPlan>("plans", planId) as PersistedPlan).plan),
    );
    expect(authorized[0]?.payload).not.toHaveProperty("acknowledgedContentHash");
  });

  it("nothing anywhere in the log started a run", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);
    await authorize(planId, buildId);

    const events = (await (await fetch(`${baseUrl}/events`)).json()) as { type: string }[];
    for (const forbidden of ["agentrun.started", "stage.started", "build.started"]) {
      expect(events.some((e) => e.type === forbidden)).toBe(false);
    }
  });
});
