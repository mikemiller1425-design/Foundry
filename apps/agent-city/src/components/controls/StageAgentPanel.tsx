"use client";

import { useRuntime } from "@/lib/mock-runtime";
import { selectStages, selectUpgradeInProgress, type StageSummary } from "@/lib/mock-runtime/selectors";
import { computeLighthouseState, LIGHTHOUSE_STATE_SHORT_LABEL } from "@/lib/world/lighthouseState";
import { computeResidenceState, RESIDENCE_STATE_SHORT_LABEL } from "@/lib/world/residenceState";
import {
  computeConstructionSitePhase,
  CONSTRUCTION_SITE_VISUALS,
} from "@/lib/world/constructionSitePhase";
import { computeOperationalBuildingStatus } from "@/lib/world/operationalBuildingState";
import { OPERATIONAL_BUILDING_VISUALS } from "@/lib/world/operationalBuildingVisuals";
import { computeVehicleState } from "@/lib/world/vehicleState";
import { VEHICLE_VISUALS } from "@/lib/world/vehicleVisuals";
import { SELECTABLE_WORLD_OBJECTS, type SelectableWorldObject } from "@/lib/world/selectableObjects";
import type { WorldState } from "@foundry/contracts";
import { useMemo } from "react";
import type { Selection } from "./selection";

// FBL-016/FBL-017: the "World objects" navigator list covers every
// registered selectable world object, not only the Lighthouse — each row's
// status label reads from that object's own state derivation rather than a
// single hardcoded value.
function worldObjectStatusLabel(
  object: SelectableWorldObject,
  worldState: WorldState,
  stages: readonly StageSummary[],
  upgradeInProgress: boolean,
): string {
  if (object.kind === "vehicle") {
    return VEHICLE_VISUALS[computeVehicleState(worldState)].label;
  }
  if (object.id === "lighthouse") {
    return LIGHTHOUSE_STATE_SHORT_LABEL[computeLighthouseState(worldState)];
  }
  const building = worldState.buildings.find((b) => b.id === object.id);
  if (building?.buildingType === "home") {
    const agent = worldState.agents.find((a) => a.homeBuildingId === object.id);
    return RESIDENCE_STATE_SHORT_LABEL[computeResidenceState(building, agent)];
  }
  if (building?.buildingType === "construction_site") {
    return CONSTRUCTION_SITE_VISUALS[computeConstructionSitePhase(stages)].label;
  }
  if (building) {
    const status = computeOperationalBuildingStatus(
      building.id,
      worldState,
      stages,
      upgradeInProgress,
    );
    return OPERATIONAL_BUILDING_VISUALS[status].label;
  }
  return "";
}

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
  const upgradeInProgress = useMemo(() => selectUpgradeInProgress(events), [events]);

  return (
    <div className="space-y-4">
      <section aria-label="World objects">
        <h3 className="font-medium">World objects</h3>
        <ul className="mt-1 space-y-0.5">
          {SELECTABLE_WORLD_OBJECTS.map((object) => {
            const isSelected = selection?.kind === object.kind && selection.id === object.id;
            return (
              <li key={object.id}>
                <button
                  type="button"
                  onClick={() => onSelect({ kind: object.kind, id: object.id } as Selection)}
                  aria-pressed={isSelected}
                  data-testid="building-list-item"
                  className={`flex w-full items-center justify-between rounded px-1 py-0.5 text-left hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                    isSelected ? "bg-neutral-800" : ""
                  }`}
                >
                  <span className="truncate">{object.label}</span>
                  <span className="text-neutral-400">
                    {worldObjectStatusLabel(object, worldState, stages, upgradeInProgress)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

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
