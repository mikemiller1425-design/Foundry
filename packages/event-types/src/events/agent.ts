import { AgentRoleSchema, IdSchema, RuntimeTypeSchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "Agent"
export const AgentRegisteredEvent = defineEvent(
  "agent.registered",
  z.object({ role: AgentRoleSchema, homeBuildingId: IdSchema }),
);

export const AgentAssignedEvent = defineEvent(
  "agent.assigned",
  z.object({ taskId: IdSchema, stageId: IdSchema, destinationBuildingId: IdSchema }),
);

export const AgentDepartedEvent = defineEvent(
  "agent.departed",
  z.object({ sourceBuildingId: IdSchema, destinationBuildingId: IdSchema }),
);

export const AgentArrivedEvent = defineEvent(
  "agent.arrived",
  z.object({ destinationBuildingId: IdSchema }),
);

export const AgentStartedWorkEvent = defineEvent(
  "agent.started_work",
  z.object({ taskId: IdSchema, stageId: IdSchema, runtimeType: RuntimeTypeSchema }),
);

export const AgentPausedEvent = defineEvent(
  "agent.paused",
  z.object({ reason: z.string().optional() }),
);

export const AgentResumedEvent = defineEvent(
  "agent.resumed",
  z.object({ reason: z.string().optional() }),
);

export const AgentFailedEvent = defineEvent(
  "agent.failed",
  z.object({
    taskId: IdSchema,
    failureCode: z.string().min(1),
    message: z.string().min(1),
    evidenceIds: z.array(IdSchema),
    retryEligible: z.boolean(),
  }),
);

export const AgentCompletedWorkEvent = defineEvent(
  "agent.completed_work",
  z.object({ taskId: IdSchema, outputArtifactIds: z.array(IdSchema) }),
);

// resolves audit finding M-03
export const AgentReturnedHomeEvent = defineEvent(
  "agent.returned_home",
  z.object({ homeBuildingId: IdSchema }),
);

export const AGENT_EVENTS = [
  AgentRegisteredEvent,
  AgentAssignedEvent,
  AgentDepartedEvent,
  AgentArrivedEvent,
  AgentStartedWorkEvent,
  AgentPausedEvent,
  AgentResumedEvent,
  AgentFailedEvent,
  AgentCompletedWorkEvent,
  AgentReturnedHomeEvent,
] as const;
