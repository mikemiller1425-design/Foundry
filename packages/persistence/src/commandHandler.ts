import { randomUUID } from "node:crypto";
import type { CommandRequest, CommandType } from "@foundry/contracts";
import { FoundryEventSchema, type ActorType, type FoundryEvent } from "@foundry/event-types";
import {
  BUILD_STAGE_SEQUENCE,
  CLAUDE_CODE_STAGE,
  ObjectiveTextSchema,
  matchSupportedObjective,
  WAREHOUSE_LEVEL_2_MIN_PASS_RATE,
  WAREHOUSE_LEVEL_2_REQUIRED_PACKAGE_COUNT,
  parseCommandParams,
  planRevision,
  type BuildPlan,
  type PersistedPlan,
} from "@foundry/contracts";
import { WORLD_AGENTS } from "@foundry/world-model";
import {
  COMMAND_DEFINITIONS,
  ENTITY_TYPE_LABELS,
  type CommandDefinition,
} from "./commandDefinitions";
import type { PersistenceService } from "./persistenceService";
import type { EntityType, StageValidationHistory } from "./reducer";
import { planContentHash, plansContentHashEquals } from "./planContentHash";
import { isLegalTransition } from "./transitionGraphs";

export interface CommandActor {
  actorType: ActorType;
  actorId: string;
  /**
   * True only when this identity was established by a backend-issued
   * credential (FBL-029, `principals.ts`) rather than asserted in a
   * request payload.
   *
   * Required rather than optional: an authorization guard that forgets
   * to check it silently reverts to trusting the caller, and a default
   * would make that omission invisible at every call site.
   */
  authenticated: boolean;
}

export interface CommandOutcome {
  accepted: boolean;
  commandType: CommandType;
  entityId?: string;
  reason?: string;
  correctiveAction?: string;
  event?: FoundryEvent;
}

const INSPECTOR_AGENT_ID = WORLD_AGENTS.find((a) => a.role === "inspector")?.id;

/** The commands that resolve a human decision gate (FBL-030). */
const APPROVAL_RESOLUTION_COMMANDS = new Set<CommandType>([
  "Approval.Approve",
  "Approval.Reject",
  "Approval.RequestRevision",
]);

/** The Approval status each resolution command produces. */
const APPROVAL_RESOLUTION_STATUS: Record<string, string> = {
  "Approval.Approve": "approved",
  "Approval.Reject": "rejected",
  "Approval.RequestRevision": "revision_requested",
};

/**
 * Upgrade commands the specification attributes to the operator
 * (`event-model.md`: `upgrade.requested` — "Operator requested upgrade";
 * `upgrade.approved` — "Operator approved") (FBL-031).
 *
 * `Upgrade.Start` and `Upgrade.Complete` are deliberately absent: those
 * are the *execution* of a decision the operator already made, and they
 * are gated by `requireApprovedUpgradeApproval` instead. Requiring an
 * operator to drive execution as well would make the approval mean less,
 * not more — the human decides, the system carries it out.
 */
const OPERATOR_UPGRADE_COMMANDS = new Set<CommandType>(["Upgrade.Request", "Upgrade.Approve"]);

/**
 * AC-108 — reviewing a plan is a human governance act (principle 14).
 *
 * Same standard as resolving an approval: an authenticated operator, never
 * an agent and never an anonymous caller. An agent that could sign off its
 * own plan would make the review ceremonial.
 */
const OPERATOR_PLAN_COMMANDS = new Set<CommandType>(["Plan.Review", "Plan.Authorize"]);

/**
 * AC-110 — the id of a plan's single authorization.
 *
 * Derived from the plan rather than supplied or generated, for three
 * reasons that all point the same way: a replay reconstructs the identical
 * id, a resubmission collides with the existing record instead of minting
 * a second one, and no caller gets to choose the identifier of the thing
 * that grants it permission.
 */
export function executionAuthorizationId(planId: string): string {
  return `${planId}--authorization`;
}

/**
 * AC-109 — starting a build is an act of human direction.
 *
 * Same standard as submitting an objective and reviewing a plan
 * (principle 14). The orchestrator advances a build once it is running,
 * but it may not decide that one should start: a system that could
 * commission its own execution would make the review it just passed
 * decorative.
 *
 * `Build.Start` is the *only* build command with this requirement.
 * Pause, resume, cancel, fail, and complete are unchanged.
 */
const OPERATOR_BUILD_COMMANDS = new Set<CommandType>(["Build.Start"]);

/**
 * Project statuses that still count as open work (`ProjectStatusSchema`).
 * `domain-model.md` → Project V1 limits: **one active project**.
 */
const OPEN_PROJECT_STATUSES = new Set(["draft", "active"]);

/**
 * Build statuses that still count as open work (`BuildStatusSchema` minus
 * its terminal members). `domain-model.md` → Build V1 limits: **one active
 * build**.
 */
const TERMINAL_BUILD_STATUSES = new Set(["completed", "failed", "cancelled"]);

/**
 * FBL-025: backend-authoritative transition validation. Sits in front of
 * `PersistenceService` — every accepted command is translated into the
 * one `FoundryEvent` it produces and applied through the exact same
 * `appendEvent` path `PersistenceService`/`reducer.ts` already provide
 * (FBL-023), so accepting a command can never diverge from what directly
 * appending its event would do. A rejected command never calls
 * `appendEvent` at all — zero mutation, by construction, not by convention.
 */
export class CommandHandler {
  constructor(private readonly persistence: PersistenceService) {}

  submit(request: CommandRequest, actor: CommandActor): CommandOutcome {
    const { commandType, entityId, params } = request;

    if (commandType === "Building.StartUpgrade") {
      return this.handleStartUpgrade(entityId, actor);
    }

    const def = COMMAND_DEFINITIONS[commandType];

    if (!def.eventType) {
      return this.deny(
        commandType,
        entityId,
        def.denyReason ?? "No enforcement path exists for this command.",
      );
    }

    if (!entityId) {
      return this.deny(commandType, entityId, "entityId is required for this command.");
    }

    // Authorization runs *before* the entity is looked up. Otherwise the
    // "no such BuildStage" reply becomes an existence oracle: an
    // unauthenticated caller could enumerate stage ids by watching which
    // error it gets back, without ever being allowed to act on one.
    //
    // Both outcomes are the Inspector's to decide, not just `passed`.
    // The spec's invariant names only `validation_passed`, but a Builder
    // able to declare its own work *failed* would still control the
    // retry/revision path — the spec sets a floor here, not a ceiling.
    if (commandType === "BuildStage.Validate") {
      const authorization = this.requireIndependentInspector(commandType, entityId, actor, params);
      if (authorization) return authorization;
    }

    // FBL-030: resolving an approval is the human governance act
    // (principle 14). Same ordering rationale as validation above — the
    // authorization answer must not depend on whether the approval
    // exists, or the refusal becomes an enumeration oracle.
    if (APPROVAL_RESOLUTION_COMMANDS.has(commandType)) {
      const authorization = this.requireAuthorizedOperator(commandType, entityId, actor);
      if (authorization) return authorization;
    }

    // FBL-031: requesting and approving an upgrade are operator acts
    // (principle 20 — upgrades require evidence *and* a human decision).
    if (OPERATOR_UPGRADE_COMMANDS.has(commandType)) {
      const authorization = this.requireAuthorizedOperator(commandType, entityId, actor);
      if (authorization) return authorization;
    }

    if (OPERATOR_PLAN_COMMANDS.has(commandType)) {
      const authorization = this.requireAuthorizedOperator(commandType, entityId, actor);
      if (authorization) return authorization;
    }

    // AC-109: an orchestrated run begins on the operator's direction.
    if (OPERATOR_BUILD_COMMANDS.has(commandType)) {
      const authorization = this.requireAuthorizedOperator(commandType, entityId, actor);
      if (authorization) return authorization;
    }

    /**
     * AC-108 — per-command parameter validation, for the commands AC-107
     * declared shapes for. Runs *after* authorization so the field-level
     * detail cannot be used as a free schema oracle by a caller with no
     * standing, and *before* every state guard so a malformed request is
     * refused on its shape rather than on a state it was never going to
     * reach. Commands with no declared shape pass through unchanged.
     */
    const parsedParams = parseCommandParams(commandType, params);
    if (!parsedParams.ok) {
      return this.deny(
        commandType,
        entityId,
        `params do not match the declared shape for ${commandType}: ${parsedParams.issues
          .map((issue) => `${issue.field || "(root)"} — ${issue.message}`)
          .join("; ")}`,
        "Correct the named fields and resubmit.",
      );
    }

    const existing = this.persistence.getEntity<Record<string, unknown>>(def.entityType, entityId);

    // FBL-031: a repeated completion must not re-apply the capability
    // change. The transition graph already refuses completed→completed,
    // but saying so explicitly keeps the *reason* legible in evidence and
    // makes double-application a named, tested impossibility rather than
    // a side effect of a graph edge.
    if (commandType === "Upgrade.Complete" && existing?.status === "completed") {
      return {
        accepted: true,
        commandType,
        entityId,
        reason: `Upgrade ${entityId} is already completed — idempotent no-op, the capability change is not re-applied.`,
      };
    }

    if (def.isCreate) {
      if (existing) {
        return this.deny(
          commandType,
          entityId,
          `${ENTITY_TYPE_LABELS[def.entityType]} ${entityId} already exists.`,
        );
      }
    } else if (!existing && !this.isLazilyCreatable(commandType, def)) {
      return this.deny(
        commandType,
        entityId,
        `No ${ENTITY_TYPE_LABELS[def.entityType]} with id ${entityId}.`,
      );
    }

    /**
     * AC-109 — the start guard runs ahead of the generic transition check.
     *
     * Ordering is the whole point. Left to the generic check, a second
     * `Build.Start` on a build already at the approval gate answered
     * "Illegal transition for Build …: waiting_for_approval → running",
     * which is true and useless: it names a state machine, not the thing
     * the operator did. Running the named guard first means every reason a
     * build will not start — no plan, unreviewed, rejected, stale, already
     * started — is stated in the operator's terms.
     */
    if (commandType === "Build.Start") {
      const startable = this.requireStartableBuild(commandType, entityId);
      if (startable) return startable;
    }

    let eventType = def.eventType;
    let toStatus = def.toStatus;

    if (APPROVAL_RESOLUTION_COMMANDS.has(commandType)) {
      const resolution = this.prepareApprovalResolution(commandType, entityId, params, actor);
      if (resolution) return resolution;
    }

    if (commandType === "BuildStage.Validate") {
      const outcome = params.outcome;
      if (outcome !== "passed" && outcome !== "failed") {
        return this.deny(commandType, entityId, 'params.outcome must be "passed" or "failed".');
      }

      // Authorization already ran above, before the entity lookup.
      const coherence = this.requireValidationCoherence(commandType, entityId, params);
      if (coherence) return coherence;

      const prior = this.checkPriorValidation(commandType, entityId, outcome);
      if (prior) return prior;

      eventType = outcome === "passed" ? "stage.validation_passed" : "stage.validation_failed";
      // The reducer's own retryEligible branch decides the resulting status.
      if (outcome === "failed") toStatus = undefined;
    }

    const fromStatus = existing ? String(existing.status) : "pending";

    if (!def.isCreate && toStatus) {
      const reopenGuard = this.checkRevisionReopen(def.entityType, entityId, fromStatus, toStatus);
      if (reopenGuard === "illegal") {
        return this.deny(
          commandType,
          entityId,
          `Illegal transition for ${ENTITY_TYPE_LABELS[def.entityType]} ${entityId}: ${fromStatus} → ${toStatus}.`,
        );
      }
    }

    const guardFailure = this.runNamedGuards(
      commandType,
      def.entityType,
      entityId,
      existing,
      params,
      actor,
    );
    if (guardFailure) return guardFailure;

    const event = this.buildEvent(eventType, def.entityType, entityId, params, actor);
    const parsed = FoundryEventSchema.safeParse(event);
    if (!parsed.success) {
      return this.deny(
        commandType,
        entityId,
        "params do not match the required event payload shape for this command.",
      );
    }

    const result = this.persistence.appendEvent(parsed.data);
    if (!result.applied) {
      return this.deny(
        commandType,
        entityId,
        "This command's event id was already applied (idempotent no-op).",
      );
    }

    return { accepted: true, commandType, entityId, event: parsed.data };
  }

  /** Requirement.Start may target a requirement that doesn't exist yet — `reducer.ts` lazily creates it, defaulting to `pending`, exactly as it does when applying an event directly. */
  private isLazilyCreatable(commandType: CommandType, def: CommandDefinition): boolean {
    return def.entityType === "requirements" && commandType === "Requirement.Start";
  }

  /** Invariant 8 exception: a `completed` BuildStage may return to `running` only when an open Revision authorizes it. */
  private checkRevisionReopen(
    entityType: EntityType,
    entityId: string,
    fromStatus: string,
    toStatus: string,
  ): "legal" | "illegal" | "not-applicable" {
    if (entityType !== "buildStages" || fromStatus !== "completed" || toStatus !== "running") {
      const legal = isLegalTransition(entityType, fromStatus, toStatus);
      return legal ? "not-applicable" : "illegal";
    }
    const openRevision = this.persistence
      .listEntities<{ stageId: string; status: string }>("revisions")
      .find((r) => r.stageId === entityId && r.status === "in_progress");
    return openRevision ? "legal" : "illegal";
  }

  private runNamedGuards(
    commandType: CommandType,
    entityType: EntityType,
    entityId: string,
    existing: Record<string, unknown> | undefined,
    params: Record<string, unknown>,
    actor: CommandActor,
  ): CommandOutcome | undefined {
    switch (commandType) {
      case "Project.Create":
        return this.requireBoundedObjective(commandType, entityId, params);
      case "Build.Create":
        return this.requireBuildCoherence(commandType, entityId, params);
      case "Build.Plan":
        return this.requirePlannableBuild(commandType, entityId, params);
      case "Plan.Review":
        return this.requireReviewablePlan(commandType, entityId, params, actor);
      case "Plan.Authorize":
        return this.requireAuthorizablePlan(commandType, entityId, params, actor);
      // `Build.Start` is guarded earlier, ahead of the transition check —
      // see `requireStartableBuild`'s call site for why.
      case "BuildStage.Complete":
        return this.requireMandatoryRequirementsPassed(commandType, entityId);
      case "BuildStage.RequestRevision":
        return this.requireNoOpenRevision(commandType, entityId);
      case "Transfer.MarkReady":
        return this.requireProducingStageComplete(commandType, entityId, params);
      case "Upgrade.EvaluateEligibility":
        return this.requireUpgradePrerequisites(commandType, params);
      case "Upgrade.Start":
        return this.requireApprovedUpgradeApproval(commandType, entityId, params);
      default:
        void existing;
        void actor;
        return undefined;
    }
  }

  /**
   * F-05 / Agent invariant "Inspector cannot be Builder for same validation".
   *
   * Four checks, in order, and the order matters: each one is meaningless
   * without the one before it.
   *
   * 1. **Authenticated.** Before FBL-029 the actor was whatever the
   *    request body claimed, so "is this the Inspector?" was answered by
   *    the caller. An unauthenticated actor is refused outright — this is
   *    what turns role spoofing from a naming coincidence into a denial.
   * 2. **Is an agent.** Operators, the frontend, and backend automation
   *    are not validators, whatever they assert.
   * 3. **Holds the Inspector role in persisted state.** The role is read
   *    from the authoritative `Agent` record, never from the credential
   *    or the payload, so a token can never carry more authority than its
   *    agent actually has.
   * 4. **Did not produce the evidence.** An agent cannot validate its own
   *    output, whatever its role.
   *
   * Note what check 4 deliberately does *not* do: it does not reject an
   * Inspector for being assigned to the stage under validation. In V1 the
   * `qa_validation` stage *is* the Inspector's own stage (`v1-scope.md`
   * stage 6), so assignment there is the job, not a conflict. The
   * conflict the invariant actually names is validating work you
   * produced, which is what evidence provenance tests.
   *
   * Every failure returns the *same* message. A caller that could tell
   * "wrong role" from "unknown agent" from "you produced this" has a
   * probing oracle for backend state it is not authorized to read.
   */
  private requireIndependentInspector(
    commandType: CommandType,
    stageId: string,
    actor: CommandActor,
    params: Record<string, unknown>,
  ): CommandOutcome | undefined {
    const refuse = () =>
      this.deny(
        commandType,
        stageId,
        "Validation requires an authenticated, independent Inspector-role agent (F-05): the actor must be an agent whose persisted role is `inspector` and who did not perform this stage's work. Builder self-certification, frontend commands, and unauthenticated or role-asserting callers are rejected.",
        "Submit the validation from the Inspector agent's own authenticated credential.",
      );

    if (!actor.authenticated) return refuse();
    if (actor.actorType !== "agent") return refuse();

    const agent = this.persistence.getEntity<{ role: string }>("agents", actor.actorId);
    if (!agent || agent.role !== "inspector") return refuse();

    if (this.producedEvidenceUnderValidation(actor.actorId, params)) return refuse();

    return undefined;
  }

  /**
   * FBL-030 — principle 14, "Humans govern".
   *
   * An approval is resolved by a *person*, so the actor must be an
   * authenticated operator. Agents are refused even when genuinely
   * authenticated: an agent resolving the gate that exists to constrain
   * agents would make the gate ceremonial. The frontend is refused for
   * the same reason it is refused at validation — it holds no credential,
   * so it has no authority to exercise.
   *
   * Like the validation guard, every refusal returns the same message.
   */
  private requireAuthorizedOperator(
    commandType: CommandType,
    entityId: string,
    actor: CommandActor,
  ): CommandOutcome | undefined {
    if (actor.authenticated && actor.actorType === "operator") return undefined;

    // The act is named, not assumed. This guard now covers approvals,
    // upgrades, and plan review; a plan reviewer told "resolving an
    // approval requires…" would go looking for an approval that does not
    // exist. Caught by live verification at AC-108.
    const act =
      commandType === "Plan.Authorize"
        ? "Authorizing execution"
        : OPERATOR_PLAN_COMMANDS.has(commandType)
      ? "Reviewing a plan"
      : OPERATOR_BUILD_COMMANDS.has(commandType)
        ? "Starting a build"
        : OPERATOR_UPGRADE_COMMANDS.has(commandType)
          ? "Requesting or approving an upgrade"
          : "Resolving an approval";

    return this.deny(
      commandType,
      entityId,
      `${act} requires an authenticated operator (principle 14: humans govern). Agent, frontend, backend, and unauthenticated or authority-asserting callers are rejected.`,
      `Submit ${commandType} from the operator's own authenticated credential.`,
    );
  }

  /**
   * Duplicate, conflicting, and stale approval resolutions, plus the
   * derivation of `resolvedBy`.
   *
   * `resolvedBy` is written from the **authenticated principal**, never
   * from the payload. `event-model.md` pins it as a payload field, so it
   * must exist there — but a caller filling it in would be asserting who
   * made a governance decision, which is exactly the authority this rung
   * takes away from the payload. A caller that supplies a *different*
   * value is refused rather than silently overwritten: quietly rewriting
   * it would make the audit trail disagree with what was submitted.
   *
   * Returns an outcome when the command is settled here (idempotent
   * no-op, or a refusal); returns `undefined` to continue, having
   * normalised `params` in place.
   */
  private prepareApprovalResolution(
    commandType: CommandType,
    approvalId: string,
    params: Record<string, unknown>,
    actor: CommandActor,
  ): CommandOutcome | undefined {
    const claimed = params.resolvedBy;
    if (typeof claimed === "string" && claimed !== actor.actorId) {
      return this.deny(
        commandType,
        approvalId,
        `params.resolvedBy (${claimed}) does not match the authenticated operator (${actor.actorId}). Authority is established by the credential; the payload may not assert a different resolver.`,
        "Omit params.resolvedBy, or send it matching the authenticated operator.",
      );
    }
    params.resolvedBy = actor.actorId;

    const approval = this.persistence.getEntity<{
      status: string;
      resolvedBy?: string;
      resolvedAt?: string;
    }>("approvals", approvalId);
    if (!approval) return undefined; // the generic existence check reports this

    const target = APPROVAL_RESOLUTION_STATUS[commandType];

    if (approval.status === "pending") return undefined;

    if (approval.status === target) {
      // A retried resolution is not a second decision. Accepted, but
      // nothing new is recorded — the original decision stands, with its
      // original resolver and timestamp.
      return {
        accepted: true,
        commandType,
        entityId: approvalId,
        reason: `Approval ${approvalId} was already resolved as ${target} by ${approval.resolvedBy ?? "unknown"} at ${approval.resolvedAt ?? "unknown"} — idempotent no-op, no second decision recorded.`,
      };
    }

    return this.deny(
      commandType,
      approvalId,
      `Approval ${approvalId} is already resolved as ${approval.status}; a conflicting ${target} resolution is rejected.`,
      "A resolved approval is an immutable decision. Request a new approval rather than re-resolving this one.",
    );
  }

  /**
   * True when the validator is the agent that created any artifact it is
   * now offering as evidence — self-certification by provenance.
   *
   * `Artifact.createdByAgentId` is the authoritative record of who
   * produced a thing (domain-model.md → Artifact), so this reads the
   * fact rather than inferring it from stage assignment.
   */
  private producedEvidenceUnderValidation(
    agentId: string,
    params: Record<string, unknown>,
  ): boolean {
    const evidenceIds = Array.isArray(params.evidenceIds) ? (params.evidenceIds as unknown[]) : [];
    return evidenceIds.some((evidenceId) => {
      if (typeof evidenceId !== "string") return false;
      const artifact = this.persistence.getEntity<{ createdByAgentId?: string }>(
        "artifacts",
        evidenceId,
      );
      return artifact?.createdByAgentId === agentId;
    });
  }

  /**
   * Rejects a decision aimed at the wrong stage or citing evidence that
   * belongs to a different one.
   *
   * Without this, a well-formed decision could be applied to a stage the
   * Inspector never examined — the identity check would pass and the
   * result would still be meaningless.
   */
  private requireValidationCoherence(
    commandType: CommandType,
    stageId: string,
    params: Record<string, unknown>,
  ): CommandOutcome | undefined {
    const stage = this.persistence.getEntity<{ status: string }>("buildStages", stageId);
    if (!stage) {
      return this.deny(commandType, stageId, `No BuildStage with id ${stageId}.`);
    }

    // A decision is only meaningful while the stage is actually under
    // validation. Anything else is stale or out of order — a decision
    // about a state the stage has already left.
    if (stage.status !== "validating" && stage.status !== "running") {
      return this.deny(
        commandType,
        stageId,
        `Stage ${stageId} is ${stage.status}, not under validation — this decision is stale or out of order.`,
        "Re-read the current stage state and resubmit only if it is still awaiting validation.",
      );
    }

    const evidenceIds = Array.isArray(params.evidenceIds) ? (params.evidenceIds as unknown[]) : [];
    for (const evidenceId of evidenceIds) {
      if (typeof evidenceId !== "string") continue;
      const artifact = this.persistence.getEntity<{ stageId?: string }>("artifacts", evidenceId);
      // Unknown ids are permitted (evidence may live outside the Artifact
      // table), but an artifact that demonstrably belongs to another stage
      // is a mismatch, not a technicality.
      if (artifact && artifact.stageId && artifact.stageId !== stageId) {
        return this.deny(
          commandType,
          stageId,
          `Evidence ${evidenceId} belongs to stage ${artifact.stageId}, not ${stageId}.`,
        );
      }
    }

    return undefined;
  }

  /**
   * Duplicate and conflicting decisions.
   *
   * A resubmission of the *same* decision is idempotent — accepted as a
   * no-op that appends nothing, because a retried command should not
   * become a second recorded judgement. A *different* decision is
   * refused: the first one is already an immutable fact, and reversing it
   * is a revision (invariant 8), not a re-validation.
   */
  private checkPriorValidation(
    commandType: CommandType,
    stageId: string,
    outcome: "passed" | "failed",
  ): CommandOutcome | undefined {
    const history = this.persistence.getEntity<StageValidationHistory>("stageValidations", stageId);
    const latest = history?.decisions.at(-1);
    if (!latest) return undefined;

    if (latest.decision === outcome) {
      return {
        accepted: true,
        commandType,
        entityId: stageId,
        reason: `Stage ${stageId} was already validated as ${outcome} by ${latest.validatorAgentId} at ${latest.decidedAt} — idempotent no-op, no new decision recorded.`,
      };
    }

    return this.deny(
      commandType,
      stageId,
      `Stage ${stageId} already has a recorded ${latest.decision} decision; a conflicting ${outcome} decision is rejected.`,
      "Reversing a recorded validation requires the Revision path (invariant 8), not a second validation command.",
    );
  }

  /**
   * AC-103 — the objective a `Project.Create` carries must be bounded, and
   * only one project may be open at a time.
   *
   * This is the *floor*, not the whole envelope. `ObjectiveIntake` validates
   * the full submission (text, workspace, risk class, no unknown fields)
   * before it ever gets here — but a caller can POST `Project.Create`
   * straight to `/commands` and skip intake entirely, so the constraints
   * that survive into persisted truth have to be enforced at the layer that
   * writes it. Workspace and risk class are deliberately *not* re-checked
   * here: `operator.objective_submitted` carries neither field
   * (`event-model.md`), so neither is part of what this command persists,
   * and a guard on a value that is about to be discarded would be theatre.
   * They become enforceable state at the rung that makes them operational.
   */
  private requireBoundedObjective(
    commandType: CommandType,
    projectId: string,
    params: Record<string, unknown>,
  ): CommandOutcome | undefined {
    const parsed = ObjectiveTextSchema.safeParse(params.objective);
    if (!parsed.success) {
      return this.deny(
        commandType,
        projectId,
        `params.objective is not a bounded objective: ${parsed.error.issues.map((i) => i.message).join(" ")}`,
        "Resubmit with a single line of printable text describing one small, self-contained software artifact.",
      );
    }
    // Persist exactly what was validated, not what was typed around it.
    params.objective = parsed.data;

    const open = this.persistence
      .listEntities<{ id: string; status: string; objective: string }>("projects")
      .find((project) => OPEN_PROJECT_STATUSES.has(project.status));
    if (open) {
      return this.deny(
        commandType,
        projectId,
        `Project ${open.id} is still ${open.status} ("${open.objective}") — V1 permits one active project at a time (domain-model.md → Project V1 limits).`,
        "Foundry has no command that closes a project, so a different objective needs a fresh event log: stop the API, remove its database file, and restart.",
      );
    }

    return undefined;
  }

  /**
   * AC-103 — a `Build.Create` must be coherent with the project it claims.
   *
   * The identity check is the load-bearing one. `reducer.ts` keys the new
   * Build by `payload.buildId`, while the create/exists check above keys it
   * by `entityId`. When those disagree, the Build is written under an id the
   * handler does not believe exists — so the "already exists" guard stops
   * refusing a resubmission, and the same build can be created repeatedly.
   * Requiring them to match closes that by construction rather than by
   * asking every caller to remember.
   */
  private requireBuildCoherence(
    commandType: CommandType,
    buildId: string,
    params: Record<string, unknown>,
  ): CommandOutcome | undefined {
    if (params.buildId !== buildId) {
      return this.deny(
        commandType,
        buildId,
        `params.buildId (${String(params.buildId)}) must equal entityId (${buildId}) — the projection keys the Build by params.buildId, so a mismatch would create a Build this handler cannot see.`,
        "Send params.buildId identical to entityId.",
      );
    }

    const projectId = typeof params.projectId === "string" ? params.projectId : undefined;
    const project = projectId
      ? this.persistence.getEntity<{ status: string; objective: string }>("projects", projectId)
      : undefined;
    if (!project) {
      return this.deny(
        commandType,
        buildId,
        `params.projectId must reference an existing Project; no Project with id ${String(params.projectId)}.`,
        "Submit the objective first — a Build belongs to the Project the operator's objective created.",
      );
    }
    if (!OPEN_PROJECT_STATUSES.has(project.status)) {
      return this.deny(
        commandType,
        buildId,
        `Project ${projectId} is ${project.status}; a Build cannot be created under a project that is no longer open.`,
      );
    }

    // The Build's objective is a *snapshot* of the project's, so it has to
    // be a snapshot of something. A build whose objective disagrees with
    // its project would make the navigator and the timeline tell an
    // operator two different stories about what was asked for.
    if (params.objective !== project.objective) {
      return this.deny(
        commandType,
        buildId,
        `params.objective does not match Project ${projectId}'s objective — objectiveSnapshot must be a snapshot of the submitted objective.`,
        "Send params.objective exactly as the project records it.",
      );
    }

    const open = this.persistence
      .listEntities<{ id: string; status: string }>("builds")
      .find((build) => !TERMINAL_BUILD_STATUSES.has(build.status));
    if (open) {
      return this.deny(
        commandType,
        buildId,
        `Build ${open.id} is still ${open.status} — V1 permits one active build at a time (domain-model.md → Build V1 limits).`,
        "Let the open build reach a terminal state before creating another.",
      );
    }

    return undefined;
  }

  /**
   * AC-108 — a `Build.Plan` must be a plan *for this build*, and the build
   * must not already have one.
   *
   * The parameter schema has already proved the plan is structurally valid
   * — seven ordered stages, Foundry-managed workspace, R0–R2, at most one
   * Claude Code stage and only `backend_implementation`. What it cannot
   * check is coherence with persisted truth, which is this guard's job.
   */
  private requirePlannableBuild(
    commandType: CommandType,
    buildId: string,
    params: Record<string, unknown>,
  ): CommandOutcome | undefined {
    const plan = params.plan as BuildPlan | undefined;
    if (!plan) {
      return this.deny(commandType, buildId, "params.plan is required to plan a build.");
    }

    const build = this.persistence.getEntity<{ projectId: string; objectiveSnapshot: string }>(
      "builds",
      buildId,
    );
    if (!build) {
      return this.deny(commandType, buildId, `No Build with id ${buildId}.`);
    }

    if (plan.buildId !== buildId) {
      return this.deny(
        commandType,
        buildId,
        `params.plan.buildId (${plan.buildId}) does not match entityId (${buildId}) — a plan belongs to exactly one build.`,
      );
    }
    if (plan.projectId !== build.projectId) {
      return this.deny(
        commandType,
        buildId,
        `params.plan.projectId (${plan.projectId}) does not match Build ${buildId}'s project (${build.projectId}).`,
      );
    }
    // The plan must be a plan for the objective the operator actually
    // submitted, not for a different one that happens to be well-formed.
    if (plan.objective !== build.objectiveSnapshot) {
      return this.deny(
        commandType,
        buildId,
        "params.plan.objective does not match the Build's objectiveSnapshot — a plan must address the submitted objective.",
        "Re-plan against the objective this build records.",
      );
    }
    if (params.planId !== plan.planId || params.planArtifactId !== plan.planId) {
      return this.deny(
        commandType,
        buildId,
        `params.planId and params.planArtifactId must both equal params.plan.planId (${plan.planId}).`,
      );
    }
    if (!Array.isArray(params.stageIds) || params.stageIds.length !== BUILD_STAGE_SEQUENCE.length) {
      return this.deny(
        commandType,
        buildId,
        `params.stageIds must name exactly ${BUILD_STAGE_SEQUENCE.length} planned stages.`,
      );
    }

    // One plan per build in V1.1. Re-planning is a revision path this
    // mission does not have, and silently replacing a plan the operator
    // may already have reviewed would destroy the record of what they read.
    const existing = this.persistence
      .listEntities<PersistedPlan>("plans")
      .find((entry) => entry.plan.buildId === buildId);
    if (existing) {
      return this.deny(
        commandType,
        buildId,
        `Build ${buildId} already has plan ${existing.plan.planId}. V1.1 permits one plan per build.`,
        "Nothing to do — read the existing plan. Re-planning is not a V1.1 capability.",
      );
    }

    return undefined;
  }

  /**
   * AC-108 — a review must name a plan that exists, at the revision the
   * operator actually read, and must not overwrite a decision.
   *
   * `reviewedBy` and `planRevision` are written here from authenticated and
   * persisted values respectively, never from the payload — the same rule
   * `prepareApprovalResolution` applies to `resolvedBy`, and for the same
   * reason: a caller must not be able to assert who decided, or claim to
   * have read a revision other than the one on record.
   */
  private requireReviewablePlan(
    commandType: CommandType,
    planId: string,
    params: Record<string, unknown>,
    actor: CommandActor,
  ): CommandOutcome | undefined {
    const persisted = this.persistence.getEntity<PersistedPlan>("plans", planId);
    if (!persisted) {
      return this.deny(commandType, planId, `No Plan with id ${planId}.`);
    }
    if (params.planId !== planId) {
      return this.deny(
        commandType,
        planId,
        `params.planId (${String(params.planId)}) must equal entityId (${planId}).`,
      );
    }
    if (params.buildId !== persisted.plan.buildId) {
      return this.deny(
        commandType,
        planId,
        `params.buildId does not match plan ${planId}'s build (${persisted.plan.buildId}).`,
      );
    }

    // The operator must have read *this* revision. Recomputing rather than
    // trusting the stored value keeps the check honest if the two ever
    // disagree.
    const current = planRevision(persisted.plan);
    if (params.reviewedRevision !== current) {
      return this.deny(
        commandType,
        planId,
        `The plan changed since it was read: reviewed revision ${String(params.reviewedRevision)}, current ${current}.`,
        "Re-read the current plan, then record your decision against it.",
      );
    }

    if (persisted.review) {
      if (persisted.review.decision === params.decision) {
        return {
          accepted: true,
          commandType,
          entityId: planId,
          reason: `Plan ${planId} was already reviewed as ${persisted.review.decision} by ${persisted.review.reviewedBy} at ${persisted.review.reviewedAt} — idempotent no-op, no second decision recorded.`,
        };
      }
      return this.deny(
        commandType,
        planId,
        `Plan ${planId} is already reviewed as ${persisted.review.decision}; a conflicting ${String(params.decision)} decision is rejected.`,
        "A recorded review is an immutable decision. It is not re-decided.",
      );
    }

    // Normalise into the event payload shape. Authority-bearing fields are
    // set from the credential and from persisted state, not from input.
    params.reviewedBy = actor.actorId;
    params.planRevision = current;
    delete params.reviewedRevision;

    return undefined;
  }

  /**
   * AC-110 — the execution authorization gate, at the write path.
   *
   * This is the one place an `ExecutionAuthorization` can come into
   * existence, and every authority-bearing field on it is written here
   * from persisted truth or from the credential. A caller supplies the
   * stage, the budget, and a statement of which hash it was looking at —
   * nothing else, and `.strict()` refuses anything else.
   *
   * ## The binding (`F-113a`)
   *
   * `planContentHash` is **recomputed from persisted plan content** on
   * every authorization and written into the event. The client's
   * `acknowledgedContentHash` is compared against it and then discarded:
   * it exists so an operator reading a stale screen is refused rather than
   * silently authorizing something they did not see. A client-supplied
   * value is therefore never the binding — it is only ever evidence about
   * what the client had in front of it.
   *
   * The stored `contentHash` field is deliberately **not** consulted.
   * Comparing the stored hash to itself would prove nothing; recomputing
   * from content means a record whose stored hash and stored plan ever
   * disagreed fails closed.
   *
   * ## What this does not do
   *
   * It creates no `BuildStage`, no `Task`, no `AgentRun`, and no process.
   * Authorizing is permission for one future run of one stage. `AC-111`
   * performs that run, once, under this record.
   */
  private requireAuthorizablePlan(
    commandType: CommandType,
    planId: string,
    params: Record<string, unknown>,
    actor: CommandActor,
  ): CommandOutcome | undefined {
    const persisted = this.persistence.getEntity<PersistedPlan>("plans", planId);
    if (!persisted) {
      return this.deny(commandType, planId, `No Plan with id ${planId}.`);
    }
    if (params.planId !== planId) {
      return this.deny(
        commandType,
        planId,
        `params.planId (${String(params.planId)}) must equal entityId (${planId}).`,
      );
    }
    if (params.buildId !== persisted.plan.buildId) {
      return this.deny(
        commandType,
        planId,
        `params.buildId does not match plan ${planId}'s build (${persisted.plan.buildId}).`,
      );
    }

    // Reviewing precedes authorizing, and they stay separate decisions
    // (AC-107 decision 6). `proceed` alone never authorized anything; this
    // is the act that does, and it cannot happen without that review.
    if (!persisted.review) {
      return this.deny(
        commandType,
        planId,
        `Plan ${planId} has not been reviewed. Execution is not authorized from a plan nobody read (principle 14: humans govern).`,
        "Read the plan and record a decision on it first.",
      );
    }
    if (persisted.review.decision !== "proceed") {
      return this.deny(
        commandType,
        planId,
        `Plan ${planId} was reviewed as ${persisted.review.decision}, not proceed; execution cannot be authorized against it.`,
        "A recorded review is an immutable decision. It is not re-decided.",
      );
    }

    // One authorization per plan in V1.1. Reissuing would quietly widen a
    // single-use grant into a renewable one.
    if (persisted.authorization) {
      return this.deny(
        commandType,
        planId,
        `Plan ${planId} already has execution authorization ${persisted.authorization.authorizationId}, issued by ${persisted.authorization.authorizedBy} at ${persisted.authorization.authorizedAt} for stage \`${persisted.authorization.stageName}\`. An authorization is single-use and is not reissued (F-113).`,
        "Nothing to do — the authorization already exists. Reissuing would turn a single-use grant into a renewable one.",
      );
    }

    const stageName = params.stageName;
    const stage = persisted.plan.stages.find((entry) => entry.name === stageName);
    if (!stage) {
      return this.deny(
        commandType,
        planId,
        `Stage \`${String(stageName)}\` is not in plan ${planId}.`,
      );
    }
    /**
     * The authorized stage must be one the plan actually allocates to the
     * controlled runtime. Authorizing a mock stage would grant permission
     * for something that was never going to invoke a model — an
     * authorization that reads as meaningful and buys nothing.
     */
    if (stage.runtime !== "claude_code") {
      return this.deny(
        commandType,
        planId,
        `Stage \`${stage.name}\` runs with the \`${stage.runtime}\` runtime in this plan, so there is no real execution to authorize. Only the stage the plan allocates to \`claude_code\` (\`${CLAUDE_CODE_STAGE}\`) can be authorized.`,
        `Authorize \`${CLAUDE_CODE_STAGE}\`, or re-plan if a different stage was intended to run for real.`,
      );
    }

    /**
     * AC-111 — the objective must match a supported execution template.
     *
     * Refused **here**, before an authorization exists, rather than at
     * dispatch. An authorization for an objective that can never be
     * executed is a permission the system cannot honour, and issuing one
     * would move the operator's disappointment from the moment they ask
     * to the moment they run.
     *
     * The rule is a deterministic keyword conjunction over normalised
     * text (`matchSupportedObjective`) — no model, no fuzzy matching, no
     * scoring. The refusal states the rule so the operator learns what a
     * supported objective must contain.
     */
    const objectiveMatch = matchSupportedObjective(persisted.plan.objective);
    if (!objectiveMatch.supported) {
      return this.deny(
        commandType,
        planId,
        objectiveMatch.reason,
        objectiveMatch.correctiveAction,
      );
    }

    // Recomputed from persisted content — the binding, and the only value
    // this command will write.
    const currentContentHash = planContentHash(persisted.plan);
    if (
      typeof params.acknowledgedContentHash !== "string" ||
      !plansContentHashEquals(params.acknowledgedContentHash, currentContentHash)
    ) {
      return this.deny(
        commandType,
        planId,
        `The plan changed since it was read: acknowledged content hash ${String(params.acknowledgedContentHash)}, current ${currentContentHash}. Authorization is refused rather than granted against something the operator did not see.`,
        "Re-read the current plan, then authorize against it.",
      );
    }

    /**
     * Normalise into the event payload shape.
     *
     * Every authority-bearing field is set here, from the credential or
     * from persisted plan content. `acknowledgedContentHash` is deleted
     * rather than carried: it was evidence for a check that has now run,
     * and leaving it on the event would put a client-supplied hash next to
     * the backend's own where a later reader could confuse the two.
     */
    params.authorizationId = executionAuthorizationId(planId);
    params.planContentHash = currentContentHash;
    params.planRevision = planRevision(persisted.plan);
    params.workspace = persisted.plan.workspace;
    params.riskClass = persisted.plan.riskClass;
    params.authorizedBy = actor.actorId;
    params.supportedObjectiveId = objectiveMatch.template.id;
    delete params.acknowledgedContentHash;

    return undefined;
  }

  /**
   * AC-109 — a build starts only from a plan the operator read and
   * accepted, and only once.
   *
   * This is the gate the whole orchestration hangs from, so each condition
   * is checked and named separately. A single "cannot start" would leave
   * the operator guessing between six genuinely different problems with
   * six different fixes.
   *
   * Every check reads **persisted truth**. The revision is recomputed from
   * the stored plan rather than trusted from the stored `revision` field,
   * so a plan edited after review cannot present the fingerprint of the
   * version that was approved.
   *
   * Note what this deliberately is **not**: an execution authorization. It
   * permits the mock executor to advance a reviewed build. Authorizing a
   * real model invocation is a separate, single-use act that does not
   * exist yet (`F-113`, `AC-110`), and no amount of starting builds
   * produces one.
   */
  private requireStartableBuild(
    commandType: CommandType,
    buildId: string,
  ): CommandOutcome | undefined {
    const build = this.persistence.getEntity<{ status: string }>("builds", buildId);
    if (!build) {
      return this.deny(commandType, buildId, `No Build with id ${buildId}.`);
    }

    // Checked before the plan so a restarted build reports the reason that
    // actually applies to it, rather than something about its plan.
    if (build.status !== "planned") {
      return this.deny(
        commandType,
        buildId,
        `Build ${buildId} is ${build.status}, not planned — a build is started once.`,
        build.status === "running"
          ? "Nothing to do: this build is already running. Watch its stages rather than starting it again."
          : "A build that has left `planned` cannot be restarted; its history is the record of what happened.",
      );
    }

    const persisted = this.persistence
      .listEntities<PersistedPlan>("plans")
      .find((entry) => entry.plan.buildId === buildId);
    if (!persisted) {
      return this.deny(
        commandType,
        buildId,
        `Build ${buildId} has no plan. There is nothing to orchestrate: the stages, their order, and their requirements all come from the plan.`,
        "Submit an objective so the Architect produces a plan, then read and review it.",
      );
    }

    const review = persisted.review;
    if (!review) {
      return this.deny(
        commandType,
        buildId,
        `Plan ${persisted.plan.planId} has not been reviewed. A build is not started from a plan nobody read (principle 14: humans govern).`,
        "Read the plan and record a decision on it.",
      );
    }
    if (review.decision !== "proceed") {
      return this.deny(
        commandType,
        buildId,
        `Plan ${persisted.plan.planId} was reviewed as ${review.decision} by ${review.reviewedBy}, not proceed.`,
        "A recorded review is an immutable decision. It is not re-decided; a different plan would need a different build.",
      );
    }

    const current = planRevision(persisted.plan);
    if (review.reviewedRevision !== current) {
      return this.deny(
        commandType,
        buildId,
        `The plan changed after it was reviewed: reviewed revision ${review.reviewedRevision}, current ${current}. The recorded approval does not cover the current plan.`,
        "Re-read the current plan and record a decision against it before starting.",
      );
    }

    return undefined;
  }

  // F-04 / invariant 2: mandatory requirements must pass before stage completion.
  private requireMandatoryRequirementsPassed(
    commandType: CommandType,
    stageId: string,
  ): CommandOutcome | undefined {
    const outstanding = this.persistence
      .listEntities<{ stageId: string; required: boolean; status: string; name: string }>(
        "requirements",
      )
      .filter((r) => r.stageId === stageId && r.required && r.status !== "passed");
    if (outstanding.length > 0) {
      return this.deny(
        commandType,
        stageId,
        `Mandatory requirement(s) not passed (F-04): ${outstanding.map((r) => r.name).join(", ")}.`,
      );
    }
    return undefined;
  }

  // domain-model.md → Revision V1 limits: at most one open Revision per stage.
  private requireNoOpenRevision(
    commandType: CommandType,
    stageId: string,
  ): CommandOutcome | undefined {
    const open = this.persistence
      .listEntities<{ stageId: string; status: string }>("revisions")
      .some(
        (r) => r.stageId === stageId && (r.status === "requested" || r.status === "in_progress"),
      );
    if (open) {
      return this.deny(
        commandType,
        stageId,
        "This stage already has an open Revision (at most one at a time).",
      );
    }
    return undefined;
  }

  // Invariant 3: the stage that *produced* the artifact must be completed
  // before transfer readiness; the qa_to_deployment_dock leg additionally
  // requires an approved Approval (invariant 4 / F-06).
  private requireProducingStageComplete(
    commandType: CommandType,
    transferId: string,
    params: Record<string, unknown>,
  ): CommandOutcome | undefined {
    const producingStageId = params.producingStageId;
    if (typeof producingStageId !== "string" || producingStageId.length === 0) {
      return this.deny(
        commandType,
        transferId,
        "params.producingStageId is required to verify invariant 3 (the producing stage, not the transfer's own stage, must be completed).",
      );
    }
    const stage = this.persistence.getEntity<{ status: string }>("buildStages", producingStageId);
    if (!stage || stage.status !== "completed") {
      return this.deny(
        commandType,
        transferId,
        `Producing stage ${producingStageId} is not completed (invariant 3 / F-04) — transfer readiness blocked.`,
      );
    }
    if (params.leg === "qa_to_deployment_dock") {
      const buildId = typeof params.buildId === "string" ? params.buildId : undefined;
      const approved = this.persistence
        .listEntities<{ buildId: string; status: string }>("approvals")
        .some((a) => a.buildId === buildId && a.status === "approved");
      if (!approved) {
        return this.deny(
          commandType,
          transferId,
          "qa_to_deployment_dock is the approval-gated leg (invariant 4 / F-06) — no approved Approval found for params.buildId.",
        );
      }
    }
    return undefined;
  }

  /**
   * Invariant 9 / principle 20: upgrades require evidence and satisfied
   * prerequisites (`domain-model.md` → "Warehouse Level 2 prerequisites").
   *
   * All four mechanically checkable prerequisites are evaluated against
   * **persisted backend truth**, never a caller-supplied claim:
   *
   * 1. 10 successful artifact packages, per the M-06 counting rule
   *    (a seeded history of 9 plus this build's single package).
   * 2. No unresolved critical event.
   * 3. ≥90% validation pass rate after retries.
   * 4. Event persistence verified.
   *
   * Prerequisite 3 was previously unenforced for a real reason — there
   * was no per-retry ledger to compute a rate from. FBL-029's
   * append-only `stageValidations` history is that ledger, so it is
   * enforced here now rather than left as a comment.
   */
  private requireUpgradePrerequisites(
    commandType: CommandType,
    params: Record<string, unknown>,
  ): CommandOutcome | undefined {
    const buildingId = typeof params.buildingId === "string" ? params.buildingId : undefined;
    const snapshot = this.persistence.getWorldStateSnapshot();

    const successfulPackages = snapshot.inventoryCounts.successfulPackages ?? 0;
    if (successfulPackages < WAREHOUSE_LEVEL_2_REQUIRED_PACKAGE_COUNT) {
      return this.deny(
        commandType,
        buildingId,
        `Only ${successfulPackages}/${WAREHOUSE_LEVEL_2_REQUIRED_PACKAGE_COUNT} successful packages processed (invariant 9).`,
      );
    }

    if (snapshot.health.status === "critical") {
      return this.deny(
        commandType,
        buildingId,
        "An unresolved critical event exists (invariant 9).",
      );
    }

    const passRate = this.validationPassRate();
    if (passRate !== null && passRate < WAREHOUSE_LEVEL_2_MIN_PASS_RATE) {
      return this.deny(
        commandType,
        buildingId,
        `Validation pass rate after retries is ${(passRate * 100).toFixed(0)}%, below the required ${(WAREHOUSE_LEVEL_2_MIN_PASS_RATE * 100).toFixed(0)}% (invariant 9).`,
      );
    }

    // "Event persistence verified": the log must actually be readable and
    // consistent with the projection it produced. A count of zero means
    // the projection came from somewhere other than a persisted log.
    if (this.persistence.getAllEvents().length === 0) {
      return this.deny(
        commandType,
        buildingId,
        "Event persistence is not verified — the persisted log is empty (invariant 9).",
      );
    }

    return undefined;
  }

  /**
   * Validation pass rate over the persisted decision ledger, counting
   * each stage **once, by its final decision** — that is what "after
   * retries" means. Counting every decision would penalise a stage that
   * failed and was then repaired, which is precisely the workflow V1
   * demonstrates.
   *
   * Returns null when no stage has been validated yet, so an upgrade is
   * not blocked by a rate computed from nothing.
   */
  private validationPassRate(): number | null {
    const histories = this.persistence.listEntities<StageValidationHistory>("stageValidations");
    const finalDecisions = histories
      .map((history) => history.decisions.at(-1)?.decision)
      .filter((decision): decision is "passed" | "failed" => decision !== undefined);

    if (finalDecisions.length === 0) return null;
    const passed = finalDecisions.filter((decision) => decision === "passed").length;
    return passed / finalDecisions.length;
  }

  private requireApprovedUpgradeApproval(
    commandType: CommandType,
    upgradeId: string,
    params: Record<string, unknown>,
  ): CommandOutcome | undefined {
    const approvalId = params.approvalId;
    const approval =
      typeof approvalId === "string"
        ? this.persistence.getEntity<{ status: string }>("approvals", approvalId)
        : undefined;
    if (!approval || approval.status !== "approved") {
      return this.deny(
        commandType,
        upgradeId,
        "params.approvalId must reference an approved Approval (invariant 9: operator approval).",
      );
    }
    return undefined;
  }

  private handleStartUpgrade(buildingId: string | undefined, actor: CommandActor): CommandOutcome {
    if (!buildingId) {
      return this.deny("Building.StartUpgrade", buildingId, "entityId (buildingId) is required.");
    }
    const eligible = this.persistence
      .listEntities<{ id: string; buildingId: string; status: string }>("upgrades")
      .find((u) => u.buildingId === buildingId && u.status === "eligible");
    if (!eligible) {
      return this.deny(
        "Building.StartUpgrade",
        buildingId,
        COMMAND_DEFINITIONS["Building.StartUpgrade"].denyReason ??
          "No eligible Upgrade found for this building.",
      );
    }
    return this.submit(
      { commandType: "Upgrade.Request", entityId: eligible.id, params: {} },
      actor,
    );
  }

  private buildEvent(
    eventType: FoundryEvent["type"],
    entityType: EntityType,
    entityId: string,
    params: Record<string, unknown>,
    actor: CommandActor,
  ): unknown {
    const { correlationId, causationId, ...payload } = params;
    const occurredAt = new Date().toISOString();
    if (eventType === "build.completed" || eventType === "stage.completed") {
      (payload as Record<string, unknown>).completedAt = occurredAt;
    }
    return {
      id: randomUUID(),
      type: eventType,
      occurredAt,
      actorType: actor.actorType,
      actorId: actor.actorId,
      entityType: ENTITY_TYPE_LABELS[entityType],
      entityId,
      correlationId: typeof correlationId === "string" ? correlationId : entityId,
      causationId: typeof causationId === "string" ? causationId : undefined,
      severity: "info",
      schemaVersion: 1,
      payload,
    };
  }

  private deny(
    commandType: CommandType,
    entityId: string | undefined,
    reason: string,
    correctiveAction = "Resolve the stated condition and resubmit.",
  ): CommandOutcome {
    return { accepted: false, commandType, entityId, reason, correctiveAction };
  }
}

export { INSPECTOR_AGENT_ID };
