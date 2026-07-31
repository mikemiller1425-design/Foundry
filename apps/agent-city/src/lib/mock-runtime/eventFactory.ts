import type { ActorType, FoundryEvent, Severity } from "@foundry/event-types";
import { FoundryEventSchema } from "@foundry/event-types";
import { createClock, createIdGenerator } from "./ids";

export interface RawEventInput {
  type: FoundryEvent["type"];
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  actorType: ActorType;
  actorId: string;
  severity?: Severity;
  causationId?: string;
}

/**
 * Builds a fully-formed, schema-validated event. Validating at construction
 * time (rather than only in tests) means an authoring mistake fails
 * immediately, not silently.
 *
 * `idKind` namespaces the generated event ids (default "evt"). Two
 * independent factories sharing the same `seed` — e.g. the canonical script
 * and a later alternate-path action builder (approvalActions.ts) reacting
 * to it — MUST use different `idKind` values, or their independently
 * counting id sequences will collide and one event will be silently
 * dropped as a false "duplicate" by the idempotent reducer.
 */
export function createEventFactory(seed: string, correlationId: string, idKind = "evt") {
  const nextId = createIdGenerator(seed);
  const nextTimestamp = createClock();

  return function event(input: RawEventInput): FoundryEvent {
    const candidate = {
      id: nextId(idKind),
      type: input.type,
      occurredAt: nextTimestamp(),
      actorType: input.actorType,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      correlationId,
      causationId: input.causationId,
      severity: input.severity ?? "info",
      schemaVersion: 1,
      payload: input.payload,
    };
    return FoundryEventSchema.parse(candidate);
  };
}
