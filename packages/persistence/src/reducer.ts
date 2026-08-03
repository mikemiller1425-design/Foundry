import type {
  Agent,
  AgentRun,
  Approval,
  Artifact,
  Build,
  BuildStage,
  BuildStageName,
  Building,
  HealthSummary,
  Project,
  Requirement,
  Revision,
  Task,
  Transfer,
  Upgrade,
  Vehicle,
} from "@foundry/contracts";
import {
  CAPACITY_CAPABILITY_PREFIX,
  WAREHOUSE_LEVEL_1_CAPACITY,
  WAREHOUSE_LEVEL_2_SEEDED_PACKAGE_COUNT,
  capacityCapability,
} from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { WORLD_AGENTS, WORLD_BUILDINGS, WORLD_VEHICLE } from "@foundry/world-model";

/**
 * Backend-authoritative entity projection. This is a deliberately separate
 * implementation from `apps/agent-city`'s `worldStateReducer.ts` (a
 * frontend-only, WorldState-shaped partial projection for the mock
 * runtime) rather than a shared module — the two must express the *same*
 * event semantics but materialize different shapes (full per-entity
 * records here vs. one read-optimized WorldState there), and the frontend
 * reducer is explicitly documented (ADR-001, event-model.md) as
 * mock-authoritative only. Consistency between them is proven by test
 * (packages/persistence's canonical-run replay test), not by shared code.
 *
 * The V1 event vocabulary (event-model.md) does not carry every
 * descriptive field a full entity record needs (e.g. no event names a
 * BuildStage's destinationBuildingId, a Requirement's description, or a
 * Task's title). Where a field is genuinely event-sourced, this reducer
 * uses the literal event value. Where it is not, it derives a
 * deterministic, documented default so the record is always schema-valid
 * — never an invented narrative fact.
 */

export const SYSTEM_ACTOR_ID = "system";

const NOW = "2026-07-30T00:00:00.000Z";

// domain-model.md → BuildStage V1 limits: exactly these seven named
// stages, in this sequence. No event names a stage — order of
// `stage.created` within a build is mapped positionally onto this fixed
// sequence.
const CANONICAL_STAGE_NAMES: readonly BuildStageName[] = [
  "planning",
  "scaffold",
  "frontend_implementation",
  "backend_implementation",
  "integration",
  "qa_validation",
  "deployment_package",
];

// Default "location" a stage is expected to run at, used only until a
// `stage.started` event supplies the authoritative, event-sourced
// sourceBuildingId.
const STAGE_DEFAULT_SOURCE_BUILDING: Record<BuildStageName, string> = {
  planning: "construction-office",
  scaffold: "construction-office",
  frontend_implementation: "construction-office",
  backend_implementation: "construction-office",
  integration: "construction-office",
  qa_validation: "qa",
  deployment_package: "qa",
};

// No event ever names a stage's destination building. Derived once at
// `stage.created` from the fixed V1 transfer routing (domain-model.md
// Transfer → three named legs: construction_office_to_warehouse,
// warehouse_to_qa, qa_to_deployment_dock) and held stable.
const STAGE_DESTINATION_BUILDING: Record<BuildStageName, string> = {
  planning: "construction-office",
  scaffold: "construction-office",
  frontend_implementation: "construction-office",
  backend_implementation: "construction-office",
  integration: "warehouse",
  qa_validation: "deployment-dock",
  deployment_package: "deployment-dock",
};

// V1 limit (domain-model.md → Upgrade): the only upgrade path is
// Warehouse Level 1 → 2. `upgrade.eligible` never carries from/to levels,
// so this constant supplies them until `upgrade.completed` overrides with
// its own (also-1→2) event-sourced values.
const WAREHOUSE_UPGRADE_FROM_LEVEL = 1;
const WAREHOUSE_UPGRADE_TO_LEVEL = 2;

/**
 * One recorded Inspector decision (FBL-029).
 *
 * A derived projection, not a new domain entity — `domain-model.md` is
 * frozen at Foundation 1.0, and `event-model.md` pins the
 * `stage.validation_*` payloads exactly, so nothing here changes the
 * specification. Every field is read from facts the event log already
 * carries: the envelope supplies the validator and the timestamp, the
 * payload supplies the evidence and requirement references, and the role
 * is resolved from persisted `Agent` state (immutable in V1 — no command
 * changes an Agent's role, so the resolution is deterministic on replay).
 *
 * Kept as an append-only list per stage. A failure is not overwritten by
 * a later pass: principle 17 requires failures to stay inspectable, and a
 * record that the newest decision can erase is not an audit trail.
 */
export interface StageValidationRecord {
  stageId: string;
  decision: "passed" | "failed";
  /** Authenticated validator, taken from the event envelope. */
  validatorAgentId: string;
  validatorActorType: string;
  /** Authoritative role at decision time, resolved from persisted Agent state. */
  validatorRole: string;
  evidenceIds: readonly string[];
  passedRequirementIds: readonly string[];
  failedRequirementIds: readonly string[];
  retryEligible: boolean | null;
  decidedAt: string;
  /** The BuildStage status this decision produced. */
  resultingStageStatus: string;
  /** The event that recorded this decision — the immutable source of truth. */
  eventId: string;
}

/** Per-stage validation history, newest last. */
export interface StageValidationHistory {
  stageId: string;
  decisions: StageValidationRecord[];
}

export interface EntityState {
  projects: Record<string, Project>;
  builds: Record<string, Build>;
  buildStages: Record<string, BuildStage>;
  requirements: Record<string, Requirement>;
  tasks: Record<string, Task>;
  agentRuns: Record<string, AgentRun>;
  artifacts: Record<string, Artifact>;
  transfers: Record<string, Transfer>;
  approvals: Record<string, Approval>;
  revisions: Record<string, Revision>;
  upgrades: Record<string, Upgrade>;
  agents: Record<string, Agent>;
  buildings: Record<string, Building>;
  vehicles: Record<string, Vehicle>;
  /** FBL-029 Inspector decision history, keyed by stage id. */
  stageValidations: Record<string, StageValidationHistory>;
  inventoryCounts: Record<string, number>;
  health: HealthSummary;
  lastProcessedEventId: string | null;
  /** Transient fold context, deterministically recomputed by full replay — never queried directly. */
  currentBuildId: string | null;
  currentStageId: string | null;
  stageSequenceByBuild: Record<string, number>;
  seenEventIds: Set<string>;
}

export type EntityType = keyof Omit<
  EntityState,
  | "inventoryCounts"
  | "health"
  | "lastProcessedEventId"
  | "currentBuildId"
  | "currentStageId"
  | "stageSequenceByBuild"
  | "seenEventIds"
>;

/** Runtime list of every addressable entity-type key, for route/param validation by callers (e.g. `packages/persistence` has no HTTP concerns, but `apps/api` needs this to validate a path segment without duplicating the list). */
export const ENTITY_TYPES: readonly EntityType[] = [
  "projects",
  "builds",
  "buildStages",
  "requirements",
  "tasks",
  "agentRuns",
  "artifacts",
  "transfers",
  "approvals",
  "revisions",
  "upgrades",
  "agents",
  "buildings",
  "vehicles",
  "stageValidations",
];

export interface EntityRef {
  entityType: EntityType;
  entityId: string;
}

export interface ReduceResult {
  state: EntityState;
  touched: EntityRef[];
  /** True unless the event id had already been seen (idempotent no-op). */
  applied: boolean;
}

export function createInitialEntityState(): EntityState {
  return {
    projects: {},
    builds: {},
    buildStages: {},
    requirements: {},
    tasks: {},
    agentRuns: {},
    artifacts: {},
    transfers: {},
    approvals: {},
    revisions: {},
    upgrades: {},
    stageValidations: {},
    agents: Object.fromEntries(
      WORLD_AGENTS.map((a) => [
        a.id,
        {
          id: a.id,
          name: a.name,
          role: a.role,
          status: "idle",
          homeBuildingId: a.homeBuildingId,
          currentBuildingId: a.homeBuildingId,
          authorityLevel: 1,
          runtimeType: "mock",
          createdAt: NOW,
          updatedAt: NOW,
          lastHeartbeatAt: NOW,
        } satisfies Agent,
      ]),
    ),
    buildings: Object.fromEntries(
      WORLD_BUILDINGS.map((b) => [
        b.id,
        {
          id: b.id,
          name: b.name,
          buildingType: b.buildingType,
          level: 1,
          status: "idle",
          position: b.position,
          // world-model.md → Warehouse V1 limits: "Level 1 capacity 25".
          // Only the Warehouse declares a capacity in V1; it is the only
          // building with an upgrade path.
          capabilities:
            b.buildingType === "warehouse" ? [capacityCapability(WAREHOUSE_LEVEL_1_CAPACITY)] : [],
          createdAt: NOW,
          updatedAt: NOW,
        } satisfies Building,
      ]),
    ),
    vehicles: {
      [WORLD_VEHICLE.id]: {
        id: WORLD_VEHICLE.id,
        name: WORLD_VEHICLE.name,
        vehicleType: "utility",
        status: "parked",
        homeBuildingId: WORLD_VEHICLE.homeBuildingId,
        position: { x: 0, y: 0, z: 0 },
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
    inventoryCounts: { successfulPackages: WAREHOUSE_LEVEL_2_SEEDED_PACKAGE_COUNT },
    health: { status: "healthy", reasons: ["nominal"] },
    lastProcessedEventId: null,
    currentBuildId: null,
    currentStageId: null,
    stageSequenceByBuild: {},
    seenEventIds: new Set(),
  };
}

/** Best-effort human label for a stable-id string with no event-sourced name (e.g. "v1-demo-requirement-create-task-15" → "Create Task"). */
function deriveLabelFromId(id: string): string {
  const withoutTrailingNumber = id.replace(/-\d+$/, "");
  const segments = withoutTrailingNumber.split("-").filter(Boolean);
  // Drop generic scope/kind prefixes (e.g. "v1", "demo", "requirement", "task") if more descriptive words remain.
  const meaningful = segments.length > 2 ? segments.slice(2) : segments;
  const words = meaningful.length > 0 ? meaningful : segments;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function touch(touched: EntityRef[], entityType: EntityType, entityId: string): void {
  touched.push({ entityType, entityId });
}

/**
 * Applies one event to entity state, mutating a shallow-cloned copy.
 * Returns which entities changed so the caller can persist only the delta.
 * Duplicate event ids are a no-op (idempotency — required invariant 6).
 */
export function reduceEntities(prev: EntityState, event: FoundryEvent): ReduceResult {
  if (prev.seenEventIds.has(event.id)) {
    return { state: prev, touched: [], applied: false };
  }

  const state: EntityState = {
    ...prev,
    projects: { ...prev.projects },
    builds: { ...prev.builds },
    buildStages: { ...prev.buildStages },
    requirements: { ...prev.requirements },
    tasks: { ...prev.tasks },
    agentRuns: { ...prev.agentRuns },
    artifacts: { ...prev.artifacts },
    transfers: { ...prev.transfers },
    approvals: { ...prev.approvals },
    revisions: { ...prev.revisions },
    upgrades: { ...prev.upgrades },
    agents: { ...prev.agents },
    buildings: { ...prev.buildings },
    vehicles: { ...prev.vehicles },
    inventoryCounts: { ...prev.inventoryCounts },
    stageSequenceByBuild: { ...prev.stageSequenceByBuild },
    seenEventIds: prev.seenEventIds,
  };
  const touched: EntityRef[] = [];

  applyEvent(state, event, touched);

  state.seenEventIds = new Set(prev.seenEventIds);
  state.seenEventIds.add(event.id);
  state.lastProcessedEventId = event.id;

  return { state, touched, applied: true };
}

function updateAgent(
  state: EntityState,
  touched: EntityRef[],
  id: string,
  patch: Partial<Agent>,
): void {
  const existing = state.agents[id];
  if (!existing) return;
  state.agents[id] = { ...existing, ...patch, updatedAt: NOW };
  touch(touched, "agents", id);
}

function updateBuild(state: EntityState, touched: EntityRef[], patch: Partial<Build>): void {
  const id = state.currentBuildId;
  if (!id) return;
  const existing = state.builds[id];
  if (!existing) return;
  state.builds[id] = { ...existing, ...patch, updatedAt: NOW };
  touch(touched, "builds", id);
}

function updateStage(
  state: EntityState,
  touched: EntityRef[],
  id: string,
  patch: Partial<BuildStage>,
): void {
  const existing = state.buildStages[id];
  if (!existing) return;
  state.buildStages[id] = { ...existing, ...patch, updatedAt: NOW };
  touch(touched, "buildStages", id);
}

/**
 * Appends one Inspector decision to a stage's validation history (FBL-029).
 *
 * Append-only on purpose: a later pass never overwrites an earlier
 * failure. Principle 17 requires failures to remain inspectable, and a
 * record the newest decision can erase is not an audit trail.
 *
 * The validator's role is resolved from persisted `Agent` state rather
 * than taken from the event payload, so the recorded role is the
 * authoritative one. V1 Agent roles are immutable (no command changes
 * them), which is what makes this deterministic under full replay.
 */
function recordValidation(
  state: EntityState,
  touched: EntityRef[],
  event: { entityId: string; id: string; occurredAt: string; actorId: string; actorType: string },
  decision: {
    decision: "passed" | "failed";
    evidenceIds: readonly string[];
    passedRequirementIds: readonly string[];
    failedRequirementIds: readonly string[];
    retryEligible: boolean | null;
    resultingStageStatus: string;
  },
): void {
  const stageId = event.entityId;
  const history = state.stageValidations[stageId] ?? { stageId, decisions: [] };

  const record: StageValidationRecord = {
    stageId,
    decision: decision.decision,
    validatorAgentId: event.actorId,
    validatorActorType: event.actorType,
    validatorRole: state.agents[event.actorId]?.role ?? "unknown",
    evidenceIds: [...decision.evidenceIds],
    passedRequirementIds: [...decision.passedRequirementIds],
    failedRequirementIds: [...decision.failedRequirementIds],
    retryEligible: decision.retryEligible,
    decidedAt: event.occurredAt,
    resultingStageStatus: decision.resultingStageStatus,
    eventId: event.id,
  };

  state.stageValidations[stageId] = { stageId, decisions: [...history.decisions, record] };
  touch(touched, "stageValidations", stageId);
}

function ensureRequirement(state: EntityState, id: string, occurredAt: string): Requirement {
  const existing = state.requirements[id];
  if (existing) return existing;
  const label = deriveLabelFromId(id);
  const created: Requirement = {
    id,
    stageId: state.currentStageId ?? "",
    name: label,
    description: `Requirement: ${label}`,
    status: "pending",
    required: true,
    validatorType: "unknown",
    evidenceIds: [],
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  state.requirements[id] = created;
  return created;
}

function updateRequirement(
  state: EntityState,
  touched: EntityRef[],
  id: string,
  occurredAt: string,
  patch: Partial<Requirement>,
): void {
  const base = ensureRequirement(state, id, occurredAt);
  state.requirements[id] = { ...base, ...patch, updatedAt: occurredAt };
  touch(touched, "requirements", id);
}

function ensureTask(state: EntityState, taskId: string, stageId: string, occurredAt: string): Task {
  const existing = state.tasks[taskId];
  if (existing) return existing;
  const created: Task = {
    id: taskId,
    stageId,
    title: deriveLabelFromId(taskId),
    status: "queued",
    assignedAgentId: "",
    riskClass: "R0",
    inputArtifactIds: [],
    outputArtifactIds: [],
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  state.tasks[taskId] = created;
  return created;
}

function updateTask(
  state: EntityState,
  touched: EntityRef[],
  taskId: string,
  stageId: string,
  occurredAt: string,
  patch: Partial<Task>,
): void {
  const base = ensureTask(state, taskId, stageId, occurredAt);
  state.tasks[taskId] = { ...base, ...patch, updatedAt: occurredAt };
  touch(touched, "tasks", taskId);
}

function upsertTransfer(
  state: EntityState,
  touched: EntityRef[],
  id: string,
  patch: Partial<Transfer>,
): void {
  const existing = state.transfers[id];
  if (!existing) return;
  state.transfers[id] = { ...existing, ...patch, updatedAt: NOW };
  touch(touched, "transfers", id);
}

function upsertApproval(
  state: EntityState,
  touched: EntityRef[],
  id: string,
  patch: Partial<Approval>,
): void {
  const existing = state.approvals[id];
  if (!existing) return;
  state.approvals[id] = { ...existing, ...patch };
  touch(touched, "approvals", id);
}

function updateVehicle(state: EntityState, touched: EntityRef[], patch: Partial<Vehicle>): void {
  const id = WORLD_VEHICLE.id;
  const existing = state.vehicles[id];
  if (!existing) return;
  state.vehicles[id] = { ...existing, ...patch, updatedAt: NOW };
  touch(touched, "vehicles", id);
}

function applyEvent(state: EntityState, event: FoundryEvent, touched: EntityRef[]): void {
  switch (event.type) {
    case "system.health_changed": {
      state.health = { status: event.payload.newHealth, reasons: event.payload.reasons };
      return;
    }

    case "operator.objective_submitted": {
      const id = event.entityId;
      state.projects[id] = {
        id,
        name: event.payload.objective,
        objective: event.payload.objective,
        status: "active",
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      };
      touch(touched, "projects", id);
      return;
    }

    case "agent.registered": {
      const id = event.entityId;
      const existing = state.agents[id];
      state.agents[id] = {
        ...(existing ?? {
          id,
          name: id,
          authorityLevel: 1,
          runtimeType: "mock",
          createdAt: event.occurredAt,
          lastHeartbeatAt: event.occurredAt,
        }),
        id,
        role: event.payload.role,
        status: "idle",
        homeBuildingId: event.payload.homeBuildingId,
        currentBuildingId: event.payload.homeBuildingId,
        updatedAt: event.occurredAt,
      } as Agent;
      touch(touched, "agents", id);
      return;
    }
    case "agent.assigned": {
      updateAgent(state, touched, event.entityId, {
        status: "assigned",
        currentTaskId: event.payload.taskId,
        currentStageId: event.payload.stageId,
      });
      updateTask(state, touched, event.payload.taskId, event.payload.stageId, event.occurredAt, {
        status: "assigned",
        assignedAgentId: event.entityId,
      });
      return;
    }
    case "agent.departed":
      updateAgent(state, touched, event.entityId, { status: "traveling" });
      return;
    case "agent.arrived":
      updateAgent(state, touched, event.entityId, {
        currentBuildingId: event.payload.destinationBuildingId,
      });
      return;
    case "agent.started_work": {
      updateAgent(state, touched, event.entityId, { status: "working" });
      const task = state.tasks[event.payload.taskId];
      if (task) {
        updateTask(state, touched, event.payload.taskId, task.stageId, event.occurredAt, {
          status: "running",
        });
      }
      return;
    }
    case "agent.paused":
      updateAgent(state, touched, event.entityId, {
        status: "paused",
        pausedReason: event.payload.reason,
      });
      return;
    case "agent.resumed":
      updateAgent(state, touched, event.entityId, { status: "working", pausedReason: undefined });
      return;
    case "agent.failed": {
      updateAgent(state, touched, event.entityId, {
        status: "failed",
        failureReason: event.payload.message,
      });
      const task = state.tasks[event.payload.taskId];
      if (task) {
        updateTask(state, touched, event.payload.taskId, task.stageId, event.occurredAt, {
          status: "failed",
          failureReason: event.payload.message,
        });
      }
      return;
    }
    case "agent.completed_work": {
      updateAgent(state, touched, event.entityId, { status: "waiting", currentTaskId: undefined });
      const task = state.tasks[event.payload.taskId];
      if (task) {
        updateTask(state, touched, event.payload.taskId, task.stageId, event.occurredAt, {
          status: "completed",
          outputArtifactIds: event.payload.outputArtifactIds,
        });
      }
      return;
    }
    case "agent.returned_home":
      updateAgent(state, touched, event.entityId, {
        status: "idle",
        currentBuildingId: event.payload.homeBuildingId,
        currentTaskId: undefined,
        currentStageId: undefined,
      });
      return;

    case "agentrun.started": {
      const id = event.entityId;
      state.agentRuns[id] = {
        id,
        agentId: event.payload.agentId,
        taskId: event.payload.taskId,
        runtimeType: event.payload.runtimeType,
        status: "running",
        riskClass: event.payload.riskClass,
        startedAt: event.occurredAt,
      };
      touch(touched, "agentRuns", id);
      const task = state.tasks[event.payload.taskId];
      updateTask(
        state,
        touched,
        event.payload.taskId,
        task?.stageId ?? state.currentStageId ?? "",
        event.occurredAt,
        {
          riskClass: event.payload.riskClass,
          status: task?.status === "queued" ? "running" : task?.status,
        },
      );
      return;
    }
    case "agentrun.completed": {
      const run = state.agentRuns[event.entityId];
      if (!run) return;
      state.agentRuns[event.entityId] = {
        ...run,
        status: "completed",
        completedAt: event.occurredAt,
        exitCode: event.payload.exitCode,
        outputArtifactIds: event.payload.outputArtifactIds,
        evidenceIds: event.payload.evidenceIds,
      };
      touch(touched, "agentRuns", event.entityId);
      return;
    }
    case "agentrun.failed": {
      const run = state.agentRuns[event.entityId];
      if (!run) return;
      state.agentRuns[event.entityId] = {
        ...run,
        status: "failed",
        completedAt: event.occurredAt,
        failureCode: event.payload.failureCode,
        failureMessage: event.payload.failureMessage,
        evidenceIds: event.payload.evidenceIds,
      };
      touch(touched, "agentRuns", event.entityId);
      return;
    }
    case "agentrun.timed_out": {
      const run = state.agentRuns[event.entityId];
      if (!run) return;
      state.agentRuns[event.entityId] = {
        ...run,
        status: "timed_out",
        completedAt: event.occurredAt,
        evidenceIds: event.payload.evidenceIds,
        logRef: event.payload.logRef,
      };
      touch(touched, "agentRuns", event.entityId);
      return;
    }

    case "build.created": {
      const id = event.payload.buildId;
      state.builds[id] = {
        id,
        projectId: event.payload.projectId,
        sequenceNumber: 1,
        status: "planned",
        objectiveSnapshot: event.payload.objective,
        // No stage exists yet; `stage.created` fills this in. See the field
        // comment on `BuildSchema` — `""` was not a valid `IdSchema` value
        // and made the projection unserialisable until the first stage.
        currentStageId: null,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      };
      state.currentBuildId = id;
      touch(touched, "builds", id);
      return;
    }
    case "build.planned":
      return;
    case "build.ready":
      updateBuild(state, touched, { status: "ready" });
      return;
    case "build.started":
      updateBuild(state, touched, { status: "running", startedAt: event.occurredAt });
      return;
    case "build.paused":
      updateBuild(state, touched, { status: "paused" });
      return;
    case "build.resumed":
      updateBuild(state, touched, { status: "running" });
      return;
    case "build.completed":
      updateBuild(state, touched, { status: "completed", completedAt: event.payload.completedAt });
      state.inventoryCounts.successfulPackages =
        (state.inventoryCounts.successfulPackages ?? 0) + 1;
      return;
    case "build.failed":
      updateBuild(state, touched, {
        status: "failed",
        failedAt: event.occurredAt,
        failureReason: event.payload.failureCode,
      });
      return;
    case "build.cancelled":
      updateBuild(state, touched, { status: "cancelled", cancelledAt: event.occurredAt });
      return;

    case "stage.created": {
      const id = event.entityId;
      const buildId = state.currentBuildId ?? "";
      const index = state.stageSequenceByBuild[buildId] ?? 0;
      const name = CANONICAL_STAGE_NAMES[index % CANONICAL_STAGE_NAMES.length] ?? "planning";
      state.stageSequenceByBuild[buildId] = index + 1;
      state.buildStages[id] = {
        id,
        buildId,
        name,
        sequence: index + 1,
        status: "planned",
        required: true,
        sourceBuildingId: STAGE_DEFAULT_SOURCE_BUILDING[name],
        destinationBuildingId: STAGE_DESTINATION_BUILDING[name],
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      };
      touch(touched, "buildStages", id);
      return;
    }
    case "stage.ready":
      updateStage(state, touched, event.entityId, { status: "ready" });
      return;
    case "stage.started": {
      state.currentStageId = event.entityId;
      updateStage(state, touched, event.entityId, {
        status: "running",
        startedAt: event.occurredAt,
        assignedAgentIds: event.payload.assignedAgentIds,
        sourceBuildingId: event.payload.sourceBuildingId,
      });
      updateBuild(state, touched, { currentStageId: event.entityId });
      return;
    }
    case "stage.blocked":
      updateStage(state, touched, event.entityId, {
        status: "blocked",
        approvalId: event.payload.approvalId,
      });
      return;
    case "stage.validation_started":
      updateStage(state, touched, event.entityId, { status: "validating" });
      return;
    case "stage.validation_passed":
      recordValidation(state, touched, event, {
        decision: "passed",
        evidenceIds: event.payload.evidenceIds,
        passedRequirementIds: event.payload.passedRequirementIds,
        failedRequirementIds: [],
        retryEligible: null,
        resultingStageStatus: state.buildStages[event.entityId]?.status ?? "validating",
      });
      return;
    case "stage.validation_failed": {
      updateStage(state, touched, event.entityId, {
        status: event.payload.retryEligible ? "validating" : "failed",
        failedAt: event.payload.retryEligible ? undefined : event.occurredAt,
      });
      recordValidation(state, touched, event, {
        decision: "failed",
        evidenceIds: event.payload.evidenceIds,
        passedRequirementIds: [],
        failedRequirementIds: event.payload.failedRequirementIds,
        retryEligible: event.payload.retryEligible,
        resultingStageStatus: state.buildStages[event.entityId]?.status ?? "failed",
      });
      return;
    }
    case "stage.completed":
      updateStage(state, touched, event.entityId, {
        status: "completed",
        completedAt: event.payload.completedAt,
      });
      return;
    case "stage.failed":
      updateStage(state, touched, event.entityId, { status: "failed", failedAt: event.occurredAt });
      return;

    case "revision.requested": {
      const id = event.payload.revisionId;
      state.revisions[id] = {
        id,
        buildId: state.currentBuildId ?? "",
        stageId: event.payload.stageId,
        reason: event.payload.reason,
        requestedBy: event.payload.requestedBy,
        status: "requested",
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        sourceApprovalId: event.payload.sourceApprovalId,
      };
      touch(touched, "revisions", id);
      updateStage(state, touched, event.payload.stageId, { status: "revision_required" });
      return;
    }
    case "revision.started": {
      const revision = state.revisions[event.payload.revisionId];
      if (!revision) return;
      state.revisions[event.payload.revisionId] = {
        ...revision,
        status: "in_progress",
        updatedAt: event.occurredAt,
      };
      touch(touched, "revisions", event.payload.revisionId);
      return;
    }
    case "revision.completed": {
      const revision = state.revisions[event.payload.revisionId];
      if (!revision) return;
      state.revisions[event.payload.revisionId] = {
        ...revision,
        status: "completed",
        resolvedAt: event.occurredAt,
        resultingStageStatus: event.payload.resultingStageStatus,
        updatedAt: event.occurredAt,
      };
      touch(touched, "revisions", event.payload.revisionId);
      return;
    }

    case "requirement.started":
      updateRequirement(state, touched, event.entityId, event.occurredAt, { status: "running" });
      return;
    case "requirement.passed":
      updateRequirement(state, touched, event.entityId, event.occurredAt, {
        status: "passed",
        evidenceIds: event.payload.evidenceIds,
        validatorType: event.payload.validatorType,
      });
      return;
    case "requirement.failed": {
      const current = ensureRequirement(state, event.entityId, event.occurredAt);
      updateRequirement(state, touched, event.entityId, event.occurredAt, {
        status: "failed",
        evidenceIds: event.payload.evidenceIds,
        lastFailureMessage: event.payload.message,
        retryCount: current.retryCount ?? 0,
      });
      return;
    }
    case "requirement.retried": {
      const current = ensureRequirement(state, event.entityId, event.occurredAt);
      updateRequirement(state, touched, event.entityId, event.occurredAt, {
        status: "pending",
        retryCount: (current.retryCount ?? 0) + 1,
      });
      return;
    }

    case "artifact.created": {
      const id = event.entityId;
      state.artifacts[id] = {
        id,
        buildId: state.currentBuildId ?? "",
        stageId: state.currentStageId ?? "",
        artifactType: event.payload.artifactType,
        name: event.payload.name,
        status: "created",
        storageUri: `mock://artifacts/${id}`,
        checksum: "pending",
        createdByAgentId: event.actorId,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      };
      touch(touched, "artifacts", id);
      return;
    }
    case "artifact.validated": {
      const artifact = state.artifacts[event.entityId];
      if (!artifact) return;
      state.artifacts[event.entityId] = {
        ...artifact,
        status: "validated",
        checksum: event.payload.checksum,
        updatedAt: event.occurredAt,
      };
      touch(touched, "artifacts", event.entityId);
      return;
    }
    case "artifact.ready": {
      const artifact = state.artifacts[event.entityId];
      if (!artifact) return;
      state.artifacts[event.entityId] = {
        ...artifact,
        status: "ready",
        updatedAt: event.occurredAt,
      };
      touch(touched, "artifacts", event.entityId);
      return;
    }

    case "transfer.created": {
      const id = event.entityId;
      state.transfers[id] = {
        id,
        buildId: state.currentBuildId ?? "",
        stageId: state.currentStageId ?? "",
        leg: "construction_office_to_warehouse",
        status: "created",
        sourceBuildingId: "",
        destinationBuildingId: "",
        artifactIds: [],
        vehicleId: WORLD_VEHICLE.id,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      };
      touch(touched, "transfers", id);
      updateVehicle(state, touched, { status: "waiting", currentTransferId: id });
      return;
    }
    case "transfer.blocked":
      upsertTransfer(state, touched, event.entityId, {
        status: "blocked",
        blockerIds: event.payload.blockerIds,
      });
      return;
    case "transfer.ready":
      upsertTransfer(state, touched, event.entityId, { status: "ready" });
      return;
    case "transfer.started": {
      const leg = legForBuildings(
        event.payload.sourceBuildingId,
        event.payload.destinationBuildingId,
      );
      upsertTransfer(state, touched, event.entityId, {
        status: "in_transit",
        leg,
        sourceBuildingId: event.payload.sourceBuildingId,
        destinationBuildingId: event.payload.destinationBuildingId,
        artifactIds: event.payload.artifactIds,
      });
      updateVehicle(state, touched, { status: "in_transit" });
      return;
    }
    case "transfer.arrived":
      upsertTransfer(state, touched, event.entityId, { status: "unloading" });
      updateVehicle(state, touched, { status: "unloading" });
      return;
    case "transfer.completed": {
      upsertTransfer(state, touched, event.entityId, {
        status: "completed",
        receiptArtifactId: event.payload.receiptArtifactId,
      });
      const transfer = state.transfers[event.entityId];
      updateVehicle(state, touched, {
        status: "completed",
        currentTransferId: undefined,
        lastArrivedBuildingId: transfer?.destinationBuildingId,
      });
      return;
    }
    case "transfer.failed":
      upsertTransfer(state, touched, event.entityId, {
        status: "failed",
        failureReason: event.payload.reason,
      });
      updateVehicle(state, touched, { status: "failed", currentTransferId: undefined });
      return;

    case "approval.requested": {
      const id = event.entityId;
      state.approvals[id] = {
        id,
        buildId: state.currentBuildId ?? "",
        stageId: state.currentStageId ?? "",
        status: "pending",
        riskClass: event.payload.riskClass,
        title: event.payload.title,
        reason: event.payload.reason,
        recommendedAction: event.payload.recommendedAction,
        evidenceIds: event.payload.evidenceIds,
        requestedAt: event.occurredAt,
      };
      touch(touched, "approvals", id);
      return;
    }
    case "approval.approved":
      upsertApproval(state, touched, event.entityId, {
        status: "approved",
        resolvedAt: event.occurredAt,
        resolvedBy: event.payload.resolvedBy,
        resolutionNote: event.payload.resolutionNote,
      });
      return;
    case "approval.rejected":
      upsertApproval(state, touched, event.entityId, {
        status: "rejected",
        resolvedAt: event.occurredAt,
        resolvedBy: event.payload.resolvedBy,
        resolutionNote: event.payload.resolutionNote,
      });
      return;
    case "approval.revision_requested": {
      upsertApproval(state, touched, event.entityId, {
        status: "revision_requested",
        resolvedAt: event.occurredAt,
        resolvedBy: event.payload.resolvedBy,
        resolutionNote: event.payload.resolutionNote,
      });

      // event-model.md → `approval.revision_requested`: "Backend: creates
      // a `Revision` record ... linking back to the stage via
      // `sourceApprovalId`; the stage moves to `revision_required` until
      // `revision.completed`; work returns to the Builder."
      //
      // Derived here rather than emitted as a second event, so one
      // command still produces exactly one event. The Revision id is
      // derived deterministically from the approval id, which is what
      // keeps a full replay reconstructing the identical record.
      const approval = state.approvals[event.entityId];
      const stageId = approval?.stageId;
      if (!stageId) return;

      // Invariant: at most one open Revision per stage.
      const alreadyOpen = Object.values(state.revisions).some(
        (revision) =>
          revision.stageId === stageId &&
          (revision.status === "requested" || revision.status === "in_progress"),
      );
      if (alreadyOpen) return;

      const revisionId = `revision-for-${event.entityId}`;
      state.revisions[revisionId] = {
        id: revisionId,
        buildId: approval?.buildId ?? state.currentBuildId ?? "",
        stageId,
        reason:
          event.payload.resolutionNote ?? "Operator requested a revision at the approval gate.",
        requestedBy: "approval",
        status: "requested",
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
        sourceApprovalId: event.entityId,
      };
      touch(touched, "revisions", revisionId);
      updateStage(state, touched, stageId, { status: "revision_required" });
      return;
    }

    case "building.state_changed": {
      const building = state.buildings[event.payload.buildingId];
      if (!building) return;
      state.buildings[event.payload.buildingId] = {
        ...building,
        status: event.payload.newState as Building["status"],
        updatedAt: event.occurredAt,
      };
      touch(touched, "buildings", event.payload.buildingId);
      return;
    }

    case "upgrade.eligible": {
      const id = event.entityId;
      state.upgrades[id] = {
        id,
        buildingId: event.payload.buildingId,
        fromLevel: WAREHOUSE_UPGRADE_FROM_LEVEL,
        toLevel: WAREHOUSE_UPGRADE_TO_LEVEL,
        status: "eligible",
        // No event carries requirement IDs for an upgrade — the closed-set
        // evidence descriptions from `upgrade.eligible` are stored verbatim
        // in this required-but-nullable-content field instead.
        requirementIds: event.payload.requirementEvidence,
        createdAt: event.occurredAt,
      };
      touch(touched, "upgrades", id);
      return;
    }
    case "upgrade.requested": {
      const upgrade = state.upgrades[event.entityId];
      if (!upgrade) return;
      state.upgrades[event.entityId] = { ...upgrade, status: "awaiting_approval" };
      touch(touched, "upgrades", event.entityId);
      return;
    }
    case "upgrade.approved":
      return;
    case "upgrade.started": {
      const upgrade = state.upgrades[event.entityId];
      if (!upgrade) return;
      state.upgrades[event.entityId] = {
        ...upgrade,
        status: "upgrading",
        startedAt: event.occurredAt,
      };
      touch(touched, "upgrades", event.entityId);
      return;
    }
    case "upgrade.completed": {
      const upgrade = state.upgrades[event.entityId];
      if (upgrade) {
        state.upgrades[event.entityId] = {
          ...upgrade,
          status: "completed",
          completedAt: event.occurredAt,
          fromLevel: event.payload.fromLevel,
          toLevel: event.payload.toLevel,
        };
        touch(touched, "upgrades", event.entityId);
      }
      const buildingId = upgrade?.buildingId;
      const building = buildingId ? state.buildings[buildingId] : undefined;
      if (buildingId && building) {
        // A new capacity *replaces* the old one rather than accumulating
        // beside it — a building holding both `capacity:25` and
        // `capacity:100` would have no answer to "what is its capacity?".
        const addsCapacity = event.payload.capabilitiesAdded.some((capability) =>
          capability.startsWith(CAPACITY_CAPABILITY_PREFIX),
        );
        const retained = addsCapacity
          ? building.capabilities.filter(
              (capability) => !capability.startsWith(CAPACITY_CAPABILITY_PREFIX),
            )
          : building.capabilities;

        // Level and capacity are written together, in this one branch, so
        // no observer can ever see one without the other (V-07).
        state.buildings[buildingId] = {
          ...building,
          level: event.payload.toLevel,
          capabilities: [...new Set([...retained, ...event.payload.capabilitiesAdded])],
          updatedAt: event.occurredAt,
        };
        touch(touched, "buildings", buildingId);
      }
      return;
    }
    case "upgrade.failed": {
      const upgrade = state.upgrades[event.entityId];
      if (!upgrade) return;
      state.upgrades[event.entityId] = { ...upgrade, status: "failed" };
      touch(touched, "upgrades", event.entityId);
      return;
    }

    default:
      return;
  }
}

function legForBuildings(source: string, destination: string): Transfer["leg"] {
  if (source === "construction-office" && destination === "warehouse") {
    return "construction_office_to_warehouse";
  }
  if (source === "warehouse" && destination === "qa") {
    return "warehouse_to_qa";
  }
  return "qa_to_deployment_dock";
}
