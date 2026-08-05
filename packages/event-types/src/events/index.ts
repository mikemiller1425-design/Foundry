import { z } from "zod";
import { AGENT_EVENTS } from "./agent";
import { AGENT_RUN_EVENTS } from "./agentRun";
import { APPROVAL_EVENTS } from "./approval";
import { ARTIFACT_EVENTS } from "./artifact";
import { BUILD_EVENTS } from "./build";
import { BUILDING_EVENTS } from "./building";
import { COMMAND_CENTER_EVENTS } from "./commandCenter";
import { OPERATOR_EVENTS } from "./operator";
import { REQUIREMENT_EVENTS } from "./requirement";
import { REVISION_EVENTS } from "./revision";
import { STAGE_EVENTS } from "./stage";
import { SYSTEM_EVENTS } from "./system";
import { TRANSFER_EVENTS } from "./transfer";
import { UPGRADE_EVENTS } from "./upgrade";

export * from "./agent";
export * from "./agentRun";
export * from "./approval";
export * from "./artifact";
export * from "./build";
export * from "./building";
export * from "./commandCenter";
export * from "./operator";
export * from "./requirement";
export * from "./revision";
export * from "./stage";
export * from "./system";
export * from "./transfer";
export * from "./upgrade";

/**
 * The authoritative **V1** event vocabulary, frozen.
 *
 * Package 1b-ii deliberately does not join this list. `EVENT_TYPES` is
 * asserted against a completeness invariant in the reconciled frontend
 * (`eventProjectionMap.test.ts` — exactly one projection entry per V1 type),
 * and Package 1b-ii is a backend package that may not touch the frontend.
 * Widening V1 would have forced a frontend edit to satisfy a backend change,
 * which is the coupling the layer separation exists to prevent.
 */
export const V1_EVENT_SCHEMAS = [
  ...SYSTEM_EVENTS,
  ...OPERATOR_EVENTS,
  ...AGENT_EVENTS,
  ...AGENT_RUN_EVENTS,
  ...BUILD_EVENTS,
  ...STAGE_EVENTS,
  ...REVISION_EVENTS,
  ...REQUIREMENT_EVENTS,
  ...ARTIFACT_EVENTS,
  ...TRANSFER_EVENTS,
  ...APPROVAL_EVENTS,
  ...BUILDING_EVENTS,
  ...UPGRADE_EVENTS,
] as const;

/**
 * Every schema the runtime accepts: V1 plus each later package's own events.
 *
 * `FoundryEventSchema` is built from this, so a Package 1b-ii event persists,
 * replays, and validates exactly like a V1 event — it simply is not part of
 * the V1 vocabulary the frontend projection map is pinned to.
 */
export const ALL_EVENT_SCHEMAS = [
  ...V1_EVENT_SCHEMAS,
  // Package 1b-ii: joined with their real emitters (Amendment 3).
  ...COMMAND_CENTER_EVENTS,
] as const;

// The complete, authoritative V1 event vocabulary
// (docs/02-specification/event-model.md), as one discriminated union keyed
// by `type`.
/**
 * The **V1** event union — the vocabulary the reconciled frontend is built
 * against, and the one it validates its stream with.
 *
 * Deliberately narrower than what the backend persists. `FoundryEvent["type"]`
 * keys an exhaustive projection map in the frontend, so widening this type
 * would force a frontend edit for every backend event any later package adds.
 * Package 1b-ii is a backend package and may not touch the frontend, so the
 * split is structural rather than a convention.
 */
export const FoundryEventSchema = z.discriminatedUnion(
  "type",
  V1_EVENT_SCHEMAS as unknown as [
    (typeof V1_EVENT_SCHEMAS)[number],
    ...(typeof V1_EVENT_SCHEMAS)[number][],
  ],
);
export type FoundryEvent = z.infer<typeof FoundryEventSchema>;

/**
 * Everything the backend persists: V1 plus each later package's own events.
 *
 * The persistence layer, the reducer, and the command handler speak this
 * type. What leaves the backend toward the V1 frontend is filtered back down
 * to `FoundryEventSchema` — see `apps/api/src/eventStream.ts`. Package 1b-iii
 * widens the frontend and that filter together, as one change.
 */
export const PersistedEventSchema = z.discriminatedUnion(
  "type",
  ALL_EVENT_SCHEMAS as unknown as [
    (typeof ALL_EVENT_SCHEMAS)[number],
    ...(typeof ALL_EVENT_SCHEMAS)[number][],
  ],
);
export type PersistedEvent = z.infer<typeof PersistedEventSchema>;

/** True when a persisted event belongs to the V1 vocabulary the frontend knows. */
export function isV1Event(event: PersistedEvent): event is FoundryEvent {
  return FoundryEventSchema.safeParse(event).success;
}

/** The frozen V1 vocabulary. Later packages add to `ALL_EVENT_TYPES`. */
export const EVENT_TYPES = V1_EVENT_SCHEMAS.map(
  (schema) => schema.shape.type.value,
) as FoundryEvent["type"][];

/** Every type the runtime accepts, V1 and later packages alike. */
export const ALL_EVENT_TYPES = ALL_EVENT_SCHEMAS.map(
  (schema) => schema.shape.type.value,
) as PersistedEvent["type"][];

/** The types Package 1b-ii added, each with a real emitter. */
export const COMMAND_CENTER_EVENT_TYPES = COMMAND_CENTER_EVENTS.map(
  (schema) => schema.shape.type.value,
) as PersistedEvent["type"][];
