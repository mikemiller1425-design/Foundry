"use client";

import { useRuntime } from "@/lib/mock-runtime";
import { selectRequirementsByStage, selectStages } from "@/lib/mock-runtime/selectors";
import { computeLighthouseState, LIGHTHOUSE_STATE_SHORT_LABEL } from "@/lib/world/lighthouseState";
import { computeResidenceState, RESIDENCE_STATE_SHORT_LABEL } from "@/lib/world/residenceState";
import { RESIDENCE_VISUALS } from "@/lib/world/residenceVisuals";
import {
  computeConstructionSitePhase,
  CONSTRUCTION_SITE_VISUALS,
} from "@/lib/world/constructionSitePhase";
import { OPERATIONAL_BUILDING_VISUALS } from "@/lib/world/operationalBuildingVisuals";
import { computeVehicleState } from "@/lib/world/vehicleState";
import { VEHICLE_VISUALS } from "@/lib/world/vehicleVisuals";
import { LIGHTHOUSE_STATE_VISUALS, WORLD_VEHICLE } from "@foundry/world-model";
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
          No selection. Select a stage, agent, or world object from the left navigation, or the
          Lighthouse in the 3D world.
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

  if (selection.kind === "agent") {
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

  if (selection.kind === "vehicle") {
    const vehicleState = computeVehicleState(worldState);
    const spec = VEHICLE_VISUALS[vehicleState];
    return (
      <>
        <h3 className="font-medium">Vehicle: {WORLD_VEHICLE.name}</h3>
        <dl className="mt-1 space-y-0.5 text-neutral-400">
          <div>
            <dt className="inline text-neutral-500">status: </dt>
            <dd className="inline">{vehicleState}</dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">signal: </dt>
            <dd className="inline">{spec.label}</dd>
          </div>
        </dl>
      </>
    );
  }

  // selection.kind === "building" (FBL-015 framework; FBL-014 Lighthouse,
  // FBL-016 residences).
  if (selection.id === "lighthouse") {
    const lighthouseState = computeLighthouseState(worldState);
    return (
      <>
        <h3 className="font-medium">Building: Lighthouse</h3>
        <dl className="mt-1 space-y-0.5 text-neutral-400">
          <div>
            <dt className="inline text-neutral-500">state: </dt>
            <dd className="inline">{LIGHTHOUSE_STATE_SHORT_LABEL[lighthouseState]}</dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">signal: </dt>
            <dd className="inline">{LIGHTHOUSE_STATE_VISUALS[lighthouseState]}</dd>
          </div>
        </dl>
      </>
    );
  }

  const building = worldState.buildings.find((b) => b.id === selection.id);
  if (building?.buildingType === "home") {
    const agent = worldState.agents.find((a) => a.homeBuildingId === building.id);
    const residenceState = computeResidenceState(building, agent);
    return (
      <>
        <h3 className="font-medium">Building: {building.name}</h3>
        <dl className="mt-1 space-y-0.5 text-neutral-400">
          <div>
            <dt className="inline text-neutral-500">state: </dt>
            <dd className="inline">{RESIDENCE_STATE_SHORT_LABEL[residenceState]}</dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">signal: </dt>
            <dd className="inline">{RESIDENCE_VISUALS[residenceState].label}</dd>
          </div>
          {agent && (
            <div>
              <dt className="inline text-neutral-500">resident: </dt>
              <dd className="inline capitalize">{agent.role}</dd>
            </div>
          )}
        </dl>
      </>
    );
  }

  if (building?.buildingType === "construction_site") {
    const phase = computeConstructionSitePhase(stages);
    const spec = CONSTRUCTION_SITE_VISUALS[phase];
    return (
      <>
        <h3 className="font-medium">Building: {building.name}</h3>
        <dl className="mt-1 space-y-0.5 text-neutral-400">
          <div>
            <dt className="inline text-neutral-500">phase: </dt>
            <dd className="inline capitalize">{phase}</dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">signal: </dt>
            <dd className="inline">{spec.label}</dd>
          </div>
        </dl>
      </>
    );
  }

  if (building) {
    const spec = OPERATIONAL_BUILDING_VISUALS[building.status];
    return (
      <>
        <h3 className="font-medium">Building: {building.name}</h3>
        <dl className="mt-1 space-y-0.5 text-neutral-400">
          <div>
            <dt className="inline text-neutral-500">status: </dt>
            <dd className="inline">{building.status}</dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">signal: </dt>
            <dd className="inline">{spec.label}</dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">level: </dt>
            <dd className="inline">{building.level}</dd>
          </div>
        </dl>
      </>
    );
  }

  return null;
}
