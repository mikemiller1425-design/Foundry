import type { ServerResponse } from "node:http";
import {
  COMMAND_CENTER_SNAPSHOT_VERSION,
  CommandCenterSnapshotSchema,
  EXTERNAL_ACTION_CLASSIFIER_VERSION,
  NO_RECEIVED_REVENUE_STATEMENT,
  UNCONFIGURED_DECISION_BATCH_POLICY,
  deriveNoExternalActionsStatement,
  hasNoReceivedRevenue,
  isEmptyInterval,
  type BriefingRecord,
  type CommandCenterSnapshot,
  type DecisionBatchPolicy,
  type OperationalMission,
} from "@foundry/contracts";
import {
  deriveCursor,
  deriveRecommendations,
  nextBriefingInterval,
  projectExternalActions,
  projectMission,
  projectMonetaryOutcome,
  projectSourceCoverage,
  type PersistenceService,
} from "@foundry/persistence";

/**
 * The Command Center read transport (Package 1b-ii-a).
 *
 * **Composition only.** Every field is produced by an accepted Package 1b-ii
 * projection; this module chooses inputs and assembles outputs, and computes
 * no domain fact of its own. That boundary is the point of the package: a
 * figure derived here would be truth invented by a transport, in a layer with
 * no authority to create it.
 *
 * **Strictly read-only.** Nothing here creates a briefing, acknowledges one,
 * advances a cursor, or appends an event. `PersistenceService` is used through
 * its read methods exclusively — a read that mutated would make the act of
 * looking change what is being looked at.
 */

/** Build ids worth projecting as missions: every build the log mentions. */
function buildIdsIn(persistence: PersistenceService): string[] {
  const ids = new Set<string>();
  for (const build of persistence.listEntities("builds")) {
    const id = (build as { id?: unknown }).id;
    if (typeof id === "string") ids.add(id);
  }
  return [...ids];
}

/**
 * Assembles the snapshot.
 *
 * The briefing shown is the most recently created one. `proposedNextInterval`
 * describes what a briefing created *now* would cover — deliberately labelled
 * as a proposal, because computing an interval and opening a briefing are
 * different acts and only the second one is a command.
 */
export function buildCommandCenterSnapshot(
  persistence: PersistenceService,
  observedAt: string,
): CommandCenterSnapshot {
  const sequenced = persistence.getSequencedEvents();
  const latestSequence = persistence.getLatestSequence();

  const briefings = persistence.listEntities("briefings") as unknown as BriefingRecord[];
  const cursor = deriveCursor(briefings);
  const latestBriefing =
    briefings.length === 0
      ? null
      : briefings.reduce((newest, candidate) =>
          candidate.createdAt >= newest.createdAt ? candidate : newest,
        );
  const proposedNextInterval = nextBriefingInterval(briefings, latestSequence);

  // The window the projections describe: the live briefing when one exists,
  // otherwise the interval a new briefing would open with.
  const window = latestBriefing?.interval ?? proposedNextInterval;

  const missions = buildIdsIn(persistence)
    .map((buildId) => projectMission(sequenced, buildId))
    .filter((mission): mission is OperationalMission => mission !== null);

  const externalActionProjection = projectExternalActions(
    sequenced,
    window.previousAcknowledgedSequence,
    window.capturedEndSequence,
  );
  const money = projectMonetaryOutcome(sequenced);
  const coverage = projectSourceCoverage(sequenced, window, observedAt);

  const policies = persistence.listEntities(
    "decisionBatchPolicies",
  ) as unknown as DecisionBatchPolicy[];
  // Absent configuration is the shipped state, not a missing value: the policy
  // ships disabled and unconfigured, with no invented time or timezone.
  const decisionBatchPolicy = policies[0] ?? UNCONFIGURED_DECISION_BATCH_POLICY;

  const noReceived = hasNoReceivedRevenue(money);

  return {
    snapshotVersion: COMMAND_CENTER_SNAPSHOT_VERSION,
    observedAt,
    latestSequence,
    externalActionClassifierVersion: EXTERNAL_ACTION_CLASSIFIER_VERSION,
    missions,
    briefing: {
      record: latestBriefing,
      cursor,
      proposedNextInterval,
      intervalIsEmpty: isEmptyInterval(window),
    },
    decisionBatchPolicy,
    externalActions: {
      projection: externalActionProjection,
      noQualifyingActionsStatement: deriveNoExternalActionsStatement(externalActionProjection),
    },
    money: {
      outcome: money,
      hasNoReceivedRevenue: noReceived,
      noReceivedRevenueStatement: noReceived ? NO_RECEIVED_REVENUE_STATEMENT : null,
    },
    coverage,
    recommendations: deriveRecommendations({
      missions,
      externalActions: externalActionProjection,
      money,
      coverage,
      generatedAt: observedAt,
    }),
  };
}

/**
 * `GET /command-center`.
 *
 * Validated against the published schema **before** it is sent. A response
 * that could not satisfy its own contract is a 500 here rather than a
 * malformed body a client has to discover: the endpoint exists to be the one
 * Command Center surface a consumer can trust the shape of.
 *
 * Unauthenticated, consistent with `world-state`, `entities`, `events`, and
 * the event stream (Decision 10.4). That ruling is explicitly provisional and
 * must be revisited before LAN or public exposure, multi-user operation,
 * tenant rentals, investor access, or any surface holding another tenant's
 * data.
 */
export function handleCommandCenterGet(
  persistence: PersistenceService,
  res: ServerResponse,
  now: () => string = () => new Date().toISOString(),
): void {
  const snapshot = buildCommandCenterSnapshot(persistence, now());
  const parsed = CommandCenterSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "snapshot_contract_violation",
        message:
          "The composed Command Center snapshot did not satisfy its published schema; no partial body is served.",
      }),
    );
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(parsed.data));
}
