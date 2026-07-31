import type { WorldState } from "@foundry/contracts";
import type { StageSummary } from "@/lib/mock-runtime/selectors";

// docs/02-specification/world-model.md → "Cargo" → Allowed states:
// "Open/incomplete, blocked, validating, sealed/ready, in transit,
// received, rejected." Cargo is not a WorldState entity of its own (no
// standalone record — v1-scope.md's "One cargo representation" is a world
// object, not a domain entity in domain-model.md); it represents the
// current build's output moving through the neighborhood, derived
// entirely from the same `Build`/`Transfer`/`Approval` records and stage
// projection every 2D surface already reads. "Seal only when backend
// authorizes readiness" (world-model.md) is satisfied here by keying
// `sealed_ready` strictly to a real Transfer's `status === "ready"` — the
// reducer only ever sets that from a genuine `transfer.ready` event.
export type CargoState =
  | "open_incomplete"
  | "blocked"
  | "validating"
  | "sealed_ready"
  | "in_transit"
  | "received"
  | "rejected";

export function computeCargoState(
  worldState: WorldState,
  stages: readonly StageSummary[],
): CargoState {
  // Rejected on the build's approval outranks everything else — the
  // package cannot proceed past this point in V1 (no further scripted
  // path exists past a rejection; v1-scope.md's Required workflow
  // describes exactly one linear journey).
  if (worldState.approvals.some((a) => a.status === "rejected")) return "rejected";

  // A blocked stage (Required behavior 4/V-04: the intentional mandatory
  // requirement failure) always keeps cargo incomplete/blocked, for the
  // entire window between `stage.blocked` and that same stage's own
  // `stage.completed` (worldStateReducer.ts already derives this
  // precisely on `currentBuild.status`).
  if (worldState.currentBuild?.status === "blocked") return "blocked";

  // Exactly one active Transfer at a time (domain-model.md "Transfer" V1
  // limits) — its own real status is the single most authoritative signal
  // once the package has left the workplace.
  const activeTransfer = worldState.activeTransfers[0];
  if (activeTransfer) {
    if (activeTransfer.status === "blocked") return "blocked";
    if (activeTransfer.status === "ready") return "sealed_ready";
    if (
      activeTransfer.status === "loading" ||
      activeTransfer.status === "in_transit" ||
      activeTransfer.status === "unloading"
    ) {
      return "in_transit";
    }
    // "created": transfer exists but not yet ready — still open/incomplete.
  }

  if (worldState.currentBuild?.status === "completed") return "received";

  if (stages.some((s) => s.status === "validating")) return "validating";

  return "open_incomplete";
}

export const ALL_CARGO_STATES: readonly CargoState[] = [
  "open_incomplete",
  "blocked",
  "validating",
  "sealed_ready",
  "in_transit",
  "received",
  "rejected",
];
