"use client";

import { useRuntime } from "@/lib/mock-runtime";
import { selectRequirementsByStage, selectStages } from "@/lib/mock-runtime/selectors";
import { useMemo } from "react";
import type { Selection } from "./selection";

const REQUIREMENT_STATUS_COLOR: Record<string, string> = {
  pending: "text-neutral-500",
  running: "text-sky-300",
  passed: "text-emerald-400",
  failed: "text-red-400",
  waived: "text-neutral-500",
};

export function SelectedObjectDetail({ selection }: { selection: Selection | null }) {
  const { events, worldState } = useRuntime();
  const stages = useMemo(() => selectStages(events), [events]);
  const requirementsByStage = useMemo(() => selectRequirementsByStage(events), [events]);

  if (!selection) {
    return (
      <>
        <h3 className="font-medium">Selected-object details</h3>
        <p className="mt-1 text-neutral-400">
          No selection. Select a stage or agent from the left navigation.
        </p>
      </>
    );
  }

  if (selection.kind === "stage") {
    const stage = stages.find((s) => s.id === selection.id);
    if (!stage) return null;
    const requirements = requirementsByStage.get(stage.id) ?? [];
    return (
      <>
        <h3 className="font-medium">Stage: {stage.name}</h3>
        <dl className="mt-1 space-y-0.5 text-neutral-400">
          <div>
            <dt className="inline text-neutral-500">status: </dt>
            <dd className="inline">{stage.status}</dd>
          </div>
          {stage.blockedReason && (
            <div>
              <dt className="inline text-neutral-500">blocked: </dt>
              <dd className="inline text-red-400">{stage.blockedReason}</dd>
            </div>
          )}
        </dl>
        {requirements.length > 0 && (
          <>
            <p className="mt-2 text-neutral-500">Requirement checklist</p>
            <ul className="mt-1 space-y-0.5">
              {requirements.map((req) => (
                <li key={req.id} data-testid="requirement-checklist-item">
                  <span className={REQUIREMENT_STATUS_COLOR[req.status] ?? "text-neutral-400"}>
                    {req.status === "passed" ? "✓" : req.status === "failed" ? "✗" : "•"}
                  </span>{" "}
                  <span>{req.status}</span>
                  {req.message && (
                    <p className="pl-3 text-red-400" data-testid="requirement-evidence">
                      {req.message}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    );
  }

  const agent = worldState.agents.find((a) => a.id === selection.id);
  if (!agent) return null;
  return (
    <>
      <h3 className="font-medium capitalize">Agent: {agent.role}</h3>
      <dl className="mt-1 space-y-0.5 text-neutral-400">
        <div>
          <dt className="inline text-neutral-500">status: </dt>
          <dd className="inline">{agent.status}</dd>
        </div>
        <div>
          <dt className="inline text-neutral-500">current building: </dt>
          <dd className="inline">{agent.currentBuildingId}</dd>
        </div>
        {agent.currentTaskId && (
          <div>
            <dt className="inline text-neutral-500">current task: </dt>
            <dd className="inline">{agent.currentTaskId}</dd>
          </div>
        )}
      </dl>
    </>
  );
}
