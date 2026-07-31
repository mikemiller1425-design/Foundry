import { z } from "zod";
import { AGENT_EVENTS } from "./agent";
import { AGENT_RUN_EVENTS } from "./agentRun";
import { APPROVAL_EVENTS } from "./approval";
import { ARTIFACT_EVENTS } from "./artifact";
import { BUILD_EVENTS } from "./build";
import { BUILDING_EVENTS } from "./building";
import { OPERATOR_EVENTS } from "./operator";
import { REQUIREMENT_EVENTS } from "./requirement";
import { REVISION_EVENTS } from "./revision";
import { STAGE_EVENTS } from "./stage";
import { SYSTEM_EVENTS } from "./system";
import { TRANSFER_EVENTS } from "./transfer";
import { UPGRADE_EVENTS } from "./upgrade";

export * from "./agent";
export * from "./agentRun";
export * from "./approval";
export * from "./artifact";
export * from "./build";
export * from "./building";
export * from "./operator";
export * from "./requirement";
export * from "./revision";
export * from "./stage";
export * from "./system";
export * from "./transfer";
export * from "./upgrade";

export const ALL_EVENT_SCHEMAS = [
  ...SYSTEM_EVENTS,
  ...OPERATOR_EVENTS,
  ...AGENT_EVENTS,
  ...AGENT_RUN_EVENTS,
  ...BUILD_EVENTS,
  ...STAGE_EVENTS,
  ...REVISION_EVENTS,
  ...REQUIREMENT_EVENTS,
  ...ARTIFACT_EVENTS,
  ...TRANSFER_EVENTS,
  ...APPROVAL_EVENTS,
  ...BUILDING_EVENTS,
  ...UPGRADE_EVENTS,
] as const;

// The complete, authoritative V1 event vocabulary
// (docs/02-specification/event-model.md), as one discriminated union keyed
// by `type`.
export const FoundryEventSchema = z.discriminatedUnion(
  "type",
  ALL_EVENT_SCHEMAS as unknown as [
    (typeof ALL_EVENT_SCHEMAS)[number],
    ...(typeof ALL_EVENT_SCHEMAS)[number][],
  ],
);
export type FoundryEvent = z.infer<typeof FoundryEventSchema>;

export const EVENT_TYPES = ALL_EVENT_SCHEMAS.map(
  (schema) => schema.shape.type.value,
) as FoundryEvent["type"][];
