import type { WorldState } from "@foundry/contracts";

// FBL-014 — Lighthouse (docs/02-specification/world-model.md → "Lighthouse";
// docs/02-specification/event-model.md § "system.health_changed": "Lighthouse's
// additional active/attention_required states derive from build and approval
// events, not from system.health_changed"). Pure derivation from the same
// WorldState every 2D surface already reads — no invented or timer-generated
// state, and no dependency on rendering/animation.
export type LighthouseState =
  "healthy" | "active" | "attention_required" | "degraded" | "critical" | "disconnected";

/**
 * Deterministic precedence, most severe first: a genuine connectivity/health
 * problem always outranks a mere pending approval or an in-progress build —
 * the Lighthouse's job is global observation, so a hard health signal must
 * never be masked by routine operational activity. "attention_required" (an
 * unresolved Approval — the only point in V1 where an operator must act;
 * the intentional stage failure/retry is autonomous) outranks "active" (a
 * build merely running normally). "healthy" is the default rest state.
 */
export function computeLighthouseState(worldState: WorldState): LighthouseState {
  if (worldState.health.status === "disconnected") return "disconnected";
  if (worldState.health.status === "critical") return "critical";
  if (worldState.health.status === "degraded") return "degraded";
  if (worldState.approvals.some((approval) => approval.status === "pending")) {
    return "attention_required";
  }
  if (worldState.currentBuild?.status === "running") return "active";
  return "healthy";
}
