"use client";

import { readCapacity } from "@foundry/contracts";
import { useRuntime } from "@/lib/mock-runtime";
import {
  selectRequirementsByStage,
  selectStages,
  selectUpgradeInProgress,
} from "@/lib/mock-runtime/selectors";
import { computeLighthouseState, LIGHTHOUSE_STATE_SHORT_LABEL } from "@/lib/world/lighthouseState";
import { computeResidenceState, RESIDENCE_STATE_SHORT_LABEL } from "@/lib/world/residenceState";
import { RESIDENCE_VISUALS } from "@/lib/world/residenceVisuals";
import {
  computeConstructionSitePhase,
  CONSTRUCTION_SITE_VISUALS,
} from "@/lib/world/constructionSitePhase";
import { computeOperationalBuildingStatus } from "@/lib/world/operationalBuildingState";
import { OPERATIONAL_BUILDING_VISUALS } from "@/lib/world/operationalBuildingVisuals";
import { computeVehicleState } from "@/lib/world/vehicleState";
import { VEHICLE_VISUALS } from "@/lib/world/vehicleVisuals";
import { SELECTABLE_WORLD_OBJECTS } from "@/lib/world/selectableObjects";
import { LIGHTHOUSE_STATE_VISUALS, WORLD_VEHICLE } from "@foundry/world-model";
import { useMemo } from "react";
import type { Selection } from "./selection";
import { findFoundryDistrict, findFoundryParcel } from "@/lib/world/worldAtlas";
import { fixtureTenantForParcel } from "@/lib/world/tenantSpaces";

const REQUIREMENT_STATUS_COLOR: Record<string, string> = {
  pending: "text-neutral-500",
  running: "text-sky-300",
  passed: "text-emerald-400",
  failed: "text-red-400",
  waived: "text-neutral-500",
};

function RelationshipButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex w-full items-center justify-between gap-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-2 text-left text-xs text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
    >
      <span>{label}</span>
      <span aria-hidden="true">↗</span>
    </button>
  );
}

export function SelectedObjectDetail({
  selection,
  onSelect,
  onPreviewTenant,
}: {
  selection: Selection | null;
  onSelect?: (selection: Selection) => void;
  onPreviewTenant?: (tenantId: string) => void;
}) {
  const { events, worldState } = useRuntime();
  const stages = useMemo(() => selectStages(events), [events]);
  const requirementsByStage = useMemo(() => selectRequirementsByStage(events), [events]);
  const upgradeInProgress = useMemo(() => selectUpgradeInProgress(events), [events]);

  if (!selection) {
    return (
      <>
        <h3 className="text-sm font-medium text-neutral-200">Nothing selected</h3>
        <p className="mt-1.5 leading-relaxed text-neutral-500">
          No selection. Choose a place, stage, or agent in the World navigator—or select an object
          directly in the district.
        </p>
      </>
    );
  }

  if (selection.kind === "district") {
    const district = findFoundryDistrict(selection.id);
    if (!district) return null;
    return (
      <>
        <p className="foundry-eyebrow">Fixture concept</p>
        <h3 className="mt-1 font-medium">District: {district.label}</h3>
        <p className="mt-1.5 leading-relaxed text-neutral-400">{district.purpose}</p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-neutral-500">
          {district.status === "active-fixture"
            ? "Active fixture district"
            : "Uncommissioned concept"}
        </p>
        <p className="mt-2 rounded-lg border border-violet-300/15 bg-violet-300/5 p-2 text-[10px] leading-relaxed text-violet-200">
          Frontend exploration only. This district is not a marketplace, legal property, or backend
          entitlement.
        </p>
      </>
    );
  }

  if (selection.kind === "parcel") {
    const parcel = findFoundryParcel(selection.id);
    if (!parcel) return null;
    const tenant = fixtureTenantForParcel(parcel.id);
    return (
      <>
        <p className="foundry-eyebrow">Fixture concept</p>
        <h3 className="mt-1 font-medium">Parcel: {parcel.label}</h3>
        <p className="mt-1.5 leading-relaxed text-neutral-400">{parcel.purpose}</p>
        <dl className="mt-2 space-y-0.5 text-neutral-400">
          <div>
            <dt className="inline text-neutral-500">fictional tenant: </dt>
            <dd className="inline">{parcel.tenant ?? "None — unassigned concept"}</dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">tenure model: </dt>
            <dd className="inline">
              {parcel.tenure === "concept-lease" ? "Concept lease" : "Unassigned"}
            </dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">linked places: </dt>
            <dd className="inline">{parcel.linkedBuildingIds.length}</dd>
          </div>
        </dl>
        <p className="mt-2 rounded-lg border border-violet-300/15 bg-violet-300/5 p-2 text-[10px] leading-relaxed text-violet-200">
          No lease, ownership, payment, identity, credential, or agent permission exists.
        </p>
        {tenant && onPreviewTenant && (
          <RelationshipButton
            label={`Preview fictional tenant space · ${tenant.name}`}
            onClick={() => onPreviewTenant(tenant.id)}
          />
        )}
        {onSelect &&
          parcel.linkedBuildingIds.map((buildingId) => {
            const place = SELECTABLE_WORLD_OBJECTS.find((object) => object.id === buildingId);
            return place ? (
              <RelationshipButton
                key={buildingId}
                label={`View place · ${place.label}`}
                onClick={() => onSelect({ kind: "building", id: buildingId })}
              />
            ) : null;
          })}
      </>
    );
  }

  if (selection.kind === "stage") {
    const stage = stages.find((s) => s.id === selection.id);
    if (!stage) return null;
    const requirements = requirementsByStage.get(stage.id) ?? [];
    const workplace = SELECTABLE_WORLD_OBJECTS.find(
      (object) => object.kind === "building" && object.id === stage.sourceBuildingId,
    );
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
        {workplace && onSelect && (
          <RelationshipButton
            label={`View workplace · ${workplace.label}`}
            onClick={() => onSelect({ kind: "building", id: workplace.id })}
          />
        )}
      </>
    );
  }

  if (selection.kind === "agent") {
    const agent = worldState.agents.find((a) => a.id === selection.id);
    if (!agent) return null;
    const currentPlace = SELECTABLE_WORLD_OBJECTS.find(
      (object) => object.id === agent.currentBuildingId,
    );
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
        {currentPlace && onSelect && (
          <RelationshipButton
            label={`View current place · ${currentPlace.label}`}
            onClick={() => onSelect({ kind: currentPlace.kind, id: currentPlace.id } as Selection)}
          />
        )}
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
        {agent && onSelect && (
          <RelationshipButton
            label={`View resident · ${agent.role}`}
            onClick={() => onSelect({ kind: "agent", id: agent.id })}
          />
        )}
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
    const status = computeOperationalBuildingStatus(
      building.id,
      worldState,
      stages,
      upgradeInProgress,
    );
    const spec = OPERATIONAL_BUILDING_VISUALS[status];
    const capacity = readCapacity(building.capabilities);
    const presentAgents = worldState.agents.filter(
      (agent) => agent.currentBuildingId === building.id,
    );
    return (
      <>
        <h3 className="font-medium">Building: {building.name}</h3>
        <dl className="mt-1 space-y-0.5 text-neutral-400">
          <div>
            <dt className="inline text-neutral-500">status: </dt>
            <dd className="inline">{status}</dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">signal: </dt>
            <dd className="inline">{spec.label}</dd>
          </div>
          <div>
            <dt className="inline text-neutral-500">level: </dt>
            <dd className="inline" data-testid="building-level">
              {building.level}
            </dd>
          </div>
          {/* FBL-031 / F-11: capacity must be *observable*, not merely
              stored — "capacity 25→100" is an acceptance requirement, and
              a number nobody can see cannot be checked. Rendered beside
              level because the two change atomically (V-07): seeing them
              disagree would itself be the failure. */}
          {capacity !== null && (
            <div>
              <dt className="inline text-neutral-500">capacity: </dt>
              <dd className="inline" data-testid="building-capacity">
                {capacity}
              </dd>
            </div>
          )}
        </dl>
        {onSelect &&
          presentAgents.map((agent) => (
            <RelationshipButton
              key={agent.id}
              label={`View present agent · ${agent.role}`}
              onClick={() => onSelect({ kind: "agent", id: agent.id })}
            />
          ))}
      </>
    );
  }

  return null;
}
