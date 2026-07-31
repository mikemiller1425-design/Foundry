import { IdSchema } from "@foundry/contracts";
import { z } from "zod";
import { DemoCommandSchema, DemoCommandTypeSchema } from "../commands";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "Operator"
export const OperatorObjectiveSubmittedEvent = defineEvent(
  "operator.objective_submitted",
  z.object({
    objective: z.string().min(1),
    projectId: IdSchema.optional(),
  }),
);

export const OperatorCommandSubmittedEvent = defineEvent(
  "operator.command_submitted",
  DemoCommandSchema,
);

export const OperatorCommandAcceptedEvent = defineEvent(
  "operator.command_accepted",
  z.object({
    commandType: DemoCommandTypeSchema,
    params: z.unknown(),
    resultRef: z.string().optional(),
  }),
);

export const OperatorCommandRejectedEvent = defineEvent(
  "operator.command_rejected",
  z.object({
    commandType: DemoCommandTypeSchema,
    reason: z.string().min(1),
    correctiveAction: z.string().optional(),
  }),
);

export const OPERATOR_EVENTS = [
  OperatorObjectiveSubmittedEvent,
  OperatorCommandSubmittedEvent,
  OperatorCommandAcceptedEvent,
  OperatorCommandRejectedEvent,
] as const;
