import type { FoundryEvent } from "@foundry/event-types";
import { WORLD_AGENTS } from "@foundry/world-model";
import type { Selection } from "@/components/controls/selection";
import { SELECTABLE_WORLD_OBJECTS } from "./selectableObjects";

/**
 * FBL-021A — resolves a timeline event to the world object an operator
 * should be taken to, for the "jump to world object" capability
 * (`interface-model.md` § "Bottom event timeline").
 *
 * **Resolution is by declared identifier only.** Every rule below reads an
 * id the event contract itself carries — `entityId` where the entity *is*
 * a world object, or a named `IdSchema` payload field where the contract
 * declares the relationship. Nothing here matches on display names,
 * substrings, or entity-type spelling, because a jump that guesses is
 * worse than a jump that is unavailable: it takes the operator somewhere
 * confidently wrong.
 *
 * Where no declared relationship exists, or where more than one target
 * could plausibly be meant, the control stays **disabled with a stated
 * reason** rather than picking one. That is the explicit requirement:
 * never jump to a fabricated or unrelated object.
 *
 * This is navigation state only. Resolving a target reads events; it never
 * writes one, and never mutates operational truth.
 */

export interface ResolvedWorldTarget {
  /** Id of a world object that actually exists in the scene. */
  id: string;
  label: string;
  /** Reuses the shell's own Selection kinds, so a jump feeds the identical selection funnel. */
  kind: Selection["kind"];
}

export type WorldTargetResolution =
  | { resolved: true; target: ResolvedWorldTarget }
  | { resolved: false; reason: string };

/** Reasons are operator-facing: they explain *why*, not that a rung is unfinished. */
const NO_DECLARED_TARGET =
  "This event has no world object — it records project-level progress, not something the neighborhood shows.";
const NO_DECLARED_RELATIONSHIP =
  "This event does not name a world object, so there is nothing unambiguous to jump to.";
const TARGET_NOT_IN_WORLD =
  "The object this event names is not part of the V1 neighborhood, so it cannot be shown.";

function payloadId(event: FoundryEvent, field: string): string | null {
  const payload = event.payload as Record<string, unknown> | undefined;
  const value = payload?.[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Looks an id up among the objects the world actually renders. */
function findWorldObject(id: string | null): ResolvedWorldTarget | null {
  if (!id) return null;
  const selectable = SELECTABLE_WORLD_OBJECTS.find((o) => o.id === id);
  if (selectable) {
    return { id: selectable.id, label: selectable.label, kind: selectable.kind };
  }
  const agent = WORLD_AGENTS.find((a) => a.id === id);
  if (agent) return { id: agent.id, label: agent.name, kind: "agent" };
  return null;
}

/**
 * The declared relationship table.
 *
 * Each entry names the single field the event contract guarantees, so the
 * mapping is auditable against `packages/event-types` rather than inferred.
 * `null` means "this event type declares no world target" — an explicit
 * decision, not an oversight.
 */
function declaredTargetId(event: FoundryEvent): string | null {
  const type = event.type;

  // Agent lifecycle: the entity *is* the agent (entityType "Agent",
  // entityId is the agent id from WORLD_AGENTS).
  if (type.startsWith("agent.")) return event.entityId;

  // Building events declare their subject explicitly.
  if (type === "building.selected" || type === "building.state_changed") {
    return payloadId(event, "buildingId");
  }

  // stage.started is the only stage event that names where the work happens.
  if (type === "stage.started") return payloadId(event, "sourceBuildingId");

  // transfer.started is the only transfer event that names the vehicle, and
  // the vehicle is the object the declared 3D mapping actually moves.
  // transfer.completed carries only a receipt artifact id; transfer.arrived
  // carries nothing — neither names a world object, so neither resolves.
  if (type === "transfer.started") return payloadId(event, "vehicleId");

  // upgrade.eligible is the only upgrade event whose contract carries
  // buildingId. The rest (requested/approved/started/completed/failed)
  // declare no building, so they stay unavailable rather than assuming the
  // Warehouse.
  if (type === "upgrade.eligible") return payloadId(event, "buildingId");

  // approval.requested → Lighthouse is an explicitly declared mapping:
  // EVENT_PROJECTION_MAP records "Lighthouse shows 'attention_required'".
  // Only the *requested* event declares it; resolutions clear the
  // attention state rather than signalling it.
  if (type === "approval.requested") return "lighthouse";

  return null;
}

export function resolveWorldTargetForEvent(event: FoundryEvent): WorldTargetResolution {
  const id = declaredTargetId(event);
  if (!id) {
    // Distinguish "this kind of event never has a world object" from
    // "this instance didn't carry the field", so the explanation is honest.
    const couldHaveDeclared =
      event.type.startsWith("transfer.") ||
      event.type.startsWith("upgrade.") ||
      event.type.startsWith("stage.") ||
      event.type.startsWith("approval.");
    return { resolved: false, reason: couldHaveDeclared ? NO_DECLARED_RELATIONSHIP : NO_DECLARED_TARGET };
  }

  const target = findWorldObject(id);
  if (!target) return { resolved: false, reason: TARGET_NOT_IN_WORLD };
  return { resolved: true, target };
}
