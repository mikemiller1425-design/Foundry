import {
  DETERMINISTIC_RULE_VERSION,
  type ExternalActionProjection,
  type MonetaryOutcome,
  type OperationalMission,
  type Recommendation,
  type SourceCoverage,
} from "@foundry/contracts";

/**
 * Recommended priorities (Package 1b-ii scope item 8).
 *
 * Deterministic rules over projected truth. Given the same projections these
 * return the same recommendations, every time — which is what lets a reader
 * check a suggestion by re-deriving it rather than trusting it.
 *
 * **A model-generated prioritizer is not authorized in 1b-ii**, and would be
 * visible if it appeared: `ruleVersion` is carried on every recommendation,
 * so a change of producer cannot be silent.
 *
 * Nothing here can act. A `Recommendation` carries text and evidence; it has
 * no command, no handler, and no execution path, so "a recommendation cannot
 * launch a mission" is a property of the type rather than a rule someone
 * enforces at the call site.
 */

export interface RecommendationInputs {
  missions: readonly OperationalMission[];
  externalActions: ExternalActionProjection;
  money: MonetaryOutcome;
  coverage: readonly SourceCoverage[];
  generatedAt: string;
}

export function deriveRecommendations(inputs: RecommendationInputs): Recommendation[] {
  const out: Recommendation[] = [];

  for (const mission of inputs.missions) {
    for (const blocker of mission.blockers) {
      out.push({
        recommendationId: `blocker:${mission.missionId}:${blocker.key}`,
        reason: `Mission "${mission.missionTypeLabel}" recorded a blocker: ${blocker.summary}`,
        evidence: blocker.evidence,
        supportingEntities: [{ entityType: "Build", entityId: mission.missionId }],
        generatedAt: inputs.generatedAt,
        ruleVersion: DETERMINISTIC_RULE_VERSION,
        confidence: { kind: "deterministic" },
        suggestedNextAction: "Review the blocker's evidence and decide whether the mission continues.",
        wouldRequireOperatorApproval: false,
      });
    }
  }

  for (const action of inputs.externalActions.actions) {
    if (action.phase !== "failed") continue;
    out.push({
      recommendationId: `external-action-failed:${action.actionKey}`,
      reason: `An external action (${action.category}) failed in this interval.`,
      evidence: action.evidence,
      supportingEntities: [],
      generatedAt: inputs.generatedAt,
      ruleVersion: DETERMINISTIC_RULE_VERSION,
      confidence: { kind: "deterministic" },
      suggestedNextAction: "Inspect the run evidence before any retry is authorized.",
      // Retrying reaches outside Foundry again, so it is approval-gated —
      // stated here so the operator learns the cost before following the
      // suggestion, not after.
      wouldRequireOperatorApproval: true,
    });
  }

  for (const source of inputs.coverage) {
    if (source.connection !== "unavailable") continue;
    out.push({
      recommendationId: `source-unavailable:${source.sourceId}`,
      reason: `Source "${source.sourceLabel}" was unavailable for the declared interval, so this briefing does not cover it.`,
      evidence: [],
      supportingEntities: [],
      generatedAt: inputs.generatedAt,
      ruleVersion: DETERMINISTIC_RULE_VERSION,
      confidence: {
        kind: "uncertain",
        uncertaintyReason: "coverage for this source is unknown for the interval",
      },
      suggestedNextAction: "Restore the source, or record why it stays excluded.",
      wouldRequireOperatorApproval: false,
    });
  }

  return out;
}
