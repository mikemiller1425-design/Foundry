import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FoundryEvent } from "@foundry/event-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PersistenceService } from "./persistenceService";

function event(overrides: Partial<FoundryEvent> = {}): FoundryEvent {
  return {
    id: "evt-1",
    type: "system.started",
    occurredAt: "2026-07-30T00:00:00.000Z",
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

function objectiveEvent(): FoundryEvent {
  return event({
    id: "evt-2",
    type: "operator.objective_submitted",
    entityType: "Project",
    entityId: "project-1",
    payload: { objective: "Build a thing", projectId: "project-1" },
  });
}

describe("PersistenceService", () => {
  let dir: string;
  let dbPath: string;
  let service: PersistenceService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "foundry-persistence-"));
    dbPath = join(dir, "foundry.sqlite");
    service = new PersistenceService(dbPath);
  });

  afterEach(() => {
    service.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("appends a new event and returns applied: true", () => {
    const result = service.appendEvent(objectiveEvent());
    expect(result.applied).toBe(true);
    expect(service.getAllEvents()).toHaveLength(1);
  });

  it("is idempotent: appending the same event id twice does not duplicate the event or re-mutate entities (F-09)", () => {
    service.appendEvent(objectiveEvent());
    const before = service.listEntities("projects");

    const secondResult = service.appendEvent(objectiveEvent());

    expect(secondResult.applied).toBe(false);
    expect(service.getAllEvents()).toHaveLength(1);
    expect(service.listEntities("projects")).toEqual(before);
  });

  it("preserves event order across many appends", () => {
    for (let i = 0; i < 20; i += 1) {
      service.appendEvent(event({ id: `evt-order-${i}`, occurredAt: "2026-07-30T00:00:00.000Z" }));
    }
    const events = service.getAllEvents();
    expect(events.map((e) => e.id)).toEqual(Array.from({ length: 20 }, (_, i) => `evt-order-${i}`));
  });

  it("restart reconstruction: closing and reopening the same database file reproduces an identical WorldState and entity set (F-08)", () => {
    service.appendEvent(objectiveEvent());
    service.appendEvent(
      event({
        id: "evt-3",
        type: "build.created",
        entityType: "Build",
        entityId: "build-1",
        payload: { projectId: "project-1", buildId: "build-1", objective: "Build a thing" },
      }),
    );

    const snapshotBefore = service.getWorldStateSnapshot();
    const eventsBefore = service.getAllEvents();
    const buildBefore = service.getBuild("build-1");
    service.close();

    const reopened = new PersistenceService(dbPath);
    try {
      expect(reopened.getWorldStateSnapshot()).toEqual(snapshotBefore);
      expect(reopened.getAllEvents()).toEqual(eventsBefore);
      expect(reopened.getBuild("build-1")).toEqual(buildBefore);
    } finally {
      reopened.close();
    }
  });

  it("transactional writes: a persisted event is never followed by a state where the entity write is missing", () => {
    service.appendEvent(objectiveEvent());
    const rows = service.getAllEvents();
    expect(rows).toHaveLength(1);
    const project = service.listEntities("projects");
    expect(project).toHaveLength(1);
  });

  it("snapshot plus later-event reconciliation reproduces the same WorldState as a full replay", () => {
    service.appendEvent(objectiveEvent());
    const midpointSnapshot = service.getWorldStateSnapshot();

    const buildCreated = event({
      id: "evt-3",
      type: "build.created",
      entityType: "Build",
      entityId: "build-1",
      payload: { projectId: "project-1", buildId: "build-1", objective: "Build a thing" },
    });
    service.appendEvent(buildCreated);

    const { missedEvents, snapshot } = service.reconcileFromSnapshot(
      midpointSnapshot.lastProcessedEventId,
    );
    expect(missedEvents.map((e) => e.id)).toEqual(["evt-3"]);
    expect(snapshot).toEqual(service.getWorldStateSnapshot());

    // Replaying [midpoint snapshot's already-applied events] + [missedEvents]
    // into a fresh service reproduces the same end state as continuous replay.
    const dir2 = mkdtempSync(join(tmpdir(), "foundry-persistence-reconcile-"));
    const fresh = new PersistenceService(join(dir2, "foundry.sqlite"));
    try {
      fresh.appendEvent(objectiveEvent());
      for (const missed of missedEvents) {
        fresh.appendEvent(missed);
      }
      expect(fresh.getWorldStateSnapshot()).toEqual(service.getWorldStateSnapshot());
    } finally {
      fresh.close();
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  it("reconcileFromSnapshot with an unknown lastProcessedEventId falls back to a full resync", () => {
    service.appendEvent(objectiveEvent());
    const { missedEvents } = service.reconcileFromSnapshot("never-seen-id");
    expect(missedEvents).toHaveLength(1);
  });
});
