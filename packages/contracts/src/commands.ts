import { z } from "zod";
import { IdSchema } from "./common";
import { BUILD_STAGE_SEQUENCE, BuildStageNameSchema } from "./entities/buildStage";
import { ObjectiveTextSchema } from "./objective";
import { BuildPlanSchema, PlanReviewDecisionSchema } from "./plan";
import { BudgetUsdSchema } from "./authorization";
import { PersistedRunEvidenceSchema } from "./runEvidence";

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
  // V1.1 amendment (AC-108): plan review is a human governance act and
  // needs a declared command so it goes through CommandHandler like every
  // other authority-bearing decision. Recorded in domain-model.md.
  "Plan.Review",
  // V1.1 amendment (AC-110): the execution authorization gate. Declared
  // so the operator's authorization goes through CommandHandler like
  // every other authority-bearing decision. Recorded in domain-model.md.
  "Plan.Authorize",
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
  // V1.1 amendment (AC-111): durable evidence for one run, recorded
  // before its terminal event so a completion can never cite an evidence
  // id no record exists for. Recorded in domain-model.md.
  "AgentRun.RecordEvidence",
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
// `actor` is optional and is **not** how identity is determined.
//
// Through FBL-025 it was: the field was a caller-asserted claim, and the
// actor-sensitive guards (notably F-05's Inspector-only check) were only
// as trustworthy as whatever the caller typed. FBL-029 replaced that —
// identity is now established by a backend-issued bearer credential
// resolved server-side (`@foundry/persistence` → `PrincipalRegistry`),
// and the transport refuses (403 `actor_mismatch`) any request whose
// `actor` disagrees with the authenticated principal rather than
// silently overriding it. The field therefore remains useful as an
// explicit, checkable assertion of intent, but it can no longer confer
// authority. `actorType` is intentionally a loose
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

/**
 * Per-command parameter schemas (AC-107).
 *
 * The comment above records that envelope-only validation was correct
 * "until there is real enforcement logic to consume those parameters".
 * There is now, so the shapes are declared here — for the objective, plan,
 * and authorization commands **specifically**, not for the whole
 * vocabulary. Every other command keeps envelope-only validation, because
 * `domain-model.md` still does not specify its fields and inventing them
 * would be undocumented policy.
 *
 * **Declared, not yet enforced at the transport.** `CommandRequestSchema`
 * is deliberately unchanged: moving these into it would turn handler-level
 * refusals (HTTP 200 with a stated reason) into transport-level rejections
 * (HTTP 400), which is a behaviour change, and `AC-107` is a contract-only
 * rung whose stop condition is "hard stop before any consumer is written".
 * `parseCommandParams` is the seam `AC-108` wires in.
 *
 * `Build.Plan` is already in the closed vocabulary, so plan production
 * needs no new command type. Execution authorization has no declared
 * command; introducing one is a `domain-model.md` amendment owned by the
 * rung that builds the gate (`AC-110`), not this one.
 */
export const COMMAND_PARAM_SCHEMAS = {
  /** Produces `operator.objective_submitted`. */
  "Project.Create": z
    .object({
      objective: ObjectiveTextSchema,
      projectId: IdSchema,
    })
    .strict(),

  /**
   * Produces `build.created`. `buildId` must equal the command's
   * `entityId` — the projection keys the Build by `params.buildId` while
   * the create/exists check keys it by `entityId`, so a mismatch writes a
   * Build the handler cannot see. That coherence rule lives in
   * `CommandHandler`, which has both values; this shape pins the fields.
   */
  "Build.Create": z
    .object({
      projectId: IdSchema,
      buildId: IdSchema,
      objective: ObjectiveTextSchema,
    })
    .strict(),

  /**
   * Produces `build.planned`, carrying the plan itself (AC-108).
   *
   * `planArtifactId` equals `planId`: V1.1 persists the plan as a
   * first-class record rather than a separate `Artifact` row, and the
   * declared payload field retains the plan's identifier. Recorded in the
   * `event-model.md` AC-108 amendment.
   */
  "Build.Plan": z
    .object({
      planId: IdSchema,
      planArtifactId: IdSchema,
      stageIds: z.array(IdSchema).length(BUILD_STAGE_SEQUENCE.length),
      requirementCount: z.number().int().nonnegative(),
      plan: BuildPlanSchema,
    })
    .strict(),

  /**
   * Produces `operator.plan_reviewed` (AC-108).
   *
   * `reviewedBy` is deliberately absent: it is written from the
   * authenticated principal server-side, never accepted from the payload,
   * exactly as `resolvedBy` is for approvals.
   */
  "Plan.Review": z
    .object({
      planId: IdSchema,
      buildId: IdSchema,
      /** The revision the operator actually read. A later edit is detectable. */
      reviewedRevision: z.string().min(1),
      decision: PlanReviewDecisionSchema,
      note: z.string().max(500).optional(),
    })
    .strict(),

  /**
   * Produces `operator.execution_authorized` (AC-110).
   *
   * Note what a caller may **not** send. `authorizationId`, `authorizedBy`,
   * `planRevision`, `workspace`, and `riskClass` are all absent, and
   * `.strict()` refuses them: each is written server-side from the
   * credential or from persisted plan content, so a payload cannot assert
   * who authorized, under what constraints, or against what.
   *
   * `acknowledgedContentHash` is the one hash-shaped field a caller sends,
   * and it is deliberately **not** the binding. It states which hash the
   * operator was looking at. The backend recomputes the SHA-256 from
   * persisted content, refuses if the two disagree, and writes its **own**
   * value into the authorization — so a client-supplied value is never
   * accepted as the binding (`F-113a`), only ever used to detect that the
   * operator was reading something stale.
   */
  /**
   * Produces `agentrun.evidence_recorded` (AC-111).
   *
   * The evidence itself is validated here, in full, before the event is
   * built — so a malformed record is refused rather than persisted as a
   * plausible-looking one.
   */
  "AgentRun.RecordEvidence": z
    .object({
      evidenceId: IdSchema,
      agentRunId: IdSchema,
      evidence: PersistedRunEvidenceSchema,
    })
    .strict(),

  "Plan.Authorize": z
    .object({
      planId: IdSchema,
      buildId: IdSchema,
      /** Exactly one stage. An authorization is never build-wide. */
      stageName: BuildStageNameSchema,
      /** Required, positive, finite, capped at $25 (AC-107 decision 7). */
      maxBudgetUsd: BudgetUsdSchema,
      /** What the operator read. Compared, never trusted. */
      acknowledgedContentHash: z.string().min(1),
      note: z.string().max(500).optional(),
    })
    .strict(),
} as const satisfies Partial<Record<CommandType, z.ZodType>>;

export type ParameterisedCommandType = keyof typeof COMMAND_PARAM_SCHEMAS;

/** True when this rung declares a parameter shape for the command. */
export function hasCommandParamSchema(
  commandType: CommandType,
): commandType is ParameterisedCommandType {
  return commandType in COMMAND_PARAM_SCHEMAS;
}

/**
 * Validates a command's parameters when a shape is declared for it.
 *
 * Returns `{ ok: true }` for commands with no declared shape, rather than
 * refusing them: the vocabulary is closed but most of it is still
 * envelope-only by design, and treating "no schema" as "invalid" would
 * reject the majority of legitimate commands.
 */
export function parseCommandParams(
  commandType: CommandType,
  params: unknown,
): { ok: true; params: unknown } | { ok: false; issues: { field: string; message: string }[] } {
  if (!hasCommandParamSchema(commandType)) return { ok: true, params };
  const parsed = COMMAND_PARAM_SCHEMAS[commandType].safeParse(params);
  if (parsed.success) return { ok: true, params: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}
