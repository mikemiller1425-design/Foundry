import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FoundryEvent } from "@foundry/event-types";
import { PersistenceService, PrincipalRegistry } from "@foundry/persistence";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

/**
 * FBL-030 over real HTTP: the operator credential decides authority, and
 * the authoritative resolution reaches subscribed clients.
 */

let APPROVAL = "approval-1";
const STAGE = "stage-deployment";

let dir: string;
let persistence: PersistenceService;
let principals: PrincipalRegistry;
let server: Server;
let baseUrl: string;
let operatorToken: string;
let inspectorToken: string;

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

async function resolveApproval(
  command: "Approve" | "Reject" | "RequestRevision",
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
      commandType: `Approval.${command}`,
      entityId: APPROVAL,
      params: {},
      ...extra,
    }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "foundry-api-approval-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  principals = new PrincipalRegistry();
  operatorToken = principals.issueOperatorCredential("operator-1");
  inspectorToken = principals.issueAgentCredential("agent-inspector");

  persistence.appendEvent(
    seedEvent({
      id: "evt-objective",
      type: "operator.objective_submitted",
      entityType: "Project",
      entityId: "project-1",
      payload: { objective: "Ship it", projectId: "project-1" },
    }),
  );
  // A Build must exist before the Approval: the reducer stamps the
  // approval's `buildId` from the current build, and an empty one fails
  // contract validation on the `/world-state` projection.
  persistence.appendEvent(
    seedEvent({
      id: "evt-build",
      type: "build.created",
      entityType: "Build",
      entityId: "build-1",
      payload: { buildId: "build-1", projectId: "project-1", objective: "Ship it" },
    }),
  );
  persistence.appendEvent(
    seedEvent({
      id: "evt-stage",
      type: "stage.created",
      entityType: "BuildStage",
      entityId: STAGE,
      payload: {},
    }),
  );
  // `stage.started` is what sets the reducer's current stage, and the
  // approval's `stageId` is stamped from it. Without this the approval
  // would carry an empty stageId and fail contract validation.
  persistence.appendEvent(
    seedEvent({
      id: "evt-stage-started",
      type: "stage.started",
      entityType: "BuildStage",
      entityId: STAGE,
      payload: { assignedAgentIds: ["agent-builder"], sourceBuildingId: "qa" },
    }),
  );

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
  // A fresh approval per test: once resolved, a decision is immutable, so
  // sharing one would couple each test to the order of those before it.
  const suffix = Math.random().toString(36).slice(2);
  APPROVAL = `approval-${suffix}`;
  persistence.appendEvent(
    seedEvent({
      id: `a-${suffix}`,
      type: "approval.requested",
      entityType: "Approval",
      entityId: APPROVAL,
      payload: {
        approvalId: APPROVAL,
        title: "Deploy to the dock",
        reason: "QA validation passed",
        riskClass: "R2",
        evidenceIds: ["artifact-build-package"],
        recommendedAction: "Approve to permit the transfer",
      },
    }),
  );
});

describe("FBL-030 over HTTP — the credential decides authority", () => {
  it("accepts a resolution presented with the operator credential", async () => {
    const { status, body } = await resolveApproval("Approve", operatorToken);
    expect(status).toBe(200);
    expect(body.accepted).toBe(true);
  });

  it("rejects a resolution with no credential", async () => {
    const { body } = await resolveApproval("Approve", undefined);
    expect(body.accepted).toBe(false);
  });

  it("rejects a resolution presented with an agent credential", async () => {
    const { body } = await resolveApproval("Approve", inspectorToken);
    expect(body.accepted).toBe(false);
  });

  it("rejects a body claiming operator authority without the credential", async () => {
    const { status, body } = await resolveApproval("Approve", undefined, {
      actor: { actorType: "operator", actorId: "operator-1" },
    });
    expect(status).toBe(403);
    expect(body.error).toBe("actor_mismatch");
  });

  it("rejects a payload asserting a different resolver", async () => {
    const { body } = await resolveApproval("Approve", operatorToken, {
      params: { resolvedBy: "someone-else" },
    });
    expect(body.accepted).toBe(false);
    expect(String(body.reason)).toMatch(/does not match the authenticated operator/);
  });

  it("leaves persisted state untouched when a resolution is refused", async () => {
    const before = persistence.getAllEvents().length;
    await resolveApproval("Approve", undefined);
    await resolveApproval("Approve", inspectorToken);
    await resolveApproval("Reject", "not-a-real-token");
    expect(persistence.getAllEvents()).toHaveLength(before);
  });
});

describe("FBL-030 over HTTP — the authoritative resolution reaches clients", () => {
  it("delivers the approval decision over SSE exactly once", async () => {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/events/stream`, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    });
    const reader = response.body?.getReader();
    if (!reader) throw new Error("no stream body");

    try {
      expect((await resolveApproval("Approve", operatorToken)).body.accepted).toBe(true);

      // Read until the decision arrives rather than waiting a fixed
      // interval — the assertion is about the event, not a delay.
      const decoder = new TextDecoder();
      let buffer = "";
      let occurrences = 0;
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        occurrences = buffer.split("approval.approved").length - 1;
        if (occurrences > 0) break;
      }

      expect(occurrences).toBe(1);
    } finally {
      controller.abort();
    }
  }, 20_000);

  it("exposes the resolved approval, with its resolver, for inspection", async () => {
    await resolveApproval("Approve", operatorToken, { params: { resolutionNote: "Ship it" } });

    const response = await fetch(`${baseUrl}/entities/approvals/${APPROVAL}`);
    const approval = (await response.json()) as Record<string, unknown>;

    expect(approval.status).toBe("approved");
    expect(approval.resolvedBy).toBe("operator-1");
    expect(approval.resolutionNote).toBe("Ship it");
    expect(approval.resolvedAt).toBeTruthy();
  });

  it("reports a pending approval in the world-state snapshot", async () => {
    const response = await fetch(`${baseUrl}/world-state`);
    const snapshot = (await response.json()) as {
      approvals?: { id: string; status: string }[];
      message?: string;
    };
    expect(response.status, JSON.stringify(snapshot).slice(0, 600)).toBe(200);
    expect(snapshot.approvals?.some((a) => a.id === APPROVAL && a.status === "pending")).toBe(true);
  });
});
