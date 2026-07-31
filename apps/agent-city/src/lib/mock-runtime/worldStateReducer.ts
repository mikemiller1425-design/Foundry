import type { Agent, AgentStatus, Approval, Build, Transfer, WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { WORLD_AGENTS, WORLD_BUILDINGS, WORLD_VEHICLE } from "@foundry/world-model";

// docs/02-specification/domain-model.md → Upgrade → "Counting rule
// (resolves audit finding M-06)": Warehouse begins with a seeded history of
// 9 previously successful packages; the current build counts exactly once,
// at deployment_package.completed / build.completed.
const SEEDED_SUCCESSFUL_PACKAGES = 9;

const NOW = "2026-07-30T00:00:00.000Z";

export function createInitialWorldState(): WorldState {
  return {
    buildings: WORLD_BUILDINGS.map((b) => ({
      id: b.id,
      name: b.name,
      buildingType: b.buildingType,
      level: 1,
      status: "idle",
      position: b.position,
      capabilities: [],
      createdAt: NOW,
      updatedAt: NOW,
    })),
    agents: WORLD_AGENTS.map((a) => ({
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
    })),
    currentBuild: null,
    activeTransfers: [],
    approvals: [],
    inventoryCounts: { successfulPackages: SEEDED_SUCCESSFUL_PACKAGES },
    health: { status: "healthy", reasons: ["nominal"] },
    lastProcessedEventId: null,
  };
}

const ACTIVE_TRANSFER_STATUSES = new Set([
  "created",
  "blocked",
  "ready",
  "loading",
  "in_transit",
  "unloading",
]);

function updateAgent(state: WorldState, agentId: string, patch: Partial<Agent>): WorldState {
  return {
    ...state,
    agents: state.agents.map((a) => (a.id === agentId ? { ...a, ...patch, updatedAt: NOW } : a)),
  };
}

function updateBuild(state: WorldState, patch: Partial<Build>): WorldState {
  if (!state.currentBuild) return state;
  return { ...state, currentBuild: { ...state.currentBuild, ...patch, updatedAt: NOW } };
}

function upsertTransfer(
  state: WorldState,
  transferId: string,
  patch: Partial<Transfer>,
): WorldState {
  const existingIndex = state.activeTransfers.findIndex((t) => t.id === transferId);
  if (existingIndex === -1) {
    return state;
  }
  const updated = { ...state.activeTransfers[existingIndex], ...patch, updatedAt: NOW } as Transfer;
  const activeTransfers = state.activeTransfers
    .map((t, i) => (i === existingIndex ? updated : t))
    .filter((t) => ACTIVE_TRANSFER_STATUSES.has(t.status));
  return { ...state, activeTransfers };
}

function upsertApproval(
  state: WorldState,
  approvalId: string,
  patch: Partial<Approval>,
): WorldState {
  const existingIndex = state.approvals.findIndex((a) => a.id === approvalId);
  if (existingIndex === -1) return state;
  return {
    ...state,
    approvals: state.approvals.map((a) => (a.id === approvalId ? { ...a, ...patch } : a)),
  };
}

/**
 * Applies one event to a WorldState. This is intentionally a partial
 * projection — enough to make blocked progression, approval gating, the
 * upgrade sequence, and idempotency testable at FBL-008. Full event→world
 * coverage (every visual/state mutation) is FBL-021's "Event-to-world
 * mapping" rung, not this one.
 */
export function applyEvent(state: WorldState, event: FoundryEvent): WorldState {
  switch (event.type) {
    case "build.created": {
      const payload = event.payload;
      const build: Build = {
        id: payload.buildId,
        projectId: payload.projectId,
        sequenceNumber: 1,
        status: "planned",
        objectiveSnapshot: payload.objective,
        currentStageId: "",
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      };
      return { ...state, currentBuild: build, lastProcessedEventId: event.id };
    }
    case "build.ready":
      return updateBuild(state, { status: "ready" });
    case "build.started":
      return updateBuild(state, { status: "running", startedAt: event.occurredAt });
    case "build.paused":
      return updateBuild(state, { status: "paused" });
    case "build.resumed":
      return updateBuild(state, { status: "running" });
    case "build.completed":
      return {
        ...updateBuild(state, { status: "completed", completedAt: event.payload.completedAt }),
        inventoryCounts: {
          ...state.inventoryCounts,
          successfulPackages: (state.inventoryCounts.successfulPackages ?? 0) + 1,
        },
      };
    case "build.failed":
      return updateBuild(state, { status: "failed", failureReason: event.payload.failureCode });
    case "build.cancelled":
      return updateBuild(state, { status: "cancelled" });

    case "stage.started":
      // Forward progress on a stage means any earlier block has been
      // resolved (retry/revision) — nothing in the event vocabulary emits
      // a dedicated "unblocked" event (this exact gap is documented as
      // audit finding MI-01), so recovery is inferred the same way the
      // block itself was: from the next stage-level transition.
      return updateBuild(state, {
        currentStageId: event.entityId,
        status: state.currentBuild?.status === "blocked" ? "running" : state.currentBuild?.status,
      });
    case "stage.completed":
      return state.currentBuild?.status === "blocked"
        ? updateBuild(state, { status: "running" })
        : state;
    case "stage.blocked":
      return updateBuild(state, { status: "blocked" });

    case "agent.assigned":
      return updateAgent(state, event.entityId, {
        status: "assigned",
        currentTaskId: event.payload.taskId,
      });
    case "agent.departed":
      return updateAgent(state, event.entityId, { status: "traveling" });
    case "agent.arrived":
      return updateAgent(state, event.entityId, {
        currentBuildingId: event.payload.destinationBuildingId,
      });
    case "agent.started_work":
      return updateAgent(state, event.entityId, { status: "working" });
    case "agent.paused":
      return updateAgent(state, event.entityId, { status: "paused" });
    case "agent.resumed":
      return updateAgent(state, event.entityId, { status: "working" });
    case "agent.failed":
      return updateAgent(state, event.entityId, { status: "failed" });
    case "agent.completed_work":
      return updateAgent(state, event.entityId, { status: "waiting", currentTaskId: undefined });
    case "agent.returned_home":
      return updateAgent(state, event.entityId, {
        status: "idle" as AgentStatus,
        currentBuildingId: event.payload.homeBuildingId,
        currentTaskId: undefined,
      });

    case "transfer.created": {
      const transfer: Transfer = {
        id: event.entityId,
        buildId: state.currentBuild?.id ?? "",
        stageId: state.currentBuild?.currentStageId ?? "",
        leg: "construction_office_to_warehouse",
        status: "created",
        sourceBuildingId: "",
        destinationBuildingId: "",
        artifactIds: [],
        vehicleId: WORLD_VEHICLE.id,
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      };
      return { ...state, activeTransfers: [...state.activeTransfers, transfer] };
    }
    case "transfer.blocked":
      return upsertTransfer(state, event.entityId, {
        status: "blocked",
        blockerIds: event.payload.blockerIds,
      });
    case "transfer.ready":
      return upsertTransfer(state, event.entityId, { status: "ready" });
    case "transfer.started":
      return upsertTransfer(state, event.entityId, {
        status: "in_transit",
        sourceBuildingId: event.payload.sourceBuildingId,
        destinationBuildingId: event.payload.destinationBuildingId,
        artifactIds: event.payload.artifactIds,
      });
    case "transfer.arrived":
      // FBL-021: previously unhandled — "unloading" (domain-model.md
      // Vehicle lifecycle: in_transit → unloading → completed) was
      // unreachable without this case. Operational/visual arrival only;
      // not complete until `transfer.completed` (event-model.md).
      return upsertTransfer(state, event.entityId, { status: "unloading" });
    case "transfer.completed":
      return upsertTransfer(state, event.entityId, {
        status: "completed",
        receiptArtifactId: event.payload.receiptArtifactId,
      });
    case "transfer.failed":
      return upsertTransfer(state, event.entityId, {
        status: "failed",
        failureReason: event.payload.reason,
      });

    case "approval.requested": {
      const approval: Approval = {
        id: event.entityId,
        buildId: state.currentBuild?.id ?? "",
        stageId: state.currentBuild?.currentStageId ?? "",
        status: "pending",
        riskClass: event.payload.riskClass,
        title: event.payload.title,
        reason: event.payload.reason,
        recommendedAction: event.payload.recommendedAction,
        evidenceIds: event.payload.evidenceIds,
        requestedAt: event.occurredAt,
      };
      return { ...state, approvals: [...state.approvals, approval] };
    }
    case "approval.approved":
      return upsertApproval(state, event.entityId, {
        status: "approved",
        resolvedAt: event.occurredAt,
        resolvedBy: event.payload.resolvedBy,
        resolutionNote: event.payload.resolutionNote,
      });
    case "approval.rejected":
      return upsertApproval(state, event.entityId, {
        status: "rejected",
        resolvedAt: event.occurredAt,
        resolvedBy: event.payload.resolvedBy,
      });
    case "approval.revision_requested":
      return upsertApproval(state, event.entityId, {
        status: "revision_requested",
        resolvedAt: event.occurredAt,
        resolvedBy: event.payload.resolvedBy,
      });

    case "upgrade.completed": {
      // FBL-022: `capabilitiesAdded` (domain-model.md Upgrade V1 limits:
      // "capacity 25→100") was carried on the event payload but never
      // actually applied to the Building record — level changed, but the
      // capacity change had no real, inspectable state behind it. Level
      // and capabilities now change together, atomically, in this one
      // reducer case, so "Level 2" and "capacity_100" can never appear
      // independently of one another.
      const buildings = state.buildings.map((b) =>
        b.buildingType === "warehouse"
          ? {
              ...b,
              level: event.payload.toLevel,
              capabilities: [...new Set([...b.capabilities, ...event.payload.capabilitiesAdded])],
              updatedAt: NOW,
            }
          : b,
      );
      return { ...state, buildings };
    }

    case "system.health_changed":
      return {
        ...state,
        health: { status: event.payload.newHealth, reasons: event.payload.reasons },
      };

    default:
      return state;
  }
}

/**
 * Folds an ordered event list into a WorldState, deduping by event id so a
 * duplicated event can never be applied twice (FBL-008 "duplicate event
 * delivery cannot duplicate derived state").
 */
export function reduceWorldState(
  events: readonly FoundryEvent[],
  initial: WorldState = createInitialWorldState(),
): WorldState {
  const seen = new Set<string>();
  let state = initial;
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    state = applyEvent(state, event);
    state = { ...state, lastProcessedEventId: event.id };
  }
  return state;
}
