import { IdSchema, TimestampSchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "Stage"
export const StageCreatedEvent = defineEvent("stage.created", z.object({}));

// resolves audit finding M-03
export const StageReadyEvent = defineEvent("stage.ready", z.object({}));

export const StageStartedEvent = defineEvent(
  "stage.started",
  z.object({ assignedAgentIds: z.array(IdSchema), sourceBuildingId: IdSchema }),
);

export const StageBlockedEvent = defineEvent(
  "stage.blocked",
  z.object({
    requirementIds: z.array(IdSchema).optional(),
    approvalId: IdSchema.optional(),
    reason: z.string().min(1),
  }),
);

export const StageValidationStartedEvent = defineEvent("stage.validation_started", z.object({}));

export const StageValidationPassedEvent = defineEvent(
  "stage.validation_passed",
  z.object({ evidenceIds: z.array(IdSchema), passedRequirementIds: z.array(IdSchema) }),
);

export const StageValidationFailedEvent = defineEvent(
  "stage.validation_failed",
  z.object({
    failedRequirementIds: z.array(IdSchema),
    evidenceIds: z.array(IdSchema),
    retryEligible: z.boolean(),
  }),
);

export const StageCompletedEvent = defineEvent(
  "stage.completed",
  z.object({ artifactIds: z.array(IdSchema), completedAt: TimestampSchema }),
);

export const StageFailedEvent = defineEvent("stage.failed", z.object({}));

export const STAGE_EVENTS = [
  StageCreatedEvent,
  StageReadyEvent,
  StageStartedEvent,
  StageBlockedEvent,
  StageValidationStartedEvent,
  StageValidationPassedEvent,
  StageValidationFailedEvent,
  StageCompletedEvent,
  StageFailedEvent,
] as const;
