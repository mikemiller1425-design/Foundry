import { z } from "zod";
import { IdSchema, TimestampSchema, V1RiskClassSchema } from "./common";
import { BuildStageNameSchema } from "./entities/buildStage";
import { SupportedObjectiveIdSchema } from "./supportedObjective";

/**
 * Durable evidence for one real controlled run (AC-111).
 *
 * ## Why this type exists
 *
 * The first real run succeeded, and almost nothing about it survived.
 * `agentrun.completed` carried three fields — `exitCode`,
 * `outputArtifactIds`, and `evidenceIds` — and that last one pointed at
 * an evidence id **no record existed for**. A read of the database found
 * the id in exactly two places: the completion event that cited it and the
 * `AgentRun` entity projected from that event. Zero records were keyed by
 * it. The authorized ceiling, the actual cost, the containment verdict,
 * the binary identity, the write-scope result, the independent-test
 * result, and the workspace disposition were all computed, printed to a
 * terminal, and then lost when the process exited.
 *
 * A reference to evidence that does not exist is worse than no reference:
 * it reads like an audit trail.
 *
 * ## What this is not
 *
 * Not a log file. Evidence is persisted through the declared architecture
 * — a command, one declared event, a reducer disposition, an entity
 * projection — so it replays deterministically, survives restart, and is
 * queryable like every other fact. An ad-hoc file next to the database
 * would be a second source of truth that no replay reconstructs.
 *
 * ## Cost is nullable, and that is the point
 *
 * `actualCostUsd` is `number | null`. `null` means **we do not know what
 * this run cost**, which is not the same statement as "it cost nothing"
 * and must never be recorded as `0`. A run whose cost could not be read
 * is a failed run, and this field is how that stays visible afterwards.
 */

export const BudgetOutcomeSchema = z
  .object({
    authorizedCeilingUsd: z.number().positive(),
    actualCostUsd: z.number().nonnegative(),
    withinCeiling: z.boolean(),
  })
  .strict();

export const BinaryIdentityRecordSchema = z
  .object({
    absolutePath: z.string().min(1),
    sha256: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    packageName: z.string().min(1).optional(),
    packageVersion: z.string().min(1).optional(),
    /** How the version was obtained. Never by executing the binary. */
    identitySource: z.enum(["package.json", "unavailable"]),
  })
  .strict();

export const WriteScopeRecordSchema = z
  .object({
    allowedWritePaths: z.array(z.string().min(1)),
    changedPaths: z.array(z.string().min(1)),
    unauthorizedPaths: z.array(z.string().min(1)),
    withinScope: z.boolean(),
  })
  .strict();

export const IndependentTestRecordSchema = z
  .object({
    testTarget: z.string().min(1),
    passed: z.boolean(),
    exitCode: z.number().int().nullable(),
    timedOut: z.boolean(),
  })
  .strict();

export const PersistedRunEvidenceSchema = z
  .object({
    evidenceId: IdSchema,
    agentRunId: IdSchema,

    // What was being executed, and under whose permission.
    buildId: IdSchema,
    planId: IdSchema,
    supportedObjectiveId: SupportedObjectiveIdSchema,
    authorizationId: IdSchema,
    stageName: BuildStageNameSchema,
    riskClass: V1RiskClassSchema,

    /** The operator's ceiling, from the persisted authorization. */
    authorizedCeilingUsd: z.number().positive(),
    /** What was actually handed to the runtime. Must equal the above. */
    ceilingPassedToRuntimeUsd: z.number().positive(),
    /** `null` means **unknown**, never zero. */
    actualCostUsd: z.number().nonnegative().nullable(),
    /** Absent when the cost could not be read at all. */
    budgetOutcome: BudgetOutcomeSchema.nullable(),
    /** Why the cost is unknown, when it is. */
    costUnknownReason: z.string().min(1).optional(),

    binaryIdentity: BinaryIdentityRecordSchema.nullable(),
    writeScope: WriteScopeRecordSchema.nullable(),
    independentTest: IndependentTestRecordSchema.nullable(),

    workspaceRoot: z.string().min(1).nullable(),
    workspaceDisposition: z.enum(["destroyed", "retained", "never_created"]),
    workspaceDestructionVerified: z.boolean(),

    outcome: z.string().min(1),
    exitCode: z.number().int().nullable(),
    verdict: z.string().min(1),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema,

    /**
     * Recorded as a fixed literal so no reader can mistake the policy's
     * `allowNetwork` flag for an enforced control. It is declared and
     * recorded; nothing in this boundary prevents network access.
     */
    networkEnforcement: z.literal("declared_and_recorded_not_enforced"),

    /** Whether captured output was truncated, and whether it was redacted. */
    stdoutTruncated: z.boolean(),
    stderrTruncated: z.boolean(),
    redactionApplied: z.boolean(),
  })
  .strict();
export type PersistedRunEvidence = z.infer<typeof PersistedRunEvidenceSchema>;

/**
 * The budget summary carried on a terminal `AgentRun` event.
 *
 * Small on purpose: the full record lives in `PersistedRunEvidence`, and
 * duplicating it onto the event would create two things to keep in step.
 * What belongs on the terminal event is the number a reader scanning the
 * event log most needs — what was authorized, and what it actually cost.
 */
export const TerminalBudgetSummarySchema = z
  .object({
    authorizedCeilingUsd: z.number().positive(),
    /** `null` means unknown. Never zero. */
    actualCostUsd: z.number().nonnegative().nullable(),
    withinCeiling: z.boolean().nullable(),
    /** The durable record this event's evidence id refers to. */
    evidenceId: IdSchema,
  })
  .strict();
export type TerminalBudgetSummary = z.infer<typeof TerminalBudgetSummarySchema>;
