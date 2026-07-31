import { IdSchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "Requirement"
export const RequirementStartedEvent = defineEvent("requirement.started", z.object({}));

// renamed from requirement.completed — resolves audit finding M-04
export const RequirementPassedEvent = defineEvent(
  "requirement.passed",
  z.object({ evidenceIds: z.array(IdSchema), validatorType: z.string().min(1) }),
);

export const RequirementFailedEvent = defineEvent(
  "requirement.failed",
  z.object({
    evidenceIds: z.array(IdSchema),
    message: z.string().min(1),
    retryEligible: z.boolean(),
  }),
);

export const RequirementRetriedEvent = defineEvent(
  "requirement.retried",
  z.object({ priorEventId: IdSchema }),
);

export const REQUIREMENT_EVENTS = [
  RequirementStartedEvent,
  RequirementPassedEvent,
  RequirementFailedEvent,
  RequirementRetriedEvent,
] as const;
