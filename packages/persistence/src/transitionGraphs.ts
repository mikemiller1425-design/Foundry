import type { EntityType } from "./reducer";

/**
 * Legal status transition graphs, one per entity type, keyed by current
 * status → the set of statuses a command may legally move it to. These
 * are transcribed from each entity's documented Lifecycle
 * (domain-model.md) and cross-checked against what `reducer.ts` actually
 * does for the corresponding event — the two must never disagree, since
 * this graph decides *whether* an event may be appended and the reducer
 * decides what happens when it is.
 *
 * A status with no entry, or an entry mapping to an empty array, is
 * terminal: no further transition is legal without an out-of-band
 * authorization (e.g. a `Revision` reopening a completed `BuildStage` —
 * handled as a named exception in `commandHandler.ts`, not in this graph).
 */
export type TransitionGraph = Record<string, readonly string[]>;

export const TRANSITION_GRAPHS: Partial<Record<EntityType, TransitionGraph>> = {
  agents: {
    idle: ["assigned", "offline"],
    assigned: ["traveling", "failed"],
    traveling: ["traveling", "working", "failed"],
    working: ["paused", "waiting", "failed"],
    paused: ["working", "failed"],
    waiting: ["idle", "failed"],
    offline: ["idle"],
    failed: [],
  },
  projects: {
    draft: ["active", "cancelled"],
    active: ["completed", "archived", "cancelled"],
    completed: ["archived"],
    archived: [],
    cancelled: [],
  },
  builds: {
    // `ready` is documented (event-model.md `build.ready`, resolves audit
    // finding M-03) but has no corresponding operator command in
    // domain-model.md's Build "Commands" row — it is backend-automatic
    // once prerequisites resolve, not command-driven in V1. `Build.Start`
    // therefore transitions directly from `planned`.
    // `planned` self-loop is `Build.Plan` (build.planned doesn't itself
    // change status per reducer.ts — legal only while still `planned`).
    planned: ["planned", "running", "cancelled", "failed"],
    // `waiting_for_approval` is reached by *derivation* from
    // `approval.requested` (AC-109, see reducer.ts), never by a command —
    // no command definition carries it as a `toStatus`. The edge is listed
    // anyway because this graph and the reducer must never disagree about
    // which states are reachable; omitting it would leave the graph
    // describing a build lifecycle the reducer does not actually produce.
    running: ["validating", "waiting_for_approval", "paused", "blocked", "failed", "cancelled"],
    paused: ["running", "cancelled"],
    blocked: ["running", "failed", "cancelled"],
    validating: ["waiting_for_approval", "revision_required", "failed"],
    waiting_for_approval: ["completed", "revision_required", "failed"],
    revision_required: ["running"],
    completed: [],
    failed: [],
    cancelled: [],
  },
  buildStages: {
    // Same `ready`-is-automatic reasoning as `builds` above. Most V1
    // stages complete directly from `running` (no validation step) —
    // only `qa_validation` legitimately passes through `validating`.
    planned: ["running", "cancelled"],
    running: ["validating", "completed", "blocked", "failed", "cancelled"],
    blocked: ["running", "revision_required", "failed"],
    validating: ["waiting_for_approval", "completed", "revision_required", "failed"],
    waiting_for_approval: ["completed", "revision_required", "failed"],
    revision_required: ["running"],
    // `completed` has no forward edge here — reopening requires an active
    // Revision, checked as a named exception (invariant 8), never a plain
    // transition-graph edge.
    completed: [],
    failed: ["running"],
    cancelled: [],
  },
  revisions: {
    requested: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  },
  requirements: {
    pending: ["running"],
    running: ["passed", "failed"],
    // A retry re-queues (→ `pending`); a fresh `Requirement.Start` is
    // needed to re-enter `running` — matches the canonical run's actual
    // failed → retried(pending) → started(running) → passed sequence.
    // Required cannot be waived in V1 (domain-model.md → Requirement
    // Invariants) — "waived" has no in-edge from any command in this graph.
    failed: ["pending"],
    passed: [],
    waived: [],
  },
  tasks: {
    queued: ["assigned", "cancelled"],
    assigned: ["running", "cancelled"],
    running: ["waiting", "paused", "completed", "failed", "cancelled"],
    waiting: ["running", "cancelled"],
    paused: ["running", "cancelled"],
    completed: [],
    failed: [],
    cancelled: [],
  },
  agentRuns: {
    queued: ["running"],
    running: ["completed", "failed", "timed_out"],
    completed: [],
    failed: [],
    timed_out: [],
  },
  artifacts: {
    // No V1 event ever sets an intermediate `validating` status (only
    // `artifact.created` → `artifact.validated` → `artifact.ready`), so
    // `validating` is a documented-but-unreachable-via-command state here,
    // same reasoning as `ready` above.
    draft: ["created"],
    created: ["validated"],
    validated: ["ready"],
    ready: ["in_transfer", "archived"],
    in_transfer: ["received"],
    received: ["archived"],
    archived: [],
  },
  transfers: {
    // `loading` is documented but no V1 event ever sets it — `transfer.started`
    // moves `ready` directly to `in_transit` (see `reducer.ts`).
    created: ["blocked", "ready", "cancelled"],
    blocked: ["ready", "cancelled"],
    ready: ["in_transit", "cancelled"],
    in_transit: ["unloading", "failed"],
    unloading: ["completed", "failed"],
    completed: [],
    failed: [],
    cancelled: [],
  },
  vehicles: {
    parked: ["waiting"],
    waiting: ["loading", "parked"],
    loading: ["in_transit", "failed"],
    in_transit: ["unloading", "failed"],
    unloading: ["completed", "failed"],
    completed: ["parked"],
    failed: ["parked"],
  },
  approvals: {
    pending: ["approved", "rejected", "revision_requested", "cancelled"],
    approved: [],
    rejected: [],
    revision_requested: [],
    cancelled: [],
    expired: [],
  },
  upgrades: {
    locked: ["eligible"],
    eligible: ["awaiting_approval"],
    // Self-loop is `Upgrade.Approve` (upgrade.approved doesn't itself
    // change status per reducer.ts).
    awaiting_approval: ["awaiting_approval", "upgrading", "eligible"],
    upgrading: ["completed", "failed"],
    completed: [],
    // A failed upgrade "retains prior capability" (domain-model.md
    // Invariants) — it may be re-attempted from eligible, not resumed.
    failed: ["eligible"],
  },
  buildings: {
    idle: ["active", "waiting", "blocked", "degraded", "failed", "disconnected", "upgrading"],
    active: ["idle", "waiting", "blocked", "degraded", "failed", "disconnected", "upgrading"],
    waiting: ["idle", "active", "blocked", "failed", "disconnected"],
    blocked: ["idle", "active", "failed", "disconnected"],
    degraded: ["idle", "active", "failed", "disconnected"],
    upgrading: ["active", "failed"],
    failed: ["idle", "disconnected"],
    disconnected: ["idle"],
  },
};

export function isLegalTransition(
  entityType: EntityType,
  fromStatus: string,
  toStatus: string,
): boolean {
  // Deliberately no blanket "fromStatus === toStatus is always legal"
  // shortcut: for a forward-moving command (e.g. `Agent.Assign` →
  // `assigned`), the current status already equaling the target status
  // means the entity is *already* there — resubmitting must be rejected
  // (this is exactly how command-level idempotency/F-09 falls out of this
  // graph, per commandHandler.ts). The handful of genuine no-op commands
  // (`Build.Plan`, `Upgrade.Approve`, `Agent.Arrive`) instead get an
  // explicit self-loop edge below, scoped to the one status it's legal from.
  const graph = TRANSITION_GRAPHS[entityType];
  if (!graph) return true;
  const allowed = graph[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}
