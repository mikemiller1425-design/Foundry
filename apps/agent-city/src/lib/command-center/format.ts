import {
  COVERAGE_LABELS,
  isRecorded,
  receivedRevenue,
  sumStatus,
  type Attested,
  type CommandCenterSnapshot,
  type EvidenceRef,
  type OperationalMission,
  type SourceCoverage,
} from "@foundry/contracts";

/** Plain text for an attested figure — never invents a value. */
export function formatAttestedText<T>(
  value: Attested<T>,
  formatValue: (v: T) => string,
): string {
  if (isRecorded(value)) return formatValue(value.value);
  return `${value.state.replaceAll("_", " ")}: ${value.reason}`;
}

export function formatAttested(
  value: Attested<string | number>,
  formatValue: (v: string | number) => string = String,
): string {
  return formatAttestedText(value, formatValue);
}

export function formatAutonomy(mission: OperationalMission): string {
  if (mission.autonomy.state === "recorded") return mission.autonomy.level.replaceAll("_", " ");
  return `not recorded: ${mission.autonomy.reason}`;
}

export function formatUsd(amount: number, currency = "USD"): string {
  return `${currency} ${amount.toFixed(2)}`;
}

/**
 * The absence of a spend record is not a spend of zero.
 *
 * `sumStatus(outcome, "spent")` returns 0 both when records sum to nothing
 * and when no record exists at all, and rendering that 0 as "USD 0.00"
 * states a monetary fact the ledger does not hold — the same collapse the
 * `received` side already refuses via `hasNoReceivedRevenue`. It is visible
 * against the current operational data, where `byStatus.spent` is empty and
 * every mission reports `spendUsd: not_recorded`: the glance asserted
 * "USD 0.00" while the mission below it said the cost was never recorded.
 *
 * The emptiness of the supplied `byStatus.spent` array is read, not derived —
 * no new figure is computed here, and the backend contract is untouched.
 */
export const NO_SPEND_RECORDED_STATEMENT =
  "No spend record exists in Foundry's operational ledger for this interval — not a recorded zero.";

export function formatMoneyGlance(snapshot: CommandCenterSnapshot): {
  spent: string;
  received: string;
} {
  const spentRecords = snapshot.money.outcome.byStatus.spent;
  const spent = sumStatus(snapshot.money.outcome, "spent");
  const received = receivedRevenue(snapshot.money.outcome);
  return {
    spent:
      spentRecords.length === 0
        ? NO_SPEND_RECORDED_STATEMENT
        : formatUsd(spent, snapshot.money.outcome.currency),
    received: snapshot.money.hasNoReceivedRevenue
      ? (snapshot.money.noReceivedRevenueStatement ?? "No received revenue recorded")
      : formatUsd(received, snapshot.money.outcome.currency),
  };
}

export function formatCoverageLine(coverage: SourceCoverage): string {
  const connection = COVERAGE_LABELS[coverage.connection];
  const progress = COVERAGE_LABELS[coverage.progress];
  const uncertain = coverage.uncertainty.result_uncertain
    ? ` · ${COVERAGE_LABELS.result_uncertain}: ${coverage.uncertainty.uncertainty_reason}`
    : "";
  const exclusion =
    coverage.connection === "excluded" && coverage.exclusionReason
      ? ` · why: ${coverage.exclusionReason}`
      : "";
  // A recorded stop reason is what distinguishes "finished" from "stopped
  // early" — `isSourceCoverageComplete` treats it as disqualifying, so a
  // glance that omits it can render a cancelled scan as "Connected, Checked"
  // and read as complete coverage. Surfaced at level 1 rather than only in
  // the level-3 drawer, because the misreading happens at the glance.
  const stopped = coverage.stopReason ? ` · stopped: ${coverage.stopReason}` : "";
  return `${coverage.sourceLabel}: ${connection}, ${progress}${exclusion}${stopped}${uncertain}`;
}

export function collectMissionEvidence(mission: OperationalMission): EvidenceRef[] {
  const refs: EvidenceRef[] = [];
  const push = (list: EvidenceRef[]) => {
    for (const ref of list) refs.push(ref);
  };
  if (isRecorded(mission.objective)) push(mission.objective.evidence);
  if (isRecorded(mission.launchedAt)) push(mission.launchedAt.evidence);
  if (mission.autonomy.state === "recorded") push(mission.autonomy.evidence);
  if (isRecorded(mission.spendUsd)) push(mission.spendUsd.evidence);
  if (isRecorded(mission.loadout.authority)) push(mission.loadout.authority.evidence);
  if (isRecorded(mission.loadout.budget)) push(mission.loadout.budget.evidence);
  if (isRecorded(mission.loadout.constraints)) push(mission.loadout.constraints.evidence);
  for (const agent of mission.loadout.agents) {
    push(agent.evidence);
    if (isRecorded(agent.role)) push(agent.role.evidence);
  }
  for (const stage of mission.stages) push(stage.evidence);
  for (const blocker of mission.blockers) push(blocker.evidence);
  for (const decision of mission.decisions) {
    push(decision.evidence);
    if (isRecorded(decision.decidedBy)) push(decision.decidedBy.evidence);
  }
  for (const artifact of mission.artifacts) {
    push(artifact.evidence);
    if (isRecorded(artifact.kind)) push(artifact.kind.evidence);
  }
  push(mission.debriefEvidence);
  return refs;
}

export function uniqueEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  const out: EvidenceRef[] = [];
  for (const ref of refs) {
    const key = `${ref.eventId}:${ref.eventType}:${ref.sequence ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}
