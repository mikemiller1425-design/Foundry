import { HealthReasonSchema, HealthStatusSchema, IdSchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "System"
export const SystemStartedEvent = defineEvent(
  "system.started",
  z.object({
    serviceVersion: z.string().min(1),
    neighborhoodId: IdSchema,
  }),
);

export const SystemHealthChangedEvent = defineEvent(
  "system.health_changed",
  z.object({
    previousHealth: HealthStatusSchema,
    newHealth: HealthStatusSchema,
    reasons: z.array(HealthReasonSchema),
  }),
);

export const SYSTEM_EVENTS = [SystemStartedEvent, SystemHealthChangedEvent] as const;
