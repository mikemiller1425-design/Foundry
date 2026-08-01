import type { FoundryEvent } from "@foundry/event-types";
import { PersistenceService } from "@foundry/persistence";

/**
 * Operator helper for the FBL-029 visual check.
 *
 * Brings one QA stage to `validating`, which is the state a validation
 * decision is legal in, so the Inspector path can be exercised by hand
 * against the real service.
 *
 * It appends **declared events only**, through the same
 * `PersistenceService.appendEvent` path everything else uses. It does not
 * bypass, weaken, or shortcut any FBL-025/FBL-029 guard — the validation
 * decision itself must still be submitted as a command, with a
 * credential, exactly as an agent would.
 */
const dbPath = process.env.FOUNDRY_DB_PATH;
if (!dbPath) throw new Error("FOUNDRY_DB_PATH is required");
const stageId = process.env.FOUNDRY_STAGE_ID ?? "stage-qa";

const persistence = new PersistenceService(dbPath);

const base = {
  occurredAt: new Date().toISOString(),
  actorType: "backend",
  actorId: "backend",
  correlationId: `fbl-029-seed-${stageId}`,
  severity: "info",
  schemaVersion: 1,
} as const;

const events = [
  {
    ...base,
    id: `seed-obj-${stageId}`,
    type: "operator.objective_submitted",
    entityType: "Project",
    entityId: "project-1",
    payload: { objective: "FBL-029 visual check", projectId: "project-1" },
  },
  {
    ...base,
    id: `seed-build-${stageId}`,
    type: "build.created",
    entityType: "Build",
    entityId: "build-1",
    payload: { buildId: "build-1", projectId: "project-1", objective: "FBL-029 visual check" },
  },
  {
    ...base,
    id: `seed-created-${stageId}`,
    type: "stage.created",
    entityType: "BuildStage",
    entityId: stageId,
    payload: {},
  },
  {
    ...base,
    id: `seed-started-${stageId}`,
    type: "stage.started",
    entityType: "BuildStage",
    entityId: stageId,
    payload: { assignedAgentIds: ["agent-inspector"], sourceBuildingId: "qa" },
  },
  {
    ...base,
    id: `seed-validating-${stageId}`,
    type: "stage.validation_started",
    entityType: "BuildStage",
    entityId: stageId,
    payload: {},
  },
] as unknown as FoundryEvent[];

for (const event of events) persistence.appendEvent(event);

console.log(`seeded ${stageId} into 'validating' (db: ${dbPath})`);
persistence.close();
