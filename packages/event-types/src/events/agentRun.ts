import { IdSchema, RuntimeTypeSchema, V1RiskClassSchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "AgentRun" (resolves audit finding B-04)
export const AgentRunStartedEvent = defineEvent(
  "agentrun.started",
  z.object({
    agentId: IdSchema,
    taskId: IdSchema,
    runtimeType: RuntimeTypeSchema,
    riskClass: V1RiskClassSchema,
  }),
);

export const AgentRunCompletedEvent = defineEvent(
  "agentrun.completed",
  z.object({
    exitCode: z.number().int(),
    outputArtifactIds: z.array(IdSchema),
    evidenceIds: z.array(IdSchema),
  }),
);

export const AgentRunFailedEvent = defineEvent(
  "agentrun.failed",
  z.object({
    failureCode: z.string().min(1),
    failureMessage: z.string().min(1),
    evidenceIds: z.array(IdSchema),
  }),
);

export const AgentRunTimedOutEvent = defineEvent(
  "agentrun.timed_out",
  z.object({ evidenceIds: z.array(IdSchema), logRef: z.string().min(1) }),
);

export const AGENT_RUN_EVENTS = [
  AgentRunStartedEvent,
  AgentRunCompletedEvent,
  AgentRunFailedEvent,
  AgentRunTimedOutEvent,
] as const;
