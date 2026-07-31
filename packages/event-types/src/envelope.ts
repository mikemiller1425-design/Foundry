import { IdSchema, TimestampSchema } from "@foundry/contracts";
import { z } from "zod";

// docs/02-specification/event-model.md → "Envelope"
export const ActorTypeSchema = z.enum([
  "operator",
  "agent",
  "backend",
  "runtime_adapter",
  "frontend",
]);
export type ActorType = z.infer<typeof ActorTypeSchema>;

export const SeveritySchema = z.enum(["info", "notice", "warning", "error", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

// Base envelope fields shared by every event, before the per-event `type`
// literal and `payload` shape narrow it (see events/*.ts).
export const EventEnvelopeBaseSchema = z.object({
  id: IdSchema,
  occurredAt: TimestampSchema,
  actorType: ActorTypeSchema,
  actorId: IdSchema,
  entityType: z.string().min(1),
  entityId: IdSchema,
  correlationId: IdSchema,
  causationId: IdSchema.optional(),
  severity: SeveritySchema,
  schemaVersion: z.number().int().positive(),
});
export type EventEnvelopeBase = z.infer<typeof EventEnvelopeBaseSchema>;

/** Builds a concrete event schema: envelope fields + a literal `type` + a specific `payload`. */
export function defineEvent<Type extends string, Payload extends z.ZodType>(
  type: Type,
  payload: Payload,
) {
  return EventEnvelopeBaseSchema.extend({
    type: z.literal(type),
    payload,
  });
}
