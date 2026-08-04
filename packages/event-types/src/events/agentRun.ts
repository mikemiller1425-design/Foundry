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

/**
 * The budget summary a terminal AgentRun event carries (AC-111).
 *
 * **Optional, deliberately.** Every historical mock `agentrun.*` event —
 * including the frozen canonical run — carries no budget, and requiring
 * one would invalidate `v1-canonical-run.json`. A real run always supplies
 * it; a mock run never will, and the absence is meaningful rather than
 * missing data.
 *
 * `actualCostUsd` is nullable because "unknown" and "zero" are opposite
 * statements and only one of them is safe to record.
 */
const TerminalBudgetSummary = z.object({
  authorizedCeilingUsd: z.number().positive(),
  actualCostUsd: z.number().nonnegative().nullable(),
  withinCeiling: z.boolean().nullable(),
  evidenceId: IdSchema,
});

export const AgentRunCompletedEvent = defineEvent(
  "agentrun.completed",
  z.object({
    exitCode: z.number().int(),
    outputArtifactIds: z.array(IdSchema),
    evidenceIds: z.array(IdSchema),
    budget: TerminalBudgetSummary.optional(),
  }),
);

/**
 * Durable evidence for one run (AC-111).
 *
 * Emitted **before** the terminal event, so a completion can never cite an
 * evidence id no record exists for. The first real run did exactly that:
 * its `evidenceIds` pointed at an id present in only two places, both of
 * them the reference itself.
 *
 * The payload is the whole record. Evidence that lives only in process
 * memory is not evidence, and a log file beside the database would be a
 * second source of truth no replay reconstructs.
 */
export const AgentRunEvidenceRecordedEvent = defineEvent(
  "agentrun.evidence_recorded",
  z.object({
    evidenceId: IdSchema,
    agentRunId: IdSchema,
    /** The full `PersistedRunEvidence`. Typed as a passthrough object
     *  here for the same reason `build.planned.plan` is: `@foundry/event-types`
     *  depends on `@foundry/contracts`, and the shape is validated by
     *  `parseCommandParams` before the event is built. */
    evidence: z.record(z.string(), z.unknown()),
  }),
);

export const AgentRunFailedEvent = defineEvent(
  "agentrun.failed",
  z.object({
    failureCode: z.string().min(1),
    failureMessage: z.string().min(1),
    evidenceIds: z.array(IdSchema),
    budget: TerminalBudgetSummary.optional(),
  }),
);

export const AgentRunTimedOutEvent = defineEvent(
  "agentrun.timed_out",
  z.object({
    evidenceIds: z.array(IdSchema),
    logRef: z.string().min(1),
    budget: TerminalBudgetSummary.optional(),
  }),
);

export const AGENT_RUN_EVENTS = [
  AgentRunStartedEvent,
  AgentRunCompletedEvent,
  AgentRunFailedEvent,
  AgentRunTimedOutEvent,
  // AC-111: joined the runtime vocabulary at the rung that produces it.
  AgentRunEvidenceRecordedEvent,
] as const;
