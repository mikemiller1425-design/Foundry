import {
  absent,
  recorded,
  type Attested,
  type EvidenceRef,
  type MissionArtifact,
  type MissionBlocker,
  type MissionDecision,
  type MissionOutcome,
  type MissionStageState,
  type MissionTypeDefinition,
  type OperationalMission,
} from "@foundry/contracts";
import type { SequencedEvent } from "../persistenceService";

/**
 * Mission type registry (Decision C-2).
 *
 * A mission type is introduced by **registering a definition**, and by
 * nothing else. There is no shared stage enum, no discriminated union of
 * known types, and no switch statement over them — so `nas_inventory` can
 * declare scan-specific stages at its own rung without amending anything
 * Package 1b-ii shipped. That is acceptance proof 1, and it is a property of
 * this design rather than a convention someone must remember.
 */
export class MissionTypeRegistry {
  private readonly byType = new Map<string, MissionTypeDefinition>();

  register(definition: MissionTypeDefinition): void {
    if (this.byType.has(definition.missionType)) {
      throw new Error(`mission type already registered: ${definition.missionType}`);
    }
    this.byType.set(definition.missionType, definition);
  }

  get(missionType: string): MissionTypeDefinition | undefined {
    return this.byType.get(missionType);
  }

  has(missionType: string): boolean {
    return this.byType.has(missionType);
  }

  list(): MissionTypeDefinition[] {
    return [...this.byType.values()];
  }
}

/**
 * The one mission type Package 1b-ii ships: the existing software build.
 *
 * Its stages are the orchestrated build stages that already exist in the
 * event log. Nothing historical is rewritten to fit them — the projection
 * reads events that were emitted years of rungs before this file, and maps
 * them onto stages declared here.
 */
export const SOFTWARE_BUILD_MISSION_TYPE: MissionTypeDefinition = {
  missionType: "software_build",
  label: "Software build",
  stages: [
    { key: "requirements", label: "Requirements", isCheckpoint: false },
    { key: "design", label: "Design", isCheckpoint: false },
    { key: "implementation", label: "Implementation", isCheckpoint: false },
    { key: "validation", label: "Validation", isCheckpoint: true },
    { key: "approval", label: "Operator approval", isCheckpoint: true },
    { key: "delivery", label: "Delivery", isCheckpoint: false },
  ],
};

export function createDefaultMissionTypeRegistry(): MissionTypeRegistry {
  const registry = new MissionTypeRegistry();
  registry.register(SOFTWARE_BUILD_MISSION_TYPE);
  return registry;
}

const BLOCKER_EVENT_TYPES = new Set([
  "agent.failed",
  "agentrun.failed",
  "agentrun.timed_out",
  "build.failed",
  "requirement.failed",
  "stage.blocked",
  "stage.failed",
  "stage.validation_failed",
  "transfer.blocked",
  "transfer.failed",
  "upgrade.failed",
]);

const DECISION_EVENT_KINDS: Record<string, MissionDecision["kind"]> = {
  "approval.approved": "approval",
  "approval.rejected": "rejection",
  "approval.revision_requested": "revision_requested",
  "operator.execution_authorized": "authorization",
};

function ref(entry: SequencedEvent): EvidenceRef {
  return { eventId: entry.event.id, eventType: entry.event.type, sequence: entry.sequence };
}

/**
 * Projects a build's event stream as one operational mission.
 *
 * **Nothing is rewritten and nothing is backfilled** (operator Amendment 2).
 * Where historical events carry no evidence for a facet — autonomy is the
 * clearest case, since no event ever recorded one — the projection returns a
 * stated absence rather than a plausible default. A mission that reports
 * `not_recorded` for autonomy is telling the truth about a run that predates
 * the concept; a mission that reported `supervise` would be inventing a
 * governance fact about work that is already finished.
 */
export function projectMission(
  sequenced: readonly SequencedEvent[],
  buildId: string,
  registry: MissionTypeRegistry = createDefaultMissionTypeRegistry(),
): OperationalMission | null {
  const definition = registry.get("software_build");
  if (!definition) return null;

  const relevant = sequenced.filter(
    (entry) =>
      entry.event.entityId === buildId ||
      entry.event.correlationId === buildId ||
      (entry.event.payload as Record<string, unknown>).buildId === buildId,
  );
  if (relevant.length === 0) return null;

  const sourceEventIds = relevant.map((entry) => entry.event.id);

  let objective: Attested<string> = absent(
    "not_recorded",
    "no objective event is associated with this build",
  );
  let launchedAt: Attested<string> = absent("not_recorded", "no build.started event was recorded");
  let authority: OperationalMission["loadout"]["authority"] = absent(
    "not_recorded",
    "no execution authorization was recorded for this mission",
  );
  let budget: OperationalMission["loadout"]["budget"] = absent(
    "not_recorded",
    "no authorized budget ceiling was recorded for this mission",
  );
  let spendUsd: Attested<number> = absent(
    "not_recorded",
    "no terminal run event recorded an actual cost",
  );
  let outcome: MissionOutcome = "in_progress";

  const agents = new Map<string, OperationalMission["loadout"]["agents"][number]>();
  const blockers: MissionBlocker[] = [];
  const decisions: MissionDecision[] = [];
  const artifacts: MissionArtifact[] = [];
  const debriefEvidence: EvidenceRef[] = [];
  const stageEvidence = new Map<string, EvidenceRef[]>();
  const stageStatus = new Map<string, MissionStageState["status"]>();

  for (const entry of relevant) {
    const { event } = entry;
    const payload = event.payload as Record<string, unknown>;
    const evidence = ref(entry);

    if (event.type === "operator.objective_submitted" && typeof payload.objective === "string") {
      objective = recorded(payload.objective, [evidence]);
    }
    if (event.type === "build.started") launchedAt = recorded(event.occurredAt, [evidence]);
    if (event.type === "build.completed") outcome = "succeeded";
    if (event.type === "build.failed") outcome = "failed";
    if (event.type === "build.cancelled") outcome = "cancelled";

    if (event.type === "operator.execution_authorized") {
      authority = recorded(
        { authorizationId: event.entityId, scope: String(payload.stageName ?? "execution") },
        [evidence],
      );
      if (typeof payload.maxBudgetUsd === "number") {
        budget = recorded(
          { authorizedCeilingUsd: payload.maxBudgetUsd, currency: "USD" as const },
          [evidence],
        );
      }
    }

    if (typeof payload.agentId === "string") {
      const existing = agents.get(payload.agentId);
      if (existing) existing.evidence.push(evidence);
      else
        agents.set(payload.agentId, {
          agentId: payload.agentId,
          role: absent("not_recorded", "no event recorded a role for this agent on this mission"),
          evidence: [evidence],
        });
    }

    if (BLOCKER_EVENT_TYPES.has(event.type)) {
      blockers.push({
        key: `${event.type}:${event.id}`,
        summary: String(payload.failureMessage ?? payload.reason ?? event.type),
        severity: event.severity === "info" ? "warning" : event.severity,
        occurredAt: event.occurredAt,
        evidence: [evidence],
      });
    }

    const decisionKind = DECISION_EVENT_KINDS[event.type];
    if (decisionKind) {
      const resolver = payload.resolvedBy ?? payload.authorizedBy;
      decisions.push({
        decisionId: event.id,
        kind: decisionKind,
        summary: String(payload.note ?? payload.reason ?? event.type),
        decidedAt: event.occurredAt,
        decidedBy:
          typeof resolver === "string"
            ? recorded(resolver, [evidence])
            : absent("not_recorded", "this event did not record who decided"),
        evidence: [evidence],
      });
    }

    if (event.type === "artifact.created" || event.type === "artifact.ready") {
      artifacts.push({
        artifactId: event.entityId,
        kind:
          typeof payload.kind === "string"
            ? recorded(payload.kind, [evidence])
            : absent("not_recorded", "this event did not record an artifact kind"),
        evidence: [evidence],
      });
    }

    if (event.type === "agentrun.evidence_recorded") debriefEvidence.push(evidence);

    if (
      event.type === "agentrun.completed" ||
      event.type === "agentrun.failed" ||
      event.type === "agentrun.timed_out"
    ) {
      const budgetSummary = payload.budget;
      if (budgetSummary && typeof budgetSummary === "object") {
        const actual = (budgetSummary as Record<string, unknown>).actualCostUsd;
        if (typeof actual === "number") spendUsd = recorded(actual, [evidence]);
      }
      debriefEvidence.push(evidence);
    }

    const stageName = typeof payload.stageName === "string" ? payload.stageName : null;
    if (stageName) {
      const key = stageName.toLowerCase();
      const list = stageEvidence.get(key) ?? [];
      list.push(evidence);
      stageEvidence.set(key, list);
      if (event.type === "stage.completed") stageStatus.set(key, "completed");
      else if (event.type === "stage.failed") stageStatus.set(key, "failed");
      else if (event.type === "stage.blocked") stageStatus.set(key, "blocked");
      else if (!stageStatus.has(key)) stageStatus.set(key, "in_progress");
    }
  }

  const stages: MissionStageState[] = definition.stages.map((stage) => ({
    key: stage.key,
    label: stage.label,
    isCheckpoint: stage.isCheckpoint,
    // A stage with no matching event is `not_recorded`, not `not_started`:
    // the projection cannot tell "never began" from "began before the log
    // recorded stage names", and guessing between them would be a claim.
    status: stageStatus.get(stage.key) ?? "not_recorded",
    evidence: stageEvidence.get(stage.key) ?? [],
  }));

  return {
    missionId: buildId,
    missionType: definition.missionType,
    missionTypeLabel: definition.label,
    objective,
    loadout: {
      agents: [...agents.values()],
      authority,
      budget,
      constraints: absent(
        "not_recorded",
        "historical build events carry no mission constraint list",
      ),
    },
    launchedAt,
    stages,
    blockers,
    decisions,
    outcome,
    debriefEvidence,
    /**
     * Autonomy is `not_recorded` for every projected historical mission, and
     * that is the correct answer rather than a gap to fill later: no event in
     * the log has ever carried an autonomy level, and inferring one from how
     * the run behaved would manufacture the governance fact the operator
     * asked us not to invent.
     */
    autonomy: {
      state: "not_recorded",
      reason:
        "no persisted event records an autonomy level for this mission; historical build events predate the concept",
    },
    spendUsd,
    artifacts,
    sourceEventIds,
  };
}
