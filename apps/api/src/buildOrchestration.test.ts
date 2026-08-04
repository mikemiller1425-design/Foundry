import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planRevision, type PersistedPlan } from "@foundry/contracts";
import {
  APPROVAL_GATED_STAGE,
  ENTITY_TYPES,
  ORCHESTRATED_STAGES,
  PersistenceService,
  PrincipalRegistry,
  gateApprovalId,
} from "@foundry/persistence";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

/**
 * AC-109 — `POST /builds/{buildId}/start` across the wire.
 *
 * The unit tests in `@foundry/persistence` prove the orchestration rules;
 * these prove the operator's browser can reach them, that the response is
 * the enforcement layer's own ruling, and that a full run drives a real
 * build to the approval gate through the HTTP surface alone — no seed
 * script and no hand-submitted command (F-110).
 */

const OBJECTIVE = "Add a JSON task store module with a test suite";

let dir: string;
let persistence: PersistenceService;
let server: Server;
let baseUrl: string;
let operatorToken: string;
let builderToken: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "foundry-api-orchestration-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));

  const principals = new PrincipalRegistry();
  operatorToken = principals.issueOperatorCredential("operator-1");
  builderToken = principals.issueAgentCredential("agent-builder");

  // Unpaced: pacing is a display concern and every step is enforced
  // identically at any delay.
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

function authed(token?: string) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function submitObjective(): Promise<{ buildId: string; planId: string }> {
  const res = await fetch(`${baseUrl}/objectives`, {
    method: "POST",
    headers: authed(operatorToken),
    body: JSON.stringify({ objective: OBJECTIVE, workspace: "foundry_managed", riskClass: "R2" }),
  });
  const body = (await res.json()) as { buildId: string; planId: string };
  expect(res.status).toBe(201);
  return body;
}

async function reviewPlan(planId: string, buildId: string, decision = "proceed") {
  const persisted = persistence.getEntity<PersistedPlan>("plans", planId) as PersistedPlan;
  const res = await fetch(`${baseUrl}/commands`, {
    method: "POST",
    headers: authed(operatorToken),
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

function startRun(buildId: string, token?: string) {
  return fetch(`${baseUrl}/builds/${buildId}/start`, { method: "POST", headers: authed(token) });
}

/** The run continues after the 202; wait for the world to reach the gate. */
async function waitForGate(buildId: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const build = persistence.getEntity<{ status: string }>("builds", buildId);
    if (build?.status === "waiting_for_approval") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("The orchestrated run did not reach the approval gate in time");
}

function snapshotAllPersistedState() {
  return {
    events: persistence.getAllEvents(),
    entities: Object.fromEntries(
      ENTITY_TYPES.map((type) => [type, persistence.listEntities(type)]),
    ),
  };
}

describe("AC-109 POST /builds/{id}/start — a real build reaches the approval gate (F-110)", () => {
  it("orchestrates six stages and stops at a pending approval", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);

    const res = await startRun(buildId, operatorToken);
    expect(res.status).toBe(202);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accepted).toBe(true);
    expect(body.simulated).toBe(true);
    expect(body.executor).toBe("mock");
    expect(body.stopsAt).toBe("approval_gate");
    expect(String(body.note)).toMatch(/no Claude Code is invoked/i);

    await waitForGate(buildId);

    const stages = persistence.listEntities<{ name: string; status: string }>("buildStages");
    expect(stages.map((s) => s.name)).toEqual([...ORCHESTRATED_STAGES]);
    expect(stages.every((s) => s.status === "completed")).toBe(true);
    expect(stages.some((s) => s.name === APPROVAL_GATED_STAGE)).toBe(false);

    const approvals = persistence.listEntities<{ id: string; status: string }>("approvals");
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.id).toBe(gateApprovalId(planId));
    expect(approvals[0]?.status).toBe("pending");

    // Nothing real ran, and nothing moved past the gate.
    const runs = persistence.listEntities<{ runtimeType: string }>("agentRuns");
    expect(runs.every((run) => run.runtimeType === "mock")).toBe(true);
    expect(persistence.listEntities("transfers")).toHaveLength(0);
    expect(persistence.listEntities("upgrades")).toHaveLength(0);
  });

  it("exposes the whole run over the existing world-state and events surface", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);
    expect((await startRun(buildId, operatorToken)).status).toBe(202);
    await waitForGate(buildId);

    const world = (await (await fetch(`${baseUrl}/world-state`)).json()) as {
      currentBuild: { status: string } | null;
      approvals: { status: string }[];
    };
    expect(world.currentBuild?.status).toBe("waiting_for_approval");
    expect(world.approvals.some((approval) => approval.status === "pending")).toBe(true);

    const events = (await (await fetch(`${baseUrl}/events`)).json()) as { type: string }[];
    expect(events.filter((event) => event.type === "stage.started")).toHaveLength(
      ORCHESTRATED_STAGES.length,
    );
    expect(events.filter((event) => event.type === "approval.requested")).toHaveLength(1);
    expect(events.some((event) => event.type === "approval.approved")).toBe(false);
    expect(events.some((event) => event.type === "transfer.started")).toBe(false);
  });
});

describe("AC-109 POST /builds/{id}/start — refusals are readable and mutate nothing", () => {
  it("refuses an unauthenticated caller with 403 and zero mutation", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);

    const before = snapshotAllPersistedState();
    const res = await startRun(buildId);
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("unauthorized");
    expect(String(body.reason)).toMatch(/authenticated operator/i);
    expect(body.simulated).toBe(true);
    expect(snapshotAllPersistedState()).toEqual(before);
  });

  it("refuses an agent credential with 403 — an agent may not commission its own run", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);

    const res = await startRun(buildId, builderToken);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe("unauthorized");
  });

  it("answers 404 with a distinct code when the build has no plan", async () => {
    const res = await startRun("build-that-does-not-exist", operatorToken);
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("no_plan");
    expect(String(body.reason)).toMatch(/nothing to orchestrate/i);
  });

  it("answers 409 for an unreviewed plan, and states what to do", async () => {
    const { buildId } = await submitObjective();

    const before = snapshotAllPersistedState();
    const res = await startRun(buildId, operatorToken);
    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("not_startable");
    expect(String(body.reason)).toMatch(/has not been reviewed/i);
    expect(String(body.correctiveAction)).toMatch(/read the plan/i);
    expect(snapshotAllPersistedState()).toEqual(before);
  });

  it("answers 409 for a plan the operator rejected", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId, "rejected");

    const res = await startRun(buildId, operatorToken);
    expect(res.status).toBe(409);
    expect(String(((await res.json()) as { reason: string }).reason)).toMatch(/rejected/);
  });

  it("refuses a second start, and the second attempt advances nothing", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);
    expect((await startRun(buildId, operatorToken)).status).toBe(202);
    await waitForGate(buildId);

    const eventCount = persistence.getAllEvents().length;
    const res = await startRun(buildId, operatorToken);
    expect(res.status).toBe(409);
    expect(String(((await res.json()) as { reason: string }).reason)).toMatch(
      /not planned — a build is started once/,
    );
    expect(persistence.getAllEvents()).toHaveLength(eventCount);
  });

  it("the frontend still cannot force a transition it has no credential for (V1 F-03)", async () => {
    const { buildId, planId } = await submitObjective();
    await reviewPlan(planId, buildId);

    // No credential: exactly what a browser holds by default.
    const res = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commandType: "Build.Start", entityId: buildId, params: {} }),
    });
    const outcome = (await res.json()) as { accepted: boolean; reason: string };
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toMatch(/Starting a build requires an authenticated operator/);
  });
});
