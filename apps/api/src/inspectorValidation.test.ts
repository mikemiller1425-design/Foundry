import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FoundryEvent } from "@foundry/event-types";
import { PersistenceService, PrincipalRegistry } from "@foundry/persistence";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

/**
 * FBL-029 over real HTTP.
 *
 * The persistence-level suite proves the guard; this one proves the
 * *transport* cannot get around it — that identity is established by the
 * `Authorization` header and that nothing a client puts in the body can
 * change who it is.
 */

/**
 * A fresh stage per test. Sharing one would couple the tests through the
 * conflict guard: once a stage has a recorded decision, a *different*
 * later decision is correctly rejected, so a shared stage would make
 * each test depend on the order of the ones before it.
 */
let STAGE = "stage-qa";

let dir: string;
let persistence: PersistenceService;
let principals: PrincipalRegistry;
let server: Server;
let baseUrl: string;
let inspectorToken: string;
let builderToken: string;

function seedEvent(overrides: Partial<FoundryEvent>): FoundryEvent {
  return {
    id: overrides.id ?? "seed",
    type: "system.started",
    occurredAt: "2026-08-01T00:00:00.000Z",
    actorType: "backend",
    actorId: "backend",
    entityType: "System",
    entityId: "neighborhood-1",
    correlationId: "corr-1",
    severity: "info",
    schemaVersion: 1,
    payload: { serviceVersion: "1.0.0", neighborhoodId: "neighborhood-1" },
    ...overrides,
  } as FoundryEvent;
}

async function validate(
  outcome: "passed" | "failed",
  token: string | undefined,
  extra: Record<string, unknown> = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}/commands`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      commandType: "BuildStage.Validate",
      entityId: STAGE,
      params:
        outcome === "passed"
          ? { outcome, evidenceIds: [], passedRequirementIds: [] }
          : { outcome, evidenceIds: [], failedRequirementIds: ["req-1"], retryEligible: true },
      ...extra,
    }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "foundry-api-inspector-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  principals = new PrincipalRegistry();
  inspectorToken = principals.issueAgentCredential("agent-inspector");
  builderToken = principals.issueAgentCredential("agent-builder");

  server = createApp(persistence, principals);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  const suffix = Math.random().toString(36).slice(2);
  STAGE = `stage-qa-${suffix}`;
  persistence.appendEvent(
    seedEvent({
      id: `c-${suffix}`,
      type: "stage.created",
      entityType: "BuildStage",
      entityId: STAGE,
      payload: {},
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: `s-${suffix}`,
      type: "stage.started",
      entityType: "BuildStage",
      entityId: STAGE,
      payload: { assignedAgentIds: ["agent-inspector"], sourceBuildingId: "qa" },
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: `v-${suffix}`,
      type: "stage.validation_started",
      entityType: "BuildStage",
      entityId: STAGE,
      payload: {},
    }),
  );
});

describe("FBL-029 over HTTP — credential decides identity", () => {
  it("accepts a validation presented with the Inspector credential", async () => {
    const { status, body } = await validate("passed", inspectorToken);
    expect(status).toBe(200);
    expect(body.accepted).toBe(true);
  });

  it("rejects the same request with the Builder credential", async () => {
    const { body } = await validate("passed", builderToken);
    expect(body.accepted).toBe(false);
    expect(String(body.reason)).toMatch(/F-05/);
  });

  it("rejects a request with no credential at all", async () => {
    const { body } = await validate("passed", undefined);
    expect(body.accepted).toBe(false);
  });

  it("rejects a request with a fabricated credential", async () => {
    const { body } = await validate("passed", "not-a-real-token");
    expect(body.accepted).toBe(false);
  });

  it("rejects a body that claims to be the Inspector without the credential", async () => {
    // The pre-FBL-029 attack: identity asserted in the payload.
    const { status, body } = await validate("passed", undefined, {
      actor: { actorType: "agent", actorId: "agent-inspector" },
    });
    expect(status).toBe(403);
    expect(body.error).toBe("actor_mismatch");
    expect(body.accepted).toBe(false);
  });

  it("rejects a body claiming a different identity than the credential presents", async () => {
    const { status, body } = await validate("passed", builderToken, {
      actor: { actorType: "agent", actorId: "agent-inspector" },
    });
    expect(status).toBe(403);
    expect(body.error).toBe("actor_mismatch");
  });

  it("accepts a body actor that agrees with the credential", async () => {
    const { body } = await validate("passed", inspectorToken, {
      actor: { actorType: "agent", actorId: "agent-inspector" },
    });
    expect(body.accepted).toBe(true);
  });

  it("leaves persisted state untouched when a validation is refused", async () => {
    const before = persistence.getAllEvents().length;
    await validate("passed", builderToken);
    await validate("passed", undefined);
    await validate("passed", "not-a-real-token");
    expect(persistence.getAllEvents()).toHaveLength(before);
  });
});

describe("FBL-029 over HTTP — authoritative results reach clients", () => {
  it("delivers the validation event over SSE exactly once", async () => {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/events/stream`, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    });
    const reader = response.body?.getReader();
    if (!reader) throw new Error("no stream body");

    try {
      const { body } = await validate("passed", inspectorToken);
      expect(body.accepted).toBe(true);

      // Read until the validation event arrives, rather than waiting a
      // fixed interval — the assertion is about the event, not a delay.
      const decoder = new TextDecoder();
      let buffer = "";
      let occurrences = 0;
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        occurrences = buffer.split("stage.validation_passed").length - 1;
        if (occurrences > 0) break;
      }

      expect(occurrences).toBe(1);
    } finally {
      controller.abort();
    }
  }, 20_000);

  it("exposes the validation record for inspection", async () => {
    await validate("failed", inspectorToken);

    const response = await fetch(`${baseUrl}/entities/stageValidations/${STAGE}`);
    expect(response.status).toBe(200);
    const record = (await response.json()) as {
      decisions: { decision: string; validatorAgentId: string; validatorRole: string }[];
    };

    const latest = record.decisions.at(-1);
    expect(latest?.decision).toBe("failed");
    expect(latest?.validatorAgentId).toBe("agent-inspector");
    expect(latest?.validatorRole).toBe("inspector");
  });
});
