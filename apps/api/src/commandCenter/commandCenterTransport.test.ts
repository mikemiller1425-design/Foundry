import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommandCenterSnapshotSchema } from "@foundry/contracts";
import type { PersistedEvent } from "@foundry/event-types";
import { CommandHandler, PersistenceService } from "@foundry/persistence";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { SUPPORTED_VOCABULARIES, resolveVocabulary } from "./eventVocabulary";

let dir: string;
let persistence: PersistenceService;
let handler: CommandHandler;
let server: Server;
let baseUrl: string;

function evt(over: Partial<PersistedEvent> & { id: string }): PersistedEvent {
  return {
    type: "system.started",
    occurredAt: "2026-08-05T00:00:00.000Z",
    actorType: "backend",
    actorId: "backend",
    entityType: "System",
    entityId: "neighborhood-1",
    correlationId: "corr-1",
    severity: "info",
    schemaVersion: 1,
    payload: { serviceVersion: "1.0.0", neighborhoodId: "neighborhood-1" },
    ...over,
  } as PersistedEvent;
}

beforeAll(async () => {
  // Proof 12 / Amendment 5: a temporary database. The operational database at
  // apps/api/data/foundry.sqlite is never opened by this suite.
  dir = mkdtempSync(join(tmpdir(), "foundry-cc-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  handler = new CommandHandler(persistence);

  persistence.appendEvent(
    evt({
      id: "build-created",
      type: "build.created",
      entityType: "Build",
      entityId: "build-1",
      correlationId: "build-1",
      payload: { projectId: "project-1", buildId: "build-1", objective: "Ship the thing" },
    }),
  );
  // One real claude_code run: started, then completed with a recorded cost.
  persistence.appendEvent(
    evt({
      id: "run-started",
      type: "agentrun.started",
      entityType: "AgentRun",
      entityId: "run-1",
      correlationId: "build-1",
      payload: {
        agentId: "agent-builder",
        taskId: "task-1",
        runtimeType: "claude_code",
        riskClass: "R1",
      },
    }),
  );
  persistence.appendEvent(
    evt({
      id: "run-completed",
      type: "agentrun.completed",
      entityType: "AgentRun",
      entityId: "run-1",
      correlationId: "build-1",
      occurredAt: "2026-08-05T00:01:00.000Z",
      payload: {
        exitCode: 0,
        outputArtifactIds: [],
        evidenceIds: ["ev-1"],
        budget: {
          authorizedCeilingUsd: 25,
          actualCostUsd: 0.0790585,
          withinCeiling: true,
          evidenceId: "ev-1",
        },
      },
    }),
  );
  // A briefing, so the snapshot has a real record to echo.
  handler.submit(
    {
      commandType: "Briefing.Create",
      entityId: "brief-1",
      params: {
        briefingId: "brief-1",
        previousAcknowledgedSequence: 0,
        capturedEndSequence: persistence.getLatestSequence(),
        sourceCoverageIds: [],
        externalActionClassifierVersion: 1,
      },
    },
    { actorType: "operator", actorId: "operator-1", authenticated: true },
  );

  server = createApp(persistence);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

function stateFingerprint(): string {
  return JSON.stringify({
    events: persistence.getAllEvents().map((e) => e.id),
    briefings: persistence.listEntities("briefings"),
    policies: persistence.listEntities("decisionBatchPolicies"),
    latest: persistence.getLatestSequence(),
  });
}

describe("proof 1 — schema-validated aggregate snapshot", () => {
  it("GET /command-center parses against the published contract schema", async () => {
    const res = await fetch(`${baseUrl}/command-center`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = CommandCenterSnapshotSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(body.snapshotVersion).toBe("command-center-v1");
  });
});

describe("proof 2 — composed only from accepted 1b-ii projections", () => {
  it("every Command Center surface is present and matches its projection", async () => {
    const body = await (await fetch(`${baseUrl}/command-center`)).json();
    // All eight 1b-ii surfaces reachable from one read.
    expect(body).toHaveProperty("missions");
    expect(body).toHaveProperty("briefing");
    expect(body).toHaveProperty("decisionBatchPolicy");
    expect(body).toHaveProperty("externalActions");
    expect(body).toHaveProperty("money");
    expect(body).toHaveProperty("coverage");
    expect(body).toHaveProperty("recommendations");

    // The one real run classifies as ONE external action, exactly as the
    // accepted projection does — the transport did not recount it.
    expect(body.externalActions.projection.actions).toHaveLength(1);
    expect(body.externalActions.projection.actions[0].lifecycleEventIds).toEqual([
      "run-started",
      "run-completed",
    ]);
    // AC-111 cost appears as spent, never as revenue.
    expect(body.money.outcome.byStatus.spent).toHaveLength(1);
    expect(body.money.outcome.byStatus.received).toEqual([]);
    expect(body.money.hasNoReceivedRevenue).toBe(true);
  });
});

describe("proof 3 — no duplicated projection or domain logic in apps/api", () => {
  it("the transport imports projections rather than reimplementing them", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./snapshotRoute.ts", import.meta.url), "utf8");
    // It calls the accepted projections...
    for (const fn of [
      "projectMission",
      "projectExternalActions",
      "projectMonetaryOutcome",
      "projectSourceCoverage",
      "deriveRecommendations",
      "deriveCursor",
      "nextBriefingInterval",
    ]) {
      expect(source).toContain(fn);
    }
    // ...and contains no domain arithmetic or classification of its own.
    expect(source).not.toMatch(/runtimeType\s*===/);
    expect(source).not.toMatch(/actualCostUsd/);
    expect(source).not.toMatch(/reduce\(\(total/);
    expect(source).not.toMatch(/agentrun\./);
  });
});

describe("proof 4 — repeated reads cause zero persisted mutation", () => {
  it("event count, entities, and the briefing cursor are unchanged after many reads", async () => {
    const before = stateFingerprint();
    const cursorBefore = (await (await fetch(`${baseUrl}/command-center`)).json()).briefing.cursor;

    for (let i = 0; i < 10; i += 1) await fetch(`${baseUrl}/command-center`);

    const after = stateFingerprint();
    expect(after).toBe(before);
    const cursorAfter = (await (await fetch(`${baseUrl}/command-center`)).json()).briefing.cursor;
    expect(cursorAfter).toBe(cursorBefore);
    // Reading never acknowledges: the briefing stays unacknowledged.
    const body = await (await fetch(`${baseUrl}/command-center`)).json();
    expect(body.briefing.record.acknowledgement).toBeNull();
    expect(body.briefing.cursor).toBe(0);
  });
});

describe("proof 5 — missing evidence stays explicitly absent", () => {
  it("absent facts carry not_recorded / not_connected with a stated reason", async () => {
    const body = await (await fetch(`${baseUrl}/command-center`)).json();
    const mission = body.missions[0];
    expect(mission.autonomy.state).toBe("not_recorded");
    expect(mission.autonomy.reason.length).toBeGreaterThan(0);
    expect(mission.loadout.constraints.state).toBe("not_recorded");
    expect(mission.loadout.constraints.reason.length).toBeGreaterThan(0);

    // Unintegrated sources are named, never omitted, and never "checked".
    const notConnected = body.coverage.filter((c: { connection: string }) => c.connection === "not_connected");
    expect(notConnected.length).toBeGreaterThan(0);
    for (const source of notConnected) expect(source.progress).toBe("not_yet_checked");
    expect(JSON.stringify(body.coverage)).not.toMatch(/nothing was missed/i);

    // The policy ships unconfigured rather than defaulted.
    expect(body.decisionBatchPolicy.enabled).toBe(false);
    expect(body.decisionBatchPolicy.timezone).toBeNull();
    expect(body.decisionBatchPolicy.schedule.kind).toBe("unconfigured");
  });
});

describe("proofs 6-8 — vocabulary negotiation", () => {
  it("proof 6: the default endpoints stay V1-only and carry no Command Center events", async () => {
    const events = await (await fetch(`${baseUrl}/events`)).json();
    const types = events.map((e: { type: string }) => e.type);
    expect(types).not.toContain("briefing.created");
    expect(types).toContain("agentrun.started");

    // Golden: absent parameter and an explicitly-empty `since` behave the same
    // as they did before this package.
    const again = await (await fetch(`${baseUrl}/events?since=`)).json();
    expect(again.map((e: { type: string }) => e.type)).toEqual(types);
  });

  it("proof 7: command-center-v1 includes every accepted Command Center event", async () => {
    const events = await (await fetch(`${baseUrl}/events?vocabulary=command-center-v1`)).json();
    const types = events.map((e: { type: string }) => e.type);
    expect(types).toContain("briefing.created");
    expect(types).toContain("agentrun.started");
    // A superset of the default, never a different set.
    const v1 = await (await fetch(`${baseUrl}/events`)).json();
    for (const e of v1) expect(types).toContain(e.type);
    expect(events.length).toBeGreaterThan(v1.length);
  });

  it("proof 8: unknown vocabularies are refused with 400, never downgraded", async () => {
    for (const bad of ["v2", "command-center-v2", "", "V1", "command-center-v1 "]) {
      const res = await fetch(`${baseUrl}/events?vocabulary=${encodeURIComponent(bad)}`);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("unknown_vocabulary");
      expect(body.supported).toEqual([...SUPPORTED_VOCABULARIES]);
    }
    // The stream refuses identically, before writing stream headers.
    const streamRes = await fetch(`${baseUrl}/events/stream?vocabulary=nope`);
    expect(streamRes.status).toBe(400);
    expect((await streamRes.json()).error).toBe("unknown_vocabulary");

    // An absent parameter is not a value: it is the frozen default.
    expect(resolveVocabulary(null)).toEqual({ ok: true, vocabulary: "v1", explicit: false });
    // An empty string IS a supplied value, and is refused rather than guessed.
    expect(resolveVocabulary("").ok).toBe(false);
  });
});

describe("proof 9 — replay order and Last-Event-ID recovery", () => {
  it("both vocabularies replay in log order and honour a resume cursor", async () => {
    const all = await (await fetch(`${baseUrl}/events?vocabulary=command-center-v1`)).json();
    const ids = all.map((e: { id: string }) => e.id);
    // Log order, ascending by sequence — the same order the default serves.
    const v1ids = (await (await fetch(`${baseUrl}/events`)).json()).map((e: { id: string }) => e.id);
    expect(ids.filter((id: string) => v1ids.includes(id))).toEqual(v1ids);

    // Resume after the first event returns strictly later events, in order.
    const since = await (
      await fetch(`${baseUrl}/events?since=run-started&vocabulary=command-center-v1`)
    ).json();
    expect(since.map((e: { id: string }) => e.id)).toEqual(ids.slice(ids.indexOf("run-started") + 1));

    // The SSE stream accepts the same resume cursor with the opt-in vocabulary.
    const res = await fetch(
      `${baseUrl}/events/stream?lastEventId=run-started&vocabulary=command-center-v1`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    await res.body?.cancel();
  });
});

describe("proof 10 — raw entities remain evidence-only", () => {
  it("raw entity reads still work, and are not the Command Center contract", async () => {
    // Level-3 evidence surface: still available, unrestricted (Decision 10.3).
    const raw = await fetch(`${baseUrl}/entities/briefings`);
    expect(raw.status).toBe(200);
    expect((await raw.json()).length).toBeGreaterThan(0);

    // But the contract is the snapshot: it carries fields the raw entity does
    // not, so a client reading raw entities is not reading the contract.
    const rawBriefing = (await (await fetch(`${baseUrl}/entities/briefings`)).json())[0];
    const snapshot = await (await fetch(`${baseUrl}/command-center`)).json();
    expect(rawBriefing).not.toHaveProperty("cursor");
    expect(rawBriefing).not.toHaveProperty("proposedNextInterval");
    expect(snapshot.briefing).toHaveProperty("cursor");
    expect(snapshot.briefing).toHaveProperty("proposedNextInterval");
    expect(snapshot.briefing).toHaveProperty("intervalIsEmpty");
  });
});

describe("proof 11 — the consumer boundary is structural", () => {
  it("@foundry/contracts does not depend on @foundry/persistence", async () => {
    const { readFileSync } = await import("node:fs");
    const pkg = JSON.parse(
      readFileSync(new URL("../../../../packages/contracts/package.json", import.meta.url), "utf8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    // A frontend consuming the snapshot imports contracts only. If contracts
    // could reach persistence, "read the contract without importing the
    // backend" would be unenforceable.
    expect(Object.keys(deps)).not.toContain("@foundry/persistence");
  });

  it("apps/agent-city depends on contracts and event-types, never persistence", async () => {
    const { readFileSync } = await import("node:fs");
    const pkg = JSON.parse(
      readFileSync(new URL("../../../agent-city/package.json", import.meta.url), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps).toContain("@foundry/contracts");
    expect(deps).not.toContain("@foundry/persistence");
  });
});

describe("authentication ruling (Decision 10.4)", () => {
  it("GET /command-center is unauthenticated, exactly like world-state", async () => {
    const cc = await fetch(`${baseUrl}/command-center`);
    const ws = await fetch(`${baseUrl}/world-state`);
    expect(cc.status).toBe(200);
    expect(ws.status).toBe(200);
    // No credential was sent, and none was demanded.
    expect(cc.headers.get("www-authenticate")).toBeNull();
  });
});
