import { IdSchema, TimestampSchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "Build"
export const BuildCreatedEvent = defineEvent(
  "build.created",
  z.object({ projectId: IdSchema, buildId: IdSchema, objective: z.string().min(1) }),
);

export const BuildPlannedEvent = defineEvent(
  "build.planned",
  z.object({
    stageIds: z.array(IdSchema),
    requirementCount: z.number().int().nonnegative(),
    planArtifactId: IdSchema,
  }),
);

// resolves audit finding M-03
export const BuildReadyEvent = defineEvent("build.ready", z.object({}));

export const BuildStartedEvent = defineEvent("build.started", z.object({}));

export const BuildPausedEvent = defineEvent("build.paused", z.object({}));

// resolves audit finding M-03
export const BuildResumedEvent = defineEvent("build.resumed", z.object({}));

export const BuildCompletedEvent = defineEvent(
  "build.completed",
  z.object({ finalArtifactIds: z.array(IdSchema), completedAt: TimestampSchema }),
);

export const BuildFailedEvent = defineEvent(
  "build.failed",
  z.object({
    failureCode: z.string().min(1),
    evidenceIds: z.array(IdSchema),
    recoverable: z.boolean(),
  }),
);

export const BuildCancelledEvent = defineEvent("build.cancelled", z.object({}));

export const BUILD_EVENTS = [
  BuildCreatedEvent,
  BuildPlannedEvent,
  BuildReadyEvent,
  BuildStartedEvent,
  BuildPausedEvent,
  BuildResumedEvent,
  BuildCompletedEvent,
  BuildFailedEvent,
  BuildCancelledEvent,
] as const;
