import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMMAND_TYPES, WorldStateSchema } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { ENTITY_TYPES, PersistenceService } from "@foundry/persistence";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";

let dir: string;
let persistence: PersistenceService;
let server: Server;
let baseUrl: string;

function objectiveEvent(): FoundryEvent {
  return {
    id: "evt-objective",
    type: "operator.objective_submitted",
    occurredAt: "2026-07-30T00:00:00.000Z",
    actorType: "operator",
    actorId: "operator-1",
    entityType: "Project",
    entityId: "project-1",
    correlationId: "corr-1",
    severity: "info",
    schemaVersion: 1,
    payload: { objective: "Build a thing", projectId: "project-1" },
  } as FoundryEvent;
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "foundry-api-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  persistence.appendEvent(objectiveEvent());

  server = createApp(persistence);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected server to bind a port");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

function snapshotAllPersistedState() {
  return {
    events: persistence.getAllEvents(),
    entities: Object.fromEntries(
      ENTITY_TYPES.map((type) => [type, persistence.listEntities<{ id: string; status?: string }>(type)]),
    ) as Record<string, { id: string; status?: string }[]>,
  };
}

describe("GET /health", () => {
  it("returns 200 with a status field", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("@foundry/api");
  });
});

describe("GET /world-state", () => {
  it("returns a WorldState-shaped snapshot that validates against the contract schema", async () => {
    const res = await fetch(`${baseUrl}/world-state`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => WorldStateSchema.parse(body)).not.toThrow();
    expect(body.currentBuild).toBeNull();
    expect(Array.isArray(body.buildings)).toBe(true);
    expect(Array.isArray(body.agents)).toBe(true);
  });
});

describe("GET /entities/:entityType", () => {
  it("lists entities for every known entity type", async () => {
    for (const entityType of ENTITY_TYPES) {
      const res = await fetch(`${baseUrl}/entities/${entityType}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(await res.json())).toBe(true);
    }
  });

  it("returns a single entity by id", async () => {
    const res = await fetch(`${baseUrl}/entities/projects/project-1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("project-1");
  });

  it("404s for an unknown entity id", async () => {
    const res = await fetch(`${baseUrl}/entities/projects/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it("400s for an unknown entity type (no undocumented payload shapes)", async () => {
    const res = await fetch(`${baseUrl}/entities/not-a-real-type`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unknown_entity_type");
  });
});

describe("GET /unknown-route", () => {
  it("404s", async () => {
    const res = await fetch(`${baseUrl}/nope`);
    expect(res.status).toBe(404);
  });
});

describe("POST /commands — shape-valid but incomplete/illegal submissions are still rejected without mutation", () => {
  it("accepts every documented command type for shape validation and rejects it (no entityId, no target entity) with a structured, non-mutating response", async () => {
    for (const commandType of COMMAND_TYPES) {
      const before = snapshotAllPersistedState();

      const res = await fetch(`${baseUrl}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandType, params: {} }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.accepted).toBe(false);
      expect(body.commandType).toBe(commandType);
      expect(typeof body.reason).toBe("string");
      expect(body.reason.length).toBeGreaterThan(0);

      expect(snapshotAllPersistedState()).toEqual(before);
    }
  });

  it("rejects an unknown commandType with 400 and mutates nothing", async () => {
    const before = snapshotAllPersistedState();
    const res = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commandType: "Agent.Teleport", params: {} }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
    expect(snapshotAllPersistedState()).toEqual(before);
  });

  it("rejects a request with an undocumented top-level shape (missing commandType) and mutates nothing", async () => {
    const before = snapshotAllPersistedState();
    const res = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foo: "bar" }),
    });
    expect(res.status).toBe(400);
    expect(snapshotAllPersistedState()).toEqual(before);
  });

  it("rejects malformed JSON with 400 and mutates nothing", async () => {
    const before = snapshotAllPersistedState();
    const res = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    expect(snapshotAllPersistedState()).toEqual(before);
  });
});

describe("POST /commands — FBL-025 real enforcement (a legal command now mutates persisted state)", () => {
  it("accepts a legal Agent.Assign and appends exactly the resulting event + entity update", async () => {
    const before = snapshotAllPersistedState();

    const res = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commandType: "Agent.Assign",
        entityId: "agent-architect",
        params: { taskId: "task-1", stageId: "stage-1", destinationBuildingId: "construction-office" },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.event.type).toBe("agent.assigned");

    const after = snapshotAllPersistedState();
    expect(after.events.length).toBe(before.events.length + 1);
    const agent = after.entities.agents?.find((a) => a.id === "agent-architect");
    expect(agent?.status).toBe("assigned");
  });

  it("rejects an illegal transition for a real entity (Agent already assigned) with zero mutation", async () => {
    await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commandType: "Agent.Assign",
        entityId: "agent-builder",
        params: { taskId: "task-2", stageId: "stage-1", destinationBuildingId: "construction-office" },
      }),
    });
    const before = snapshotAllPersistedState();

    const res = await fetch(`${baseUrl}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commandType: "Agent.Assign",
        entityId: "agent-builder",
        params: { taskId: "task-3", stageId: "stage-1", destinationBuildingId: "construction-office" },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(false);
    expect(snapshotAllPersistedState()).toEqual(before);
  });
});

describe("existing persistence reconstruction remains green through the API surface", () => {
  it("world-state and entity endpoints reflect the same data a direct PersistenceService read would", async () => {
    const direct = persistence.getWorldStateSnapshot();
    const res = await fetch(`${baseUrl}/world-state`);
    const viaApi = await res.json();
    expect(viaApi).toEqual(JSON.parse(JSON.stringify(direct)));
  });
});
