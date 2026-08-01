import type { BuildingStatus, WorldState } from "@foundry/contracts";
import { getWorldBuildingId } from "@foundry/world-model";
import type { StageSummary } from "@/lib/mock-runtime/selectors";

const WAREHOUSE_ID = getWorldBuildingId("warehouse");
const QA_ID = getWorldBuildingId("qa");

/**
 * FBL-021 — derives each operational building's `Building.status` from real
 * workflow state (Required behavior 3: "Operational buildings derive their
 * declared visual states from workflow state"), rather than a
 * `building.state_changed` event the canonical mock script never actually
 * emits. Every input here (`stage.started`'s `sourceBuildingId`, transfers
 * touching this building, system health, upgrade progress) is itself
 * produced by a real declared event already reduced into `WorldState` or
 * derivable from the event log — never a timer, never an animation
 * callback. Priority order (most severe/specific first), mirroring the
 * precedence discipline `lighthouseState.ts` established: a genuine
 * problem always outranks routine activity.
 */
export function computeOperationalBuildingStatus(
  buildingId: string,
  worldState: WorldState,
  stages: readonly StageSummary[],
  upgradeInProgress: boolean,
): BuildingStatus {
  if (worldState.health.status === "disconnected") return "disconnected";
  if (worldState.health.status === "critical" || worldState.health.status === "degraded") {
    return "degraded";
  }
  if (buildingId === WAREHOUSE_ID && upgradeInProgress) return "upgrading";

  const stageHere = stages.find(
    (s) =>
      s.sourceBuildingId === buildingId &&
      (s.status === "running" ||
        s.status === "blocked" ||
        s.status === "validating" ||
        s.status === "revision_required" ||
        s.status === "failed" ||
        s.status === "ready"),
  );
  const transferHere = worldState.activeTransfers.find(
    (t) => t.sourceBuildingId === buildingId || t.destinationBuildingId === buildingId,
  );

  // FBL-029 / event-model.md `stage.validation_failed`: "Frontend: QA red."
  // An independent Inspector rejection is a *failure*, not an ordinary
  // block — and the two render differently (red vs orange). `status`
  // alone cannot distinguish them, because `BuildStageStatus` has no
  // value for "an Inspector rejected this", so a validation failure is
  // carried as `blocked`. Checking the decision first is what keeps a
  // rejection from being displayed as a mere obstruction. A stage that
  // later completes is no longer failing, so a completed stage is never
  // matched here (`stageHere` excludes `completed`).
  if (stageHere?.validationDecision === "failed") return "failed";

  if (stageHere?.status === "blocked") return "blocked";
  if (transferHere?.status === "blocked") return "blocked";
  if (stageHere?.status === "failed") return "failed";
  if (stageHere?.status === "running" || stageHere?.status === "validating") return "active";
  if (stageHere?.status === "revision_required") return "waiting";
  if (transferHere) return "active";
  if (stageHere?.status === "ready") return "waiting";

  // V1 has exactly one approval, always gating the QA → Deployment Dock
  // transfer immediately after qa_validation completes — so a pending
  // approval maps unambiguously to QA "waiting for human approval"
  // (world-model.md "QA building" prose).
  if (buildingId === QA_ID && worldState.approvals.some((a) => a.status === "pending")) {
    return "waiting";
  }

  return "idle";
}
