import { randomUUID } from "node:crypto";
import type { CommandRequest, CommandType } from "@foundry/contracts";
import { FoundryEventSchema, type ActorType, type FoundryEvent } from "@foundry/event-types";
import { WORLD_AGENTS } from "@foundry/world-model";
import { COMMAND_DEFINITIONS, ENTITY_TYPE_LABELS, type CommandDefinition } from "./commandDefinitions";
import type { PersistenceService } from "./persistenceService";
import type { EntityType } from "./reducer";
import { isLegalTransition } from "./transitionGraphs";

export interface CommandActor {
  actorType: ActorType;
  actorId: string;
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
      return this.deny(commandType, entityId, def.denyReason ?? "No enforcement path exists for this command.");
    }

    if (!entityId) {
      return this.deny(commandType, entityId, "entityId is required for this command.");
    }

    const existing = this.persistence.getEntity<Record<string, unknown>>(def.entityType, entityId);

    if (def.isCreate) {
      if (existing) {
        return this.deny(commandType, entityId, `${ENTITY_TYPE_LABELS[def.entityType]} ${entityId} already exists.`);
      }
    } else if (!existing && !this.isLazilyCreatable(commandType, def)) {
      return this.deny(commandType, entityId, `No ${ENTITY_TYPE_LABELS[def.entityType]} with id ${entityId}.`);
    }

    let eventType = def.eventType;
    let toStatus = def.toStatus;

    if (commandType === "BuildStage.Validate") {
      const outcome = params.outcome;
      if (outcome === "passed") {
        eventType = "stage.validation_passed";
        const guardFailure = this.requireInspector(commandType, entityId, actor);
        if (guardFailure) return guardFailure;
      } else if (outcome === "failed") {
        eventType = "stage.validation_failed";
        toStatus = undefined; // reducer's own retryEligible branch decides the resulting status
      } else {
        return this.deny(commandType, entityId, 'params.outcome must be "passed" or "failed".');
      }
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

    const guardFailure = this.runNamedGuards(commandType, def.entityType, entityId, existing, params, actor);
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
      return this.deny(commandType, entityId, "This command's event id was already applied (idempotent no-op).");
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

  // F-05: "Builder cannot produce stage.validation_passed; Inspector path required."
  private requireInspector(
    commandType: CommandType,
    entityId: string,
    actor: CommandActor,
  ): CommandOutcome | undefined {
    const agent =
      actor.actorType === "agent" ? this.persistence.getEntity<{ role: string }>("agents", actor.actorId) : undefined;
    if (actor.actorType !== "agent" || !agent || agent.role !== "inspector") {
      return this.deny(
        commandType,
        entityId,
        "Builder cannot self-certify (F-05): stage.validation_passed requires an independent Inspector actor.",
      );
    }
    return undefined;
  }

  // F-04 / invariant 2: mandatory requirements must pass before stage completion.
  private requireMandatoryRequirementsPassed(commandType: CommandType, stageId: string): CommandOutcome | undefined {
    const outstanding = this.persistence
      .listEntities<{ stageId: string; required: boolean; status: string; name: string }>("requirements")
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
  private requireNoOpenRevision(commandType: CommandType, stageId: string): CommandOutcome | undefined {
    const open = this.persistence
      .listEntities<{ stageId: string; status: string }>("revisions")
      .some((r) => r.stageId === stageId && (r.status === "requested" || r.status === "in_progress"));
    if (open) {
      return this.deny(commandType, stageId, "This stage already has an open Revision (at most one at a time).");
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

  // Invariant 9: upgrades require evidence and satisfied prerequisites.
  // Mechanically checkable prerequisites only (successfulPackages count,
  // no unresolved critical health) — "≥90% pass rate after retries" has
  // no per-retry ledger in V1 and is not checked here; "operator approval"
  // is checked separately at Upgrade.Start.
  private requireUpgradePrerequisites(
    commandType: CommandType,
    params: Record<string, unknown>,
  ): CommandOutcome | undefined {
    const snapshot = this.persistence.getWorldStateSnapshot();
    const successfulPackages = snapshot.inventoryCounts.successfulPackages ?? 0;
    if (successfulPackages < 10) {
      return this.deny(
        commandType,
        typeof params.buildingId === "string" ? params.buildingId : undefined,
        `Only ${successfulPackages}/10 successful packages processed (invariant 9).`,
      );
    }
    if (snapshot.health.status === "critical") {
      return this.deny(
        commandType,
        typeof params.buildingId === "string" ? params.buildingId : undefined,
        "An unresolved critical event exists (invariant 9).",
      );
    }
    return undefined;
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
        COMMAND_DEFINITIONS["Building.StartUpgrade"].denyReason ?? "No eligible Upgrade found for this building.",
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

  private deny(commandType: CommandType, entityId: string | undefined, reason: string): CommandOutcome {
    return {
      accepted: false,
      commandType,
      entityId,
      reason,
      correctiveAction: "Resolve the stated condition and resubmit.",
    };
  }
}

export { INSPECTOR_AGENT_ID };
