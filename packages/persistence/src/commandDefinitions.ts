import type { CommandType } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import type { EntityType } from "./reducer";

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  projects: "Project",
  plans: "Plan",
  builds: "Build",
  buildStages: "BuildStage",
  requirements: "Requirement",
  tasks: "Task",
  agentRuns: "AgentRun",
  artifacts: "Artifact",
  transfers: "Transfer",
  approvals: "Approval",
  revisions: "Revision",
  upgrades: "Upgrade",
  agents: "Agent",
  buildings: "Building",
  vehicles: "Vehicle",
  stageValidations: "StageValidation",
};

export interface CommandDefinition {
  entityType: EntityType;
  /** The FoundryEvent type this command produces on success, or `null` if no V1 event backs it (always denied). */
  eventType: FoundryEvent["type"] | null;
  /** True when the target entity is not expected to already exist (a creation command). */
  isCreate?: boolean;
  /** Fixed reason shown when `eventType` is null. */
  denyReason?: string;
  /**
   * The status this command moves the entity to, checked against
   * `transitionGraphs.ts`. Omitted only for commands with no status field
   * on their target entity (e.g. `Building.Select`). A value equal to the
   * entity's current status is legal only when the entity is *already* at
   * that status (see `isLegalTransition`'s same-status rule) — used for
   * commands whose backing event doesn't itself change status.
   */
  toStatus?: string;
}

const NO_EVENT = (reason: string): { eventType: null; denyReason: string } => ({
  eventType: null,
  denyReason: reason,
});

const VEHICLE_DENY = NO_EVENT(
  "Vehicle state derives only from Transfer events (domain-model.md → Vehicle invariants); submit the corresponding Transfer command instead.",
);
const TASK_DENY = NO_EVENT(
  "No V1 event backs this Task command directly — Task state derives from the corresponding Agent/AgentRun commands (domain-model.md → Task, event-model.md).",
);

export const COMMAND_DEFINITIONS: Record<CommandType, CommandDefinition> = {
  "Agent.Assign": { entityType: "agents", eventType: "agent.assigned", toStatus: "assigned" },
  "Agent.Depart": { entityType: "agents", eventType: "agent.departed", toStatus: "traveling" },
  "Agent.Arrive": { entityType: "agents", eventType: "agent.arrived", toStatus: "traveling" },
  "Agent.StartWork": { entityType: "agents", eventType: "agent.started_work", toStatus: "working" },
  "Agent.Pause": { entityType: "agents", eventType: "agent.paused", toStatus: "paused" },
  "Agent.Resume": { entityType: "agents", eventType: "agent.resumed", toStatus: "working" },
  "Agent.Fail": { entityType: "agents", eventType: "agent.failed", toStatus: "failed" },
  "Agent.CompleteWork": {
    entityType: "agents",
    eventType: "agent.completed_work",
    toStatus: "waiting",
  },
  "Agent.ReturnHome": { entityType: "agents", eventType: "agent.returned_home", toStatus: "idle" },

  "Building.ChangeState": {
    entityType: "buildings",
    ...NO_EVENT(
      'Building.ChangeState is system-only (domain-model.md → Building Commands: "(system)") and is never operator-submittable.',
    ),
  },
  "Building.Select": { entityType: "buildings", eventType: "building.selected" },
  // Handled as a named alias in commandHandler.ts (routes to the target
  // building's eligible Upgrade record and emits upgrade.requested)
  // rather than a direct event here — Building and Upgrade are different
  // entity types, so this table's single entityType/eventType shape
  // doesn't fit. This entry is the fallback if that special case is ever
  // bypassed.
  "Building.StartUpgrade": {
    entityType: "buildings",
    ...NO_EVENT(
      "Building.StartUpgrade routes to the target building's Upgrade record; no eligible Upgrade was found.",
    ),
  },

  "Project.Create": {
    entityType: "projects",
    eventType: "operator.objective_submitted",
    isCreate: true,
  },
  "Project.Activate": {
    entityType: "projects",
    ...NO_EVENT(
      "No V1 event backs Project.Activate — a submitted objective (operator.objective_submitted) is created active in V1 (domain-model.md → Project V1 limits: one active project).",
    ),
  },
  "Project.Archive": {
    entityType: "projects",
    ...NO_EVENT(
      "No V1 event backs Project.Archive — no operator.* or project.* event for archival exists in event-model.md.",
    ),
  },
  "Project.Cancel": {
    entityType: "projects",
    ...NO_EVENT(
      "No V1 event backs Project.Cancel — no operator.* or project.* event for cancellation exists in event-model.md.",
    ),
  },

  "Build.Create": { entityType: "builds", eventType: "build.created", isCreate: true },
  "Build.Plan": { entityType: "builds", eventType: "build.planned", toStatus: "planned" },
  // AC-108: plan review is a human governance act, routed through the same
  // handler as every other authority-bearing decision.
  "Plan.Review": { entityType: "plans", eventType: "operator.plan_reviewed" },
  "Build.Start": { entityType: "builds", eventType: "build.started", toStatus: "running" },
  "Build.Pause": { entityType: "builds", eventType: "build.paused", toStatus: "paused" },
  "Build.Resume": { entityType: "builds", eventType: "build.resumed", toStatus: "running" },
  "Build.Cancel": { entityType: "builds", eventType: "build.cancelled", toStatus: "cancelled" },
  "Build.Fail": { entityType: "builds", eventType: "build.failed", toStatus: "failed" },
  "Build.Complete": { entityType: "builds", eventType: "build.completed", toStatus: "completed" },

  "BuildStage.Create": { entityType: "buildStages", eventType: "stage.created", isCreate: true },
  "BuildStage.Start": {
    entityType: "buildStages",
    eventType: "stage.started",
    toStatus: "running",
  },
  "BuildStage.Block": {
    entityType: "buildStages",
    eventType: "stage.blocked",
    toStatus: "blocked",
  },
  // "Validate" is dispatched to stage.validation_passed or
  // stage.validation_failed by commandHandler.ts based on params.outcome;
  // toStatus is resolved there too (completed vs. unchanged/failed).
  "BuildStage.Validate": { entityType: "buildStages", eventType: "stage.validation_passed" },
  "BuildStage.Complete": {
    entityType: "buildStages",
    eventType: "stage.completed",
    toStatus: "completed",
  },
  "BuildStage.Fail": { entityType: "buildStages", eventType: "stage.failed", toStatus: "failed" },
  "BuildStage.Cancel": {
    entityType: "buildStages",
    ...NO_EVENT(
      'No V1 event backs BuildStage.Cancel — "cancelled" is not in STAGE_EVENTS (event-model.md).',
    ),
  },
  "BuildStage.RequestRevision": {
    entityType: "revisions",
    eventType: "revision.requested",
    isCreate: true,
  },

  "Revision.Request": { entityType: "revisions", eventType: "revision.requested", isCreate: true },
  "Revision.Start": {
    entityType: "revisions",
    eventType: "revision.started",
    toStatus: "in_progress",
  },
  "Revision.Complete": {
    entityType: "revisions",
    eventType: "revision.completed",
    toStatus: "completed",
  },
  "Revision.Cancel": {
    entityType: "revisions",
    ...NO_EVENT(
      "No V1 event backs Revision.Cancel — only requested/started/completed events exist (event-model.md).",
    ),
  },

  "Requirement.Start": {
    entityType: "requirements",
    eventType: "requirement.started",
    toStatus: "running",
  },
  "Requirement.Pass": {
    entityType: "requirements",
    eventType: "requirement.passed",
    toStatus: "passed",
  },
  "Requirement.Fail": {
    entityType: "requirements",
    eventType: "requirement.failed",
    toStatus: "failed",
  },
  "Requirement.Retry": {
    entityType: "requirements",
    eventType: "requirement.retried",
    toStatus: "pending",
  },

  "Task.Queue": { entityType: "tasks", ...TASK_DENY },
  "Task.Assign": { entityType: "tasks", ...TASK_DENY },
  "Task.Start": { entityType: "tasks", ...TASK_DENY },
  "Task.Pause": { entityType: "tasks", ...TASK_DENY },
  "Task.Resume": { entityType: "tasks", ...TASK_DENY },
  "Task.Complete": { entityType: "tasks", ...TASK_DENY },
  "Task.Fail": { entityType: "tasks", ...TASK_DENY },
  "Task.Cancel": { entityType: "tasks", ...TASK_DENY },

  "AgentRun.Start": { entityType: "agentRuns", eventType: "agentrun.started", isCreate: true },
  "AgentRun.Complete": {
    entityType: "agentRuns",
    eventType: "agentrun.completed",
    toStatus: "completed",
  },
  "AgentRun.Fail": { entityType: "agentRuns", eventType: "agentrun.failed", toStatus: "failed" },
  "AgentRun.Timeout": {
    entityType: "agentRuns",
    eventType: "agentrun.timed_out",
    toStatus: "timed_out",
  },

  "Artifact.Create": { entityType: "artifacts", eventType: "artifact.created", isCreate: true },
  "Artifact.Validate": {
    entityType: "artifacts",
    eventType: "artifact.validated",
    toStatus: "validated",
  },
  "Artifact.Reject": {
    entityType: "artifacts",
    ...NO_EVENT(
      "No V1 event backs Artifact.Reject — only created/validated/ready events exist (event-model.md).",
    ),
  },
  "Artifact.MarkReady": { entityType: "artifacts", eventType: "artifact.ready", toStatus: "ready" },
  "Artifact.Archive": {
    entityType: "artifacts",
    ...NO_EVENT(
      "No V1 event backs Artifact.Archive — only created/validated/ready events exist (event-model.md).",
    ),
  },

  "Transfer.Create": { entityType: "transfers", eventType: "transfer.created", isCreate: true },
  "Transfer.MarkReady": { entityType: "transfers", eventType: "transfer.ready", toStatus: "ready" },
  "Transfer.Start": {
    entityType: "transfers",
    eventType: "transfer.started",
    toStatus: "in_transit",
  },
  "Transfer.Arrive": {
    entityType: "transfers",
    eventType: "transfer.arrived",
    toStatus: "unloading",
  },
  "Transfer.Complete": {
    entityType: "transfers",
    eventType: "transfer.completed",
    toStatus: "completed",
  },
  "Transfer.Fail": { entityType: "transfers", eventType: "transfer.failed", toStatus: "failed" },
  "Transfer.Cancel": {
    entityType: "transfers",
    ...NO_EVENT(
      'No V1 event backs Transfer.Cancel — "cancelled" is not in TRANSFER_EVENTS (event-model.md).',
    ),
  },

  "Vehicle.Assign": { entityType: "vehicles", ...VEHICLE_DENY },
  "Vehicle.StartLoading": { entityType: "vehicles", ...VEHICLE_DENY },
  "Vehicle.Depart": { entityType: "vehicles", ...VEHICLE_DENY },
  "Vehicle.Arrive": { entityType: "vehicles", ...VEHICLE_DENY },
  "Vehicle.Unload": { entityType: "vehicles", ...VEHICLE_DENY },
  "Vehicle.Complete": { entityType: "vehicles", ...VEHICLE_DENY },
  "Vehicle.Fail": { entityType: "vehicles", ...VEHICLE_DENY },

  "Approval.Request": { entityType: "approvals", eventType: "approval.requested", isCreate: true },
  "Approval.Approve": {
    entityType: "approvals",
    eventType: "approval.approved",
    toStatus: "approved",
  },
  "Approval.Reject": {
    entityType: "approvals",
    eventType: "approval.rejected",
    toStatus: "rejected",
  },
  "Approval.RequestRevision": {
    entityType: "approvals",
    eventType: "approval.revision_requested",
    toStatus: "revision_requested",
  },
  "Approval.Cancel": {
    entityType: "approvals",
    ...NO_EVENT(
      "No V1 event backs Approval.Cancel — only requested/approved/rejected/revision_requested events exist (event-model.md).",
    ),
  },

  "Upgrade.EvaluateEligibility": {
    entityType: "upgrades",
    eventType: "upgrade.eligible",
    isCreate: true,
  },
  "Upgrade.Request": {
    entityType: "upgrades",
    eventType: "upgrade.requested",
    toStatus: "awaiting_approval",
  },
  "Upgrade.Approve": {
    entityType: "upgrades",
    eventType: "upgrade.approved",
    toStatus: "awaiting_approval",
  },
  "Upgrade.Start": { entityType: "upgrades", eventType: "upgrade.started", toStatus: "upgrading" },
  "Upgrade.Complete": {
    entityType: "upgrades",
    eventType: "upgrade.completed",
    toStatus: "completed",
  },
  "Upgrade.Fail": { entityType: "upgrades", eventType: "upgrade.failed", toStatus: "failed" },
};
