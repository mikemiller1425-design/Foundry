import { z } from "zod";
import { IdSchema } from "./common";

// docs/02-specification/domain-model.md → each entity's "Commands" row.
// This is the closed, authoritative V1 command vocabulary a backend API
// may accept for evaluation (FBL-024) and later enforce (FBL-025). Every
// entry is transcribed verbatim from that document's per-entity Commands
// list — nothing here is invented.
//
// Two documented commands are intentionally excluded: `Event.Append` is
// marked "(system)" in domain-model.md — never operator- or API-submitted
// — and `WorldState`'s `ReconcileFromSnapshot`/`ApplyEvent` are read/sync
// operations already served by the query/snapshot surface, not mutating
// commands routed through this catalog.
export const COMMAND_TYPES = [
  "Agent.Assign",
  "Agent.Depart",
  "Agent.Arrive",
  "Agent.StartWork",
  "Agent.Pause",
  "Agent.Resume",
  "Agent.Fail",
  "Agent.CompleteWork",
  "Agent.ReturnHome",
  "Building.ChangeState",
  "Building.Select",
  "Building.StartUpgrade",
  "Project.Create",
  "Project.Activate",
  "Project.Archive",
  "Project.Cancel",
  "Build.Create",
  "Build.Plan",
  "Build.Start",
  "Build.Pause",
  "Build.Resume",
  "Build.Cancel",
  "Build.Fail",
  "Build.Complete",
  "BuildStage.Create",
  "BuildStage.Start",
  "BuildStage.Block",
  "BuildStage.Validate",
  "BuildStage.Complete",
  "BuildStage.Fail",
  "BuildStage.Cancel",
  "BuildStage.RequestRevision",
  "Revision.Request",
  "Revision.Start",
  "Revision.Complete",
  "Revision.Cancel",
  "Requirement.Start",
  "Requirement.Pass",
  "Requirement.Fail",
  "Requirement.Retry",
  "Task.Queue",
  "Task.Assign",
  "Task.Start",
  "Task.Pause",
  "Task.Resume",
  "Task.Complete",
  "Task.Fail",
  "Task.Cancel",
  "AgentRun.Start",
  "AgentRun.Complete",
  "AgentRun.Fail",
  "AgentRun.Timeout",
  "Artifact.Create",
  "Artifact.Validate",
  "Artifact.Reject",
  "Artifact.MarkReady",
  "Artifact.Archive",
  "Transfer.Create",
  "Transfer.MarkReady",
  "Transfer.Start",
  "Transfer.Arrive",
  "Transfer.Complete",
  "Transfer.Fail",
  "Transfer.Cancel",
  "Vehicle.Assign",
  "Vehicle.StartLoading",
  "Vehicle.Depart",
  "Vehicle.Arrive",
  "Vehicle.Unload",
  "Vehicle.Complete",
  "Vehicle.Fail",
  "Approval.Request",
  "Approval.Approve",
  "Approval.Reject",
  "Approval.RequestRevision",
  "Approval.Cancel",
  "Upgrade.EvaluateEligibility",
  "Upgrade.Request",
  "Upgrade.Approve",
  "Upgrade.Start",
  "Upgrade.Complete",
  "Upgrade.Fail",
] as const;

export const CommandTypeSchema = z.enum(COMMAND_TYPES);
export type CommandType = z.infer<typeof CommandTypeSchema>;

// Envelope shape only. domain-model.md names each command but does not
// specify per-command parameter fields, so this rung validates the
// envelope (a known commandType, an optional target entityId, a params
// object) and nothing more specific — inventing per-command field schemas
// not written anywhere would be undocumented policy, not contract-first
// implementation. Per-command parameter validation is FBL-025's job, once
// there is real enforcement logic to consume those parameters.
// `actor` is optional and, in the absence of a V1 authentication system
// (out of scope per v1-scope.md exclusions), is a caller-asserted claim,
// not a cryptographically verified identity — every mutation still
// "records actor" (domain-model.md global conventions) once appended, but
// FBL-025's actor-sensitive guards (e.g. F-05's Inspector-only check) are
// only as trustworthy as this claim. `actorType` is intentionally a loose
// string here (not the closed `ActorType` enum, to avoid a circular
// dependency on `@foundry/event-types`, which already depends on this
// package) — an invalid value is still caught downstream when the
// resulting event is validated against the real envelope schema.
export const CommandActorSchema = z.object({
  actorType: z.string().min(1),
  actorId: IdSchema,
});
export type CommandActor = z.infer<typeof CommandActorSchema>;

export const CommandRequestSchema = z.object({
  commandType: CommandTypeSchema,
  entityId: IdSchema.optional(),
  params: z.record(z.string(), z.unknown()).default({}),
  actor: CommandActorSchema.optional(),
});
export type CommandRequest = z.infer<typeof CommandRequestSchema>;
