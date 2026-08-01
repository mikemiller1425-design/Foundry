import type { FoundryEvent } from "@foundry/event-types";
import { PersistenceService } from "@foundry/persistence";

/**
 * Operator helper for the FBL-031 visual check.
 *
 * Brings the world to the point where the tenth successful package has
 * been processed — the seeded history of 9 plus this build's one, per the
 * M-06 counting rule — so the Warehouse upgrade becomes *genuinely*
 * eligible.
 *
 * It appends **declared events only**, through the same `appendEvent`
 * path everything else uses. It does not make the upgrade eligible by
 * fiat: the eligibility evaluation, the operator approval, the start, and
 * the completion must all still be driven as real commands, through every
 * FBL-025/029/030/031 guard. This only supplies the operational history
 * a real run would have accumulated.
 */
const dbPath = process.env.FOUNDRY_DB_PATH;
if (!dbPath) throw new Error("FOUNDRY_DB_PATH is required");

const persistence = new PersistenceService(dbPath);

const base = {
  occurredAt: new Date().toISOString(),
  actorType: "backend",
  actorId: "backend",
  correlationId: "fbl-031-seed",
  severity: "info",
  schemaVersion: 1,
} as const;

const events = [
  {
    ...base,
    id: "fbl031-build-started",
    type: "build.started",
    entityType: "Build",
    entityId: "build-1",
    payload: { stageIds: ["stage-deployment"] },
  },
  {
    ...base,
    id: "fbl031-build-completed",
    type: "build.completed",
    entityType: "Build",
    entityId: "build-1",
    payload: {
      finalArtifactIds: ["artifact-build-package"],
      completedAt: new Date().toISOString(),
    },
  },
] as unknown as FoundryEvent[];

for (const event of events) persistence.appendEvent(event);

const snapshot = persistence.getWorldStateSnapshot();
console.log(
  `seeded to ${snapshot.inventoryCounts.successfulPackages ?? 0}/10 successful packages (db: ${dbPath})`,
);
persistence.close();
