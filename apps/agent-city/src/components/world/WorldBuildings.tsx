"use client";

import { useFrame } from "@react-three/fiber";
import { useRuntime } from "@/lib/mock-runtime";
import { selectStages, selectUpgradeInProgress } from "@/lib/mock-runtime/selectors";
import { computeResidenceState, RESIDENCE_STATE_SHORT_LABEL } from "@/lib/world/residenceState";
import {
  computeConstructionSitePhase,
  CONSTRUCTION_SITE_VISUALS,
} from "@/lib/world/constructionSitePhase";
import { computeOperationalBuildingStatus } from "@/lib/world/operationalBuildingState";
import { OPERATIONAL_BUILDING_VISUALS } from "@/lib/world/operationalBuildingVisuals";
import { WORLD_BUILDINGS, type WorldBuildingDefinition } from "@foundry/world-model";
import { type RefObject, useMemo, useRef } from "react";
import { Vector3 } from "three";
import type { Selection } from "@/components/controls/selection";
import type { WorldObjectMarkerMap } from "@/lib/world/objectMarkerState";
import {
  getOperationalBuildingIndicatorHeight,
  OperationalBuilding,
  type OperationalBuildingType,
} from "./OperationalBuilding";
import { Residence } from "./Residence";

const RESIDENCE_MARKER_HEIGHT = 2.05;

/**
 * The marker's sample height must track the same point the visible
 * indicator mesh actually occupies (getOperationalBuildingIndicatorHeight
 * for operational buildings, the fixed ridge height for residences) —
 * recomputed every frame rather than cached, since the Warehouse's own
 * indicator height changes once `level` reaches 2 (a real
 * `upgrade.completed` event, not a local toggle).
 */
function markerHeight(def: WorldBuildingDefinition, level: number): number {
  if (def.buildingType === "home") return RESIDENCE_MARKER_HEIGHT;
  return getOperationalBuildingIndicatorHeight(def.buildingType as OperationalBuildingType, level);
}

// FBL-016/FBL-017 — bridges the shared runtime context into R3F's render
// tree (the same its-fine-backed pattern LighthouseSceneObject.tsx
// established) for every non-Lighthouse building: the three residences
// (FBL-016) and the five operational buildings (FBL-017). Iterates
// `WORLD_BUILDINGS` and renders whichever object type each entry's
// `buildingType` calls for; it is not a parallel selection mechanism, it
// funnels every selection through the same `onSelect(id)` FBL-015
// established for the Lighthouse.
export function WorldBuildings({
  markerMapRef,
  selection,
  onSelect,
  hoveredIdRef,
}: {
  markerMapRef: RefObject<WorldObjectMarkerMap>;
  selection: Selection | null;
  onSelect: (id: string) => void;
  hoveredIdRef: RefObject<string | null>;
}) {
  const { worldState, events } = useRuntime();
  const buildingDefs = useMemo(() => WORLD_BUILDINGS.filter((b) => b.buildingType !== "lighthouse"), []);
  const stages = useMemo(() => selectStages(events), [events]);
  const upgradeInProgress = useMemo(() => selectUpgradeInProgress(events), [events]);
  const scratchVector = useRef(new Vector3());

  function stateLabelFor(def: WorldBuildingDefinition): string {
    const building = worldState.buildings.find((b) => b.id === def.id);
    if (!building) return "";
    if (def.buildingType === "home") {
      const agent = worldState.agents.find((a) => a.homeBuildingId === def.id);
      return RESIDENCE_STATE_SHORT_LABEL[computeResidenceState(building, agent)];
    }
    if (def.buildingType === "construction_site") {
      return CONSTRUCTION_SITE_VISUALS[computeConstructionSitePhase(stages)].label;
    }
    const status = computeOperationalBuildingStatus(def.id, worldState, stages, upgradeInProgress);
    return OPERATIONAL_BUILDING_VISUALS[status].label;
  }

  useFrame(({ camera }) => {
    for (const def of buildingDefs) {
      const building = worldState.buildings.find((b) => b.id === def.id);
      const height = def.position.y + markerHeight(def, building?.level ?? 1);
      scratchVector.current.set(def.position.x, height, def.position.z);
      const projected = scratchVector.current.clone().project(camera);
      const inFrontOfCamera = projected.z < 1;
      const withinFrame = Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1;
      const selected = selection?.kind === "building" && selection.id === def.id;
      markerMapRef.current.set(def.id, {
        id: def.id,
        label: def.name,
        visible: inFrontOfCamera && withinFrame,
        xPercent: ((projected.x + 1) / 2) * 100,
        yPercent: ((1 - projected.y) / 2) * 100,
        state: stateLabelFor(def),
        hovered: hoveredIdRef.current === def.id,
        selected,
      });
    }
  });

  function handleHoverChange(id: string, hovered: boolean) {
    if (hovered) {
      hoveredIdRef.current = id;
    } else if (hoveredIdRef.current === id) {
      hoveredIdRef.current = null;
    }
  }

  return (
    <>
      {buildingDefs.map((def) => {
        const selected = selection?.kind === "building" && selection.id === def.id;
        const position: readonly [number, number, number] = [
          def.position.x,
          def.position.y,
          def.position.z,
        ];

        if (def.buildingType === "home") {
          const building = worldState.buildings.find((b) => b.id === def.id);
          const agent = worldState.agents.find((a) => a.homeBuildingId === def.id);
          const state = building ? computeResidenceState(building, agent) : "unavailable";
          return (
            <Residence
              key={def.id}
              position={position}
              state={state}
              selected={selected}
              onSelect={() => onSelect(def.id)}
              onHoverChange={(hovered) => handleHoverChange(def.id, hovered)}
            />
          );
        }

        const building = worldState.buildings.find((b) => b.id === def.id);
        const spec =
          def.buildingType === "construction_site"
            ? CONSTRUCTION_SITE_VISUALS[computeConstructionSitePhase(stages)]
            : OPERATIONAL_BUILDING_VISUALS[
                computeOperationalBuildingStatus(def.id, worldState, stages, upgradeInProgress)
              ];
        return (
          <OperationalBuilding
            key={def.id}
            buildingType={def.buildingType as OperationalBuildingType}
            position={position}
            level={building?.level ?? 1}
            indicatorColor={spec.color}
            indicatorShape={spec.shape}
            selected={selected}
            onSelect={() => onSelect(def.id)}
            onHoverChange={(hovered) => handleHoverChange(def.id, hovered)}
          />
        );
      })}
    </>
  );
}
