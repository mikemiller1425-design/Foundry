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
    /**
     * The structured plan itself (V1.1 amendment, AC-108).
     *
     * **Optional, deliberately.** The frozen V1 canonical run emits
     * `build.planned` without it, and `v1-canonical-run.json` must stay
     * byte-identical — so requiring it would invalidate the regression
     * baseline. The backend path always supplies it; historical events
     * never will.
     *
     * Typed as a passthrough object here rather than importing
     * `BuildPlanSchema`: `@foundry/event-types` depends on
     * `@foundry/contracts`, and the full plan shape is validated by
     * `parseCommandParams` before the event is ever built.
     */
    plan: z.record(z.string(), z.unknown()).optional(),
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
