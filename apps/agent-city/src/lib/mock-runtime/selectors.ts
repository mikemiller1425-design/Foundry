import type { BuildStageName, BuildStageStatus, RequirementStatus } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { STAGE_NAMES } from "./script";

export interface StageSummary {
  id: string;
  name: BuildStageName;
  status: BuildStageStatus;
  blockedReason?: string;
  /** From `stage.started`'s payload — which building the stage runs at (event-model.md). Undefined until the stage has started at least once. */
  sourceBuildingId?: string;
  /**
   * The most recent independent-validation decision for this stage
   * (FBL-029), taken from `stage.validation_passed` / `_failed`.
   *
   * Kept separately from `status` because the two answer different
   * questions. `BuildStageStatus` has no value meaning "an Inspector
   * rejected this", so a failure has to be carried as `blocked` — but
   * `blocked` is also what a missing prerequisite looks like, and
   * `event-model.md` requires a validation failure to render QA *red*
   * rather than merely obstructed. This field preserves the distinction
   * the status enum cannot.
   */
  validationDecision?: "passed" | "failed";
}

export interface RequirementSummary {
  id: string;
  stageId: string;
  status: RequirementStatus;
  message?: string;
}

/**
 * Folds the event log into a per-stage status summary, in canonical order.
 * WorldState (domain-model.md) does not itself carry stage-level detail —
 * these selectors derive it from events, the authoritative source, rather
 * than inventing a parallel local domain type.
 *
 * Stage ids are opaque; identity is derived from the order stage.created
 * events first appear (always the canonical seven-stage sequence —
 * domain-model.md BuildStage V1 limits), so no seed/id-map needs to be
 * threaded through the UI layer.
 */
export function selectStages(events: readonly FoundryEvent[]): StageSummary[] {
  const nameById = new Map<string, BuildStageName>();
  const byId = new Map<string, StageSummary>();

  for (const event of events) {
    if (event.type === "stage.created" && !nameById.has(event.entityId)) {
      const name = STAGE_NAMES[nameById.size];
      if (!name) continue;
      nameById.set(event.entityId, name);
      byId.set(event.entityId, { id: event.entityId, name, status: "planned" });
    }
  }

  for (const event of events) {
    if (!event.type.startsWith("stage.")) continue;
    const name = nameById.get(event.entityId);
    if (!name) continue;
    const current = byId.get(event.entityId);
    if (!current) continue;
    switch (event.type) {
      case "stage.created":
        byId.set(event.entityId, { ...current, status: "planned" });
        break;
      case "stage.ready":
        byId.set(event.entityId, { ...current, status: "ready" });
        break;
      case "stage.started":
        byId.set(event.entityId, {
          ...current,
          status: "running",
          sourceBuildingId: (event.payload as { sourceBuildingId?: string }).sourceBuildingId,
        });
        break;
      case "stage.blocked":
        byId.set(event.entityId, {
          ...current,
          status: "blocked",
          blockedReason: (event.payload as { reason: string }).reason,
        });
        break;
      case "stage.validation_started":
        byId.set(event.entityId, { ...current, status: "validating" });
        break;
      case "stage.validation_passed":
        byId.set(event.entityId, { ...current, validationDecision: "passed" });
        break;
      case "stage.validation_failed":
        // No dedicated BuildStageStatus value exists for this — "blocked"
        // is the closest allowed status (event-model.md: "QA red; vehicle
        // parked"), consistent with how a failed mandatory requirement
        // blocks the stage elsewhere in this same reducer. The separate
        // `validationDecision` field is what lets the world render this
        // as red rather than as an ordinary block.
        byId.set(event.entityId, {
          ...current,
          status: "blocked",
          blockedReason: "Independent validation failed",
          validationDecision: "failed",
        });
        break;
      case "stage.completed":
        byId.set(event.entityId, { ...current, status: "completed", blockedReason: undefined });
        break;
      case "stage.failed":
        byId.set(event.entityId, { ...current, status: "failed" });
        break;
      default:
        break;
    }
  }

  // Revision events (event-model.md → "Revision") reference their stage via
  // `stageId` — present directly on `revision.requested`'s payload, but not
  // on `revision.started`'s (only `revisionId` there), so `started` is
  // resolved back to a stage via the `requested` event sharing its
  // `revisionId` (== `entityId`).
  const stageIdByRevisionId = new Map<string, string>();
  for (const event of events) {
    if (event.type !== "revision.requested") continue;
    const payload = event.payload as { stageId?: string };
    if (payload.stageId) stageIdByRevisionId.set(event.entityId, payload.stageId);
  }
  for (const event of events) {
    if (event.entityType !== "Revision") continue;
    const stageId =
      event.type === "revision.requested"
        ? (event.payload as { stageId?: string }).stageId
        : stageIdByRevisionId.get(event.entityId);
    if (!stageId) continue;
    const current = byId.get(stageId);
    if (!current) continue;
    if (event.type === "revision.requested") {
      byId.set(stageId, { ...current, status: "revision_required" });
    } else if (event.type === "revision.started") {
      byId.set(stageId, { ...current, status: "running", blockedReason: undefined });
    }
  }

  const byName = new Map<BuildStageName, StageSummary>(
    [...byId.values()].map((summary) => [summary.name, summary]),
  );
  return STAGE_NAMES.filter((name) => byName.has(name)).map((name) => byName.get(name)!);
}

/**
 * Requirement events don't carry a stageId in their payload (event-model.md
 * documents no such field). BuildStages run strictly sequentially in V1
 * (domain-model.md invariants), so a requirement event's stage is
 * unambiguous: whichever stage most recently started and has not yet
 * completed/failed when the requirement event occurs.
 */
export function selectRequirementsByStage(
  events: readonly FoundryEvent[],
): Map<string, RequirementSummary[]> {
  const result = new Map<string, RequirementSummary[]>();
  const byRequirementId = new Map<string, RequirementSummary>();
  let currentStageId: string | null = null;

  for (const event of events) {
    if (event.type === "stage.started") {
      currentStageId = event.entityId;
      if (!result.has(currentStageId)) result.set(currentStageId, []);
    } else if (event.type === "stage.completed" || event.type === "stage.failed") {
      currentStageId = null;
    } else if (event.entityType === "Requirement" && currentStageId) {
      const existing = byRequirementId.get(event.entityId);
      const status = requirementStatusForEvent(event.type, existing?.status);
      if (!status) continue;
      // Only surface the failure message while the requirement is currently
      // failed — once it passes (e.g. after a retry), the checklist should
      // read as resolved, not still show red "still failing" evidence text.
      // The original requirement.failed event remains permanently
      // inspectable in the timeline regardless.
      const message =
        event.type === "requirement.failed"
          ? (event.payload as { message: string }).message
          : status === "failed"
            ? existing?.message
            : undefined;
      const summary: RequirementSummary = {
        id: event.entityId,
        stageId: currentStageId,
        status,
        message,
      };
      byRequirementId.set(event.entityId, summary);
      const list = result.get(currentStageId) ?? [];
      const index = list.findIndex((r) => r.id === event.entityId);
      if (index >= 0) list[index] = summary;
      else list.push(summary);
      result.set(currentStageId, list);
    }
  }

  return result;
}

function requirementStatusForEvent(
  type: string,
  previous: RequirementStatus | undefined,
): RequirementStatus | null {
  switch (type) {
    case "requirement.started":
      return "running";
    case "requirement.passed":
      return "passed";
    case "requirement.failed":
      return "failed";
    case "requirement.retried":
      return "running";
    default:
      return previous ?? null;
  }
}

/**
 * True while an Upgrade is between `upgrade.started` and its terminal
 * `upgrade.completed`/`upgrade.failed` — WorldState has no standalone
 * Upgrade record (only `Building.level`, set atomically at
 * `upgrade.completed`), so "upgrading" is derived from the event log
 * directly, the same pattern `selectStages` already establishes for
 * stage-level detail WorldState doesn't carry either.
 */
export function selectUpgradeInProgress(events: readonly FoundryEvent[]): boolean {
  let inProgress = false;
  for (const event of events) {
    if (event.type === "upgrade.started") inProgress = true;
    else if (event.type === "upgrade.completed" || event.type === "upgrade.failed") {
      inProgress = false;
    }
  }
  return inProgress;
}
