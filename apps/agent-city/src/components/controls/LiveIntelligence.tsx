"use client";

import { useRuntime } from "@/lib/mock-runtime";
import { selectStages } from "@/lib/mock-runtime/selectors";
import { computeLighthouseState } from "@/lib/world/lighthouseState";
import { LIGHTHOUSE_STATE_VISUALS } from "@foundry/world-model";
import { useMemo } from "react";

const LIGHTHOUSE_STATE_LABEL: Record<ReturnType<typeof computeLighthouseState>, string> = {
  healthy: "Healthy",
  active: "Active",
  attention_required: "Attention required",
  degraded: "Degraded",
  critical: "Critical",
  disconnected: "Disconnected",
};

// docs/02-specification/interface-model.md § "Right live-intelligence
// region": "Surfaces current facts and exceptions only — not a second full
// dashboard."
export function LiveIntelligence() {
  const { events, worldState, isRunning, isComplete } = useRuntime();
  const stages = useMemo(() => selectStages(events), [events]);

  const blockedStages = stages.filter((s) => s.status === "blocked");
  const activeStage = stages.find((s) => s.status === "running" || s.status === "validating");
  const pendingApproval = worldState.approvals.find((a) => a.status === "pending");
  const activeAgents = worldState.agents.filter(
    (a) => a.status === "working" || a.status === "traveling",
  );
  const lighthouseState = computeLighthouseState(worldState);

  const hasExceptions = blockedStages.length > 0 || !!pendingApproval;

  return (
    <div className="space-y-3">
      <section aria-label="Status">
        <p className="text-neutral-400">
          {isComplete ? "Demo complete" : isRunning ? "Running" : "Paused"}
        </p>
      </section>

      {/* Accessible textual label for the Lighthouse's current state
          (world-model.md: every selectable/observable object must expose
          an accessible textual name and state; color is never the only
          signal) — the 3D beacon's shape/color/motion (Lighthouse.tsx)
          is the visual signal, this is its textual equivalent. */}
      <section aria-label="Lighthouse">
        <h3 className="font-medium">Lighthouse</h3>
        <p data-testid="lighthouse-status" className="text-neutral-400">
          {LIGHTHOUSE_STATE_LABEL[lighthouseState]} — {LIGHTHOUSE_STATE_VISUALS[lighthouseState]}
        </p>
      </section>

      {hasExceptions && (
        <section aria-label="Exceptions" data-testid="exceptions-panel">
          <h3 className="font-medium text-amber-300">Needs attention</h3>
          <ul className="mt-1 space-y-1">
            {blockedStages.map((s) => (
              <li key={s.id} className="text-red-400">
                Blocked: {s.name} — {s.blockedReason}
              </li>
            ))}
            {pendingApproval && (
              <li className="text-amber-300">Pending approval: {pendingApproval.title}</li>
            )}
          </ul>
        </section>
      )}

      {activeStage && (
        <section aria-label="Active stage">
          <h3 className="font-medium">Active stage</h3>
          <p className="text-neutral-400">
            {activeStage.name} — {activeStage.status}
          </p>
        </section>
      )}

      {activeAgents.length > 0 && (
        <section aria-label="Active agents">
          <h3 className="font-medium">Active agents</h3>
          <ul className="mt-1 space-y-0.5 text-neutral-400 capitalize">
            {activeAgents.map((a) => (
              <li key={a.id}>
                {a.role} — {a.status}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
