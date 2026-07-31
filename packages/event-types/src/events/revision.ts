import { IdSchema, RevisionRequestedBySchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "Revision" (resolves audit finding B-03)
export const RevisionRequestedEvent = defineEvent(
  "revision.requested",
  z.object({
    revisionId: IdSchema,
    stageId: IdSchema,
    reason: z.string().min(1),
    requestedBy: RevisionRequestedBySchema,
    sourceApprovalId: IdSchema.optional(),
  }),
);

export const RevisionStartedEvent = defineEvent(
  "revision.started",
  z.object({ revisionId: IdSchema }),
);

export const RevisionCompletedEvent = defineEvent(
  "revision.completed",
  z.object({ revisionId: IdSchema, resultingStageStatus: z.string().min(1) }),
);

export const REVISION_EVENTS = [
  RevisionRequestedEvent,
  RevisionStartedEvent,
  RevisionCompletedEvent,
] as const;
