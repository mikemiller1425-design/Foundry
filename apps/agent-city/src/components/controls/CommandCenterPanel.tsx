"use client";

import {
  COVERAGE_LABELS,
  type CommandCenterSnapshot,
  type OperationalMission,
} from "@foundry/contracts";
import { useRuntime } from "@/lib/mock-runtime";
import {
  collectMissionEvidence,
  formatAttested,
  formatAttestedText,
  formatAutonomy,
  formatCoverageLine,
  formatMoneyGlance,
  formatUsd,
  uniqueEvidence,
} from "@/lib/command-center/format";
import {
  commandCenterStatusLabel,
  type CommandCenterStatus,
} from "@/lib/command-center/status";
import { useId, useState } from "react";

/**
 * Package 1b-iii progressive Command Center surface.
 *
 * Level 1 world glance → Level 2 tactical mission → Level 3 evidence.
 * Ordinary decisions must be possible without opening Level 3. Every figure
 * is backend-supplied; absence states are rendered with their reasons.
 */
export function CommandCenterPanel({
  defaultEvidenceOpen = false,
}: {
  defaultEvidenceOpen?: boolean;
} = {}) {
  const { commandCenter, commandCenterStatus, runtimeMode } = useRuntime();
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(defaultEvidenceOpen);
  const titleId = useId();

  const status: CommandCenterStatus = commandCenterStatus ?? "unavailable";
  const selected =
    commandCenter?.missions.find((mission) => mission.missionId === selectedMissionId) ??
    commandCenter?.missions[0] ??
    null;

  return (
    <section
      className="foundry-detail rounded-xl p-3"
      aria-labelledby={titleId}
      data-testid="command-center-panel"
      data-status={status}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="foundry-eyebrow">Command Center</p>
          <h3 id={titleId} className="mt-1 text-xs font-medium text-neutral-200">
            World glance
          </h3>
        </div>
        <span
          className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] uppercase tracking-[0.08em] text-neutral-400"
          data-testid="command-center-status"
        >
          {commandCenterStatusLabel(status)}
          {runtimeMode === "mock" ? " · mock" : ""}
        </span>
      </div>

      <CommandCenterStatusBody status={status} />

      {status === "current" || status === "stale" ? (
        commandCenter ? (
          <>
            <WorldGlance
              snapshot={commandCenter}
              selectedMissionId={selected?.missionId ?? null}
              onSelectMission={(id) => {
                setSelectedMissionId(id);
                setEvidenceOpen(false);
              }}
            />
            {selected ? (
              <TacticalMission
                mission={selected}
                evidenceOpen={evidenceOpen}
                onToggleEvidence={() => setEvidenceOpen((open) => !open)}
                classifierVersion={commandCenter.externalActionClassifierVersion}
                snapshot={commandCenter}
              />
            ) : (
              <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">
                No missions are currently projectable from the event log.
              </p>
            )}
          </>
        ) : null
      ) : null}
    </section>
  );
}

function CommandCenterStatusBody({ status }: { status: CommandCenterStatus }) {
  if (status === "current" || status === "stale") {
    return status === "stale" ? (
      <p className="mt-2 text-[10px] text-amber-200/90" role="status">
        Snapshot is catching up to a newer event. Figures below are the last validated
        aggregate, not a guessed update.
      </p>
    ) : null;
  }

  const messages: Record<"disconnected" | "loading" | "invalid_contract" | "unavailable", string> =
    {
      disconnected:
        "Command Center is disconnected from the backend. No operational figures are shown.",
      loading: "Loading the Command Center aggregate from the backend…",
      invalid_contract:
        "The backend returned a body that failed the Command Center contract. Nothing is rendered as operational truth.",
      unavailable:
        "Command Center is unavailable. Mock playback has no Command Center transport, and a failed read is never shown as an empty success.",
    };

  return (
    <p className="mt-2 text-[10px] leading-relaxed text-neutral-400" role="status">
      {messages[status]}
    </p>
  );
}

function WorldGlance({
  snapshot,
  selectedMissionId,
  onSelectMission,
}: {
  snapshot: CommandCenterSnapshot;
  selectedMissionId: string | null;
  onSelectMission: (id: string) => void;
}) {
  const money = formatMoneyGlance(snapshot);
  const attention = snapshot.missions.flatMap((mission) =>
    mission.blockers.map((blocker) => `${mission.missionTypeLabel}: ${blocker.summary}`),
  );
  for (const decision of snapshot.missions.flatMap((mission) => mission.decisions)) {
    attention.push(decision.summary);
  }

  const briefing = snapshot.briefing;
  const briefingText = briefing.record
    ? `Sequences (${briefing.record.interval.previousAcknowledgedSequence}, ${briefing.record.interval.capturedEndSequence}] · cursor ${briefing.cursor}${
        briefing.intervalIsEmpty ? " · interval empty" : ""
      }`
    : `No briefing yet · proposed (${briefing.proposedNextInterval.previousAcknowledgedSequence}, ${briefing.proposedNextInterval.capturedEndSequence}] · cursor ${briefing.cursor}`;

  return (
    <div className="mt-3 space-y-3" data-testid="command-center-glance">
      <GlanceBlock label="Briefing interval" value={briefingText} />
      <GlanceBlock
        label="Attention"
        value={
          attention.length > 0
            ? attention.slice(0, 4).join(" · ")
            : "No decisions or blockers need attention in this snapshot."
        }
      />
      <div>
        <p className="text-[9px] uppercase tracking-[0.08em] text-neutral-600">Active missions</p>
        {snapshot.missions.length === 0 ? (
          <p className="mt-1 text-[10px] text-neutral-500">None projectable.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {snapshot.missions.map((mission) => {
              const active = mission.missionId === selectedMissionId;
              return (
                <li key={mission.missionId}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    aria-label={`Open tactical mission ${mission.missionTypeLabel}`}
                    onClick={() => onSelectMission(mission.missionId)}
                    className="foundry-nav-row w-full rounded-lg border border-transparent px-2 py-1.5 text-left aria-[current=true]:border-sky-300/30 aria-[current=true]:bg-sky-300/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                  >
                    <span className="block text-[10px] text-neutral-200">
                      {mission.missionTypeLabel}
                      <span className="ml-2 text-neutral-500">· {mission.outcome}</span>
                    </span>
                    <span className="mt-0.5 block text-[9px] text-neutral-500">
                      {formatAttested(mission.objective)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <GlanceBlock
        label="External actions"
        value={
          snapshot.externalActions.noQualifyingActionsStatement ??
          `${snapshot.externalActions.projection.actions.length} qualifying · classifier v${snapshot.externalActionClassifierVersion}`
        }
      />
      <GlanceBlock label="Money spent" value={money.spent} />
      <GlanceBlock label="Money received" value={money.received} />
      <div>
        <p className="text-[9px] uppercase tracking-[0.08em] text-neutral-600">
          Source coverage
        </p>
        {snapshot.coverage.length === 0 ? (
          <p className="mt-1 text-[10px] text-neutral-500">No named sources in this snapshot.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-[10px] text-neutral-300">
            {snapshot.coverage.map((row) => (
              <li key={row.sourceId}>{formatCoverageLine(row)}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-[0.08em] text-neutral-600">
          Recommended priorities
        </p>
        {snapshot.recommendations.length === 0 ? (
          <p className="mt-1 text-[10px] text-neutral-500">None in this snapshot.</p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {snapshot.recommendations.map((rec) => (
              <li key={rec.recommendationId} className="rounded-lg border border-white/8 p-2">
                <p className="text-[10px] text-neutral-200">{rec.reason}</p>
                <p className="mt-1 text-[9px] text-neutral-500">
                  {rec.suggestedNextAction}
                  {rec.wouldRequireOperatorApproval ? " · requires approval" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {snapshot.decisionBatchPolicy.schedule.kind === "unconfigured" ? (
        <GlanceBlock
          label="Decision batch"
          value="Unconfigured — no scheduled batch is active."
        />
      ) : (
        <GlanceBlock
          label="Decision batch"
          value={`Enabled: ${snapshot.decisionBatchPolicy.enabled ? "yes" : "no"}`}
        />
      )}
    </div>
  );
}

function GlanceBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.08em] text-neutral-600">{label}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-neutral-300">{value}</p>
    </div>
  );
}

function TacticalMission({
  mission,
  evidenceOpen,
  onToggleEvidence,
  classifierVersion,
  snapshot,
}: {
  mission: OperationalMission;
  evidenceOpen: boolean;
  onToggleEvidence: () => void;
  classifierVersion: number;
  snapshot: CommandCenterSnapshot;
}) {
  const checkpoints = mission.stages.filter((stage) => stage.isCheckpoint);
  return (
    <div
      className="mt-4 border-t border-white/8 pt-3"
      data-testid="command-center-mission"
      aria-label="Tactical mission"
    >
      <p className="foundry-eyebrow">Tactical mission</p>
      <h4 className="mt-1 text-xs font-medium text-neutral-200">
        {mission.missionTypeLabel}
        <span className="ml-2 font-mono text-[9px] text-neutral-600">{mission.missionId}</span>
      </h4>

      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Type" value={mission.missionType} />
        <Field label="Outcome" value={mission.outcome.replaceAll("_", " ")} />
        <Field label="Objective" value={formatAttested(mission.objective)} />
        <Field label="Autonomy" value={formatAutonomy(mission)} />
        <Field label="Launched" value={formatAttested(mission.launchedAt)} />
        <Field
          label="Spend"
          value={formatAttested(mission.spendUsd, (v) => formatUsd(Number(v)))}
        />
        <Field
          label="Authority"
          value={formatAttestedText(
            mission.loadout.authority,
            (auth) => `${auth.scope} (${auth.authorizationId})`,
          )}
        />
        <Field
          label="Budget"
          value={formatAttestedText(mission.loadout.budget, (budget) =>
            formatUsd(budget.authorizedCeilingUsd, budget.currency),
          )}
        />
        <Field
          label="Constraints"
          value={formatAttestedText(mission.loadout.constraints, (list) =>
            list.length ? list.join("; ") : "none recorded",
          )}
        />
      </dl>

      <div className="mt-3">
        <p className="text-[9px] uppercase tracking-[0.08em] text-neutral-600">Agents</p>
        {mission.loadout.agents.length === 0 ? (
          <p className="mt-1 text-[10px] text-neutral-500">No agents in loadout.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-[10px] text-neutral-300">
            {mission.loadout.agents.map((agent) => (
              <li key={agent.agentId}>
                {agent.agentId} · {formatAttested(agent.role)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3">
        <p className="text-[9px] uppercase tracking-[0.08em] text-neutral-600">
          Stages and checkpoints
        </p>
        <ul className="mt-1 space-y-1 text-[10px] text-neutral-300">
          {mission.stages.map((stage) => (
            <li key={stage.key}>
              {stage.label}: {stage.status.replaceAll("_", " ")}
              {stage.isCheckpoint ? " · checkpoint" : ""}
            </li>
          ))}
        </ul>
        {checkpoints.length === 0 ? (
          <p className="mt-1 text-[9px] text-neutral-600">No checkpoints declared for this type.</p>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ListBlock
          label="Blockers"
          empty="None recorded."
          items={mission.blockers.map(
            (blocker) => `${blocker.severity}: ${blocker.summary}`,
          )}
        />
        <ListBlock
          label="Operator decisions"
          empty="None recorded."
          items={mission.decisions.map((decision) => `${decision.kind}: ${decision.summary}`)}
        />
        <ListBlock
          label="Artifacts"
          empty="None recorded."
          items={mission.artifacts.map(
            (artifact) => `${artifact.artifactId} · ${formatAttested(artifact.kind)}`,
          )}
        />
        <ListBlock
          label="External actions (mission interval)"
          empty={
            snapshot.externalActions.noQualifyingActionsStatement ?? "None in snapshot."
          }
          items={
            snapshot.externalActions.noQualifyingActionsStatement
              ? []
              : [
                  `${snapshot.externalActions.projection.actions.length} qualifying (classifier v${classifierVersion})`,
                ]
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={evidenceOpen}
          onClick={onToggleEvidence}
          data-testid="command-center-evidence-toggle"
          className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-neutral-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          {evidenceOpen ? "Hide evidence" : "Open evidence"}
        </button>
        <span className="text-[9px] text-neutral-600">
          Level 3 is reachable and never required for ordinary decisions.
        </span>
      </div>

      {evidenceOpen ? <EvidenceDrawer mission={mission} snapshot={snapshot} /> : null}
    </div>
  );
}

function EvidenceDrawer({
  mission,
  snapshot,
}: {
  mission: OperationalMission;
  snapshot: CommandCenterSnapshot;
}) {
  const evidence = uniqueEvidence(collectMissionEvidence(mission));
  return (
    <div
      className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3"
      data-testid="command-center-evidence"
      aria-label="Command Center evidence"
    >
      <p className="text-[9px] uppercase tracking-[0.08em] text-neutral-600">Evidence ledger</p>
      <p className="mt-1 text-[9px] text-neutral-500">
        Snapshot sequence {snapshot.latestSequence} · observed {snapshot.observedAt} · classifier v
        {snapshot.externalActionClassifierVersion}
      </p>
      <ul className="mt-2 space-y-1.5">
        {evidence.map((ref) => (
          <li key={`${ref.eventId}-${ref.eventType}`} className="font-mono text-[9px] text-neutral-300">
            {ref.eventType}
            <span className="text-neutral-600"> · {ref.eventId}</span>
            {ref.sequence !== undefined ? (
              <span className="text-neutral-600"> · seq {ref.sequence}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[9px] uppercase tracking-[0.08em] text-neutral-600">
        Source event ids
      </p>
      <p className="mt-1 break-all font-mono text-[9px] text-neutral-400">
        {mission.sourceEventIds.join(", ") || "none"}
      </p>
      <p className="mt-2 text-[9px] uppercase tracking-[0.08em] text-neutral-600">
        Coverage detail
      </p>
      <ul className="mt-1 space-y-1 text-[9px] text-neutral-400">
        {snapshot.coverage.map((row) => (
          <li key={`ev-${row.sourceId}`}>
            {row.sourceLabel}: {COVERAGE_LABELS[row.connection]} / {COVERAGE_LABELS[row.progress]}
            {row.uncertainty.result_uncertain
              ? ` / uncertain: ${row.uncertainty.uncertainty_reason}`
              : ""}
            {row.stopReason ? ` / stop: ${row.stopReason}` : ""}
            {row.exclusionReason ? ` / excluded: ${row.exclusionReason}` : ""}
            {" · "}
            {row.declaredInterval}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[9px] uppercase tracking-[0.08em] text-neutral-600">
        Debrief evidence
      </p>
      <ul className="mt-1 space-y-1 font-mono text-[9px] text-neutral-400">
        {mission.debriefEvidence.length === 0 ? (
          <li>none</li>
        ) : (
          mission.debriefEvidence.map((ref) => (
            <li key={`debrief-${ref.eventId}`}>
              {ref.eventType} · {ref.eventId}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 p-2">
      <dt className="text-[9px] uppercase tracking-[0.08em] text-neutral-600">{label}</dt>
      <dd className="mt-1 text-[10px] leading-relaxed text-neutral-200">{value}</dd>
    </div>
  );
}

function ListBlock({
  label,
  empty,
  items,
}: {
  label: string;
  empty: string;
  items: string[];
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.08em] text-neutral-600">{label}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-[10px] text-neutral-500">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1 text-[10px] text-neutral-300">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
