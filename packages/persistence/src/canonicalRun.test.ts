import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FoundryEventSchema, type FoundryEvent } from "@foundry/event-types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PersistenceService } from "./persistenceService";

// Cross-validates the backend-authoritative reducer (reducer.ts) against
// the FBL-022 canonical recorded run fixture — the same ordered event log
// the frontend mock runtime's WorldState reducer already produces and is
// snapshotted against. This is deliberately a *comparison*, not shared
// code (see reducer.ts's module comment): two independently written
// reducers agreeing on every WorldState-relevant field for all 124 events
// is the proof that FBL-023 has not invented a conflicting domain model.
const FIXTURE_PATH = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "apps",
  "agent-city",
  "src",
  "lib",
  "mock-runtime",
  "__fixtures__",
  "v1-canonical-run.json",
);

interface RecordedRun {
  seed: string;
  eventCount: number;
  events: FoundryEvent[];
  finalWorldState: {
    buildings: unknown[];
    agents: unknown[];
    currentBuild: unknown;
    activeTransfers: unknown[];
    approvals: unknown[];
    inventoryCounts: Record<string, number>;
    health: { status: string; reasons: string[] };
    lastProcessedEventId: string | null;
  };
}

function loadRecordedRun(): RecordedRun {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")) as RecordedRun;
}

describe("FBL-023 persistence vs. FBL-022 canonical recorded run", () => {
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

  it("replays all 124 canonical events and reconstructs a WorldState matching the recorded run", () => {
    const recorded = loadRecordedRun();
    expect(recorded.eventCount).toBe(124);

    for (const rawEvent of recorded.events) {
      const event = FoundryEventSchema.parse(rawEvent);
      const result = service.appendEvent(event);
      expect(result.applied).toBe(true);
    }

    const snapshot = service.getWorldStateSnapshot();

    expect(snapshot.lastProcessedEventId).toBe(recorded.finalWorldState.lastProcessedEventId);
    expect(snapshot.health).toEqual(recorded.finalWorldState.health);
    expect(snapshot.inventoryCounts).toEqual(recorded.finalWorldState.inventoryCounts);
    expect(snapshot.currentBuild).toEqual(recorded.finalWorldState.currentBuild);
    expect(snapshot.approvals).toEqual(recorded.finalWorldState.approvals);
    expect(snapshot.activeTransfers).toEqual(recorded.finalWorldState.activeTransfers);

    // `updatedAt` is intentionally excluded: the frontend mock reducer
    // (worldStateReducer.ts) stamps every mutation with a fixed constant
    // rather than the real event timestamp; this backend reducer uses the
    // authoritative `event.occurredAt` instead, which is the more correct
    // behavior for a real backend, not a divergence to paper over.
    const sortById = <T extends { id: string; updatedAt?: unknown }>(items: T[]) =>
      [...items]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(({ updatedAt: _updatedAt, ...rest }) => rest);
    expect(sortById(snapshot.agents as { id: string }[])).toEqual(
      sortById(recorded.finalWorldState.agents as { id: string }[]),
    );
    expect(sortById(snapshot.buildings as { id: string }[])).toEqual(
      sortById(recorded.finalWorldState.buildings as { id: string }[]),
    );
  });

  it("preserves full entity fidelity beyond the WorldState projection (stages, requirements, tasks, artifacts, transfers, upgrades)", () => {
    const recorded = loadRecordedRun();
    for (const rawEvent of recorded.events) {
      service.appendEvent(FoundryEventSchema.parse(rawEvent));
    }

    expect(service.listEntities("buildStages")).toHaveLength(7);
    expect(service.listEntities("requirements").length).toBeGreaterThan(0);
    expect(service.listEntities("artifacts")).toHaveLength(7);
    expect(service.listEntities("transfers")).toHaveLength(3);
    expect(service.listEntities("agentRuns").length).toBeGreaterThan(0);
    expect(service.listEntities("upgrades")).toHaveLength(1);
    expect(service.listEntities("approvals")).toHaveLength(1);
    expect(service.listEntities("projects")).toHaveLength(1);

    const upgrade = service.listEntities<{ status: string; toLevel: number }>("upgrades")[0];
    expect(upgrade?.status).toBe("completed");
    expect(upgrade?.toLevel).toBe(2);

    const warehouse = service.getBuilding("warehouse");
    expect(warehouse?.level).toBe(2);
    expect(warehouse?.capabilities.length).toBeGreaterThan(0);
  });
});
