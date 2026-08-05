import { z } from "zod";
import { TimestampSchema } from "../common";
import { BriefingIntervalSchema, BriefingRecordSchema } from "./briefing";
import { SourceCoverageSchema } from "./coverage";
import { DecisionBatchPolicySchema } from "./decisionBatch";
import { ExternalActionProjectionSchema } from "./externalAction";
import { OperationalMissionSchema } from "./mission";
import { MonetaryOutcomeSchema } from "./money";
import { RecommendationSchema } from "./recommendation";

/**
 * The Command Center read contract (Package 1b-ii-a).
 *
 * **This is the only Command Center contract a client may build on.** Raw
 * entity reads remain available as Level-3 evidence (Decision 10.3), but they
 * expose persistence's internal shape, which nothing promises to keep stable
 * and which no schema validates at the boundary. This aggregate is what is
 * promised.
 *
 * It **composes**; it does not derive. Every field below is produced by an
 * accepted Package 1b-ii projection, and the transport that fills it performs
 * no domain computation of its own. A field that would need new derivation is
 * new domain truth and belongs to a package that is authorized to create it.
 *
 * The schema lives in `@foundry/contracts` so a consumer can parse the
 * response without importing `@foundry/persistence` — the frontend depends on
 * contracts and event-types, and must not reach into the backend to read its
 * own data.
 */

/** Which vocabulary the caller may opt into on the event transports. */
export const COMMAND_CENTER_SNAPSHOT_VERSION = "command-center-v1";

/**
 * The briefing this snapshot describes.
 *
 * `interval` is echoed from the persisted record rather than recomputed, so a
 * snapshot cannot quietly widen the window a briefing covers. When no briefing
 * has been created yet, `record` is null and `proposedNextInterval` states what
 * a briefing created now would cover — a proposal, not a briefing.
 */
export const BriefingViewSchema = z.object({
  record: BriefingRecordSchema.nullable(),
  /** Derived from acknowledged briefings; 0 when none has been acknowledged. */
  cursor: z.number().int().nonnegative(),
  /** What a briefing created now would cover. Creating one is a command. */
  proposedNextInterval: BriefingIntervalSchema,
  /** True when the interval holds no events — valid and explicit, not a gap. */
  intervalIsEmpty: z.boolean(),
});
export type BriefingView = z.infer<typeof BriefingViewSchema>;

export const ExternalActionViewSchema = z.object({
  projection: ExternalActionProjectionSchema,
  /**
   * The derived negative, or null when actions exist. Never an event: a
   * synthesized absence would manufacture evidence for a non-occurrence.
   * Scoped to Foundry's own ledger, because Foundry cannot observe what it
   * does not instrument.
   */
  noQualifyingActionsStatement: z.string().nullable(),
});
export type ExternalActionView = z.infer<typeof ExternalActionViewSchema>;

export const MoneyViewSchema = z.object({
  outcome: MonetaryOutcomeSchema,
  /** True when no `received` record exists. Rendered honestly, never hidden. */
  hasNoReceivedRevenue: z.boolean(),
  /** Stated when nothing has been received, so the zero is legible. */
  noReceivedRevenueStatement: z.string().nullable(),
});
export type MoneyView = z.infer<typeof MoneyViewSchema>;

export const CommandCenterSnapshotSchema = z.object({
  /** Pinned so a client can refuse a shape it was not built for. */
  snapshotVersion: z.literal(COMMAND_CENTER_SNAPSHOT_VERSION),
  /** When this read was served. Display and diagnostics only. */
  observedAt: TimestampSchema,
  /** Highest assigned log sequence at read time. */
  latestSequence: z.number().int().nonnegative(),
  /** The classifier version behind `externalActions`. */
  externalActionClassifierVersion: z.number().int().positive(),

  /**
   * Missions currently projectable from the log.
   *
   * Empty is a truthful answer: it means no build events exist to project,
   * not that the projection failed.
   */
  missions: z.array(OperationalMissionSchema),
  briefing: BriefingViewSchema,
  decisionBatchPolicy: DecisionBatchPolicySchema,
  externalActions: ExternalActionViewSchema,
  money: MoneyViewSchema,
  coverage: z.array(SourceCoverageSchema),
  recommendations: z.array(RecommendationSchema),
});
export type CommandCenterSnapshot = z.infer<typeof CommandCenterSnapshotSchema>;
