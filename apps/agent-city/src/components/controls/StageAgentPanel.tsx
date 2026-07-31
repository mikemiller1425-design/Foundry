"use client";

import { useRuntime } from "@/lib/mock-runtime";
import { selectStages } from "@/lib/mock-runtime/selectors";
import { useMemo } from "react";
import type { Selection } from "./selection";

const STAGE_LABEL: Record<string, string> = {
  planning: "Planning",
  scaffold: "Scaffold",
  frontend_implementation: "Frontend implementation",
  backend_implementation: "Backend implementation",
  integration: "Integration",
  qa_validation: "QA validation",
  deployment_package: "Deployment package",
};

const STAGE_STATUS_COLOR: Record<string, string> = {
  planned: "text-neutral-500",
  ready: "text-sky-400",
  running: "text-sky-300",
  validating: "text-sky-300",
  blocked: "text-red-400",
  revision_required: "text-amber-400",
  completed: "text-emerald-400",
  failed: "text-red-400",
  waiting_for_approval: "text-amber-400",
  cancelled: "text-neutral-500",
};

export function StageAgentPanel({
  selection,
  onSelect,
}: {
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  const { events, worldState } = useRuntime();
  const stages = useMemo(() => selectStages(events), [events]);

  return (
    <div className="space-y-4">
      <section aria-label="Current build">
        <h3 className="font-medium">Current build</h3>
        {worldState.currentBuild ? (
          <dl className="mt-1 space-y-0.5 text-neutral-400">
            <div>
              <dt className="inline text-neutral-500">status: </dt>
              <dd className="inline">{worldState.currentBuild.status}</dd>
            </div>
            <div className="truncate">
              <dt className="inline text-neutral-500">objective: </dt>
              <dd className="inline">{worldState.currentBuild.objectiveSnapshot}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-1 text-neutral-500">No build yet.</p>
        )}
      </section>

      <section aria-label="Build stages">
        <h3 className="font-medium">Stages</h3>
        <ul className="mt-1 space-y-0.5">
          {stages.map((stage) => (
            <li key={stage.id}>
              <button
                type="button"
                onClick={() => onSelect({ kind: "stage", id: stage.id })}
                aria-pressed={selection?.kind === "stage" && selection.id === stage.id}
                data-testid="stage-list-item"
                className={`flex w-full items-center justify-between rounded px-1 py-0.5 text-left hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                  selection?.kind === "stage" && selection.id === stage.id ? "bg-neutral-800" : ""
                }`}
              >
                <span className="truncate">{STAGE_LABEL[stage.name] ?? stage.name}</span>
                <span className={STAGE_STATUS_COLOR[stage.status] ?? "text-neutral-400"}>
                  {stage.status}
                </span>
              </button>
            </li>
          ))}
          {stages.length === 0 && <li className="text-neutral-500">No stages yet.</li>}
        </ul>
      </section>

      <section aria-label="Agents">
        <h3 className="font-medium">Agents</h3>
        <ul className="mt-1 space-y-0.5">
          {worldState.agents.map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                onClick={() => onSelect({ kind: "agent", id: agent.id })}
                aria-pressed={selection?.kind === "agent" && selection.id === agent.id}
                data-testid="agent-list-item"
                className={`flex w-full items-center justify-between rounded px-1 py-0.5 text-left capitalize hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                  selection?.kind === "agent" && selection.id === agent.id ? "bg-neutral-800" : ""
                }`}
              >
                <span className="truncate">{agent.role}</span>
                <span className="text-neutral-400">{agent.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
