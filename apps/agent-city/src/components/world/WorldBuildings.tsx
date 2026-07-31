"use client";

import { useFrame } from "@react-three/fiber";
import { useRuntime } from "@/lib/mock-runtime";
import { computeResidenceState } from "@/lib/world/residenceState";
import { RESIDENCE_STATE_SHORT_LABEL } from "@/lib/world/residenceState";
import { WORLD_BUILDINGS } from "@foundry/world-model";
import { type RefObject, useMemo, useRef } from "react";
import { Vector3 } from "three";
import type { Selection } from "@/components/controls/selection";
import type { WorldObjectMarkerMap } from "@/lib/world/objectMarkerState";
import { Residence } from "./Residence";

// FBL-016 — bridges the shared runtime context into R3F's render tree (the
// same its-fine-backed pattern LighthouseSceneObject.tsx established) for
// every "home" building (the three residences). Reused as-is by FBL-017
// once operational buildings are added — this component's job is iterating
// `WORLD_BUILDINGS` and rendering whichever object type each entry's
// `buildingType` calls for; it is not a parallel selection mechanism, it
// funnels every selection through the same `onSelect(id)` FBL-015 already
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
  const { worldState } = useRuntime();
  const residenceDefs = useMemo(
    () => WORLD_BUILDINGS.filter((b) => b.buildingType === "home"),
    [],
  );
  const projectedVectors = useRef(new Map<string, Vector3>());

  useFrame(({ camera }) => {
    for (const def of residenceDefs) {
      let vec = projectedVectors.current.get(def.id);
      if (!vec) {
        vec = new Vector3(def.position.x, def.position.y + 2.05, def.position.z);
        projectedVectors.current.set(def.id, vec);
      }
      const projected = vec.clone().project(camera);
      const inFrontOfCamera = projected.z < 1;
      const withinFrame = Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1;
      const building = worldState.buildings.find((b) => b.id === def.id);
      const agent = worldState.agents.find((a) => a.homeBuildingId === def.id);
      const state = building ? computeResidenceState(building, agent) : "unavailable";
      const selected = selection?.kind === "building" && selection.id === def.id;
      markerMapRef.current.set(def.id, {
        id: def.id,
        label: def.name,
        visible: inFrontOfCamera && withinFrame,
        xPercent: ((projected.x + 1) / 2) * 100,
        yPercent: ((1 - projected.y) / 2) * 100,
        state: RESIDENCE_STATE_SHORT_LABEL[state],
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
      {residenceDefs.map((def) => {
        const building = worldState.buildings.find((b) => b.id === def.id);
        const agent = worldState.agents.find((a) => a.homeBuildingId === def.id);
        const state = building ? computeResidenceState(building, agent) : "unavailable";
        const selected = selection?.kind === "building" && selection.id === def.id;
        return (
          <Residence
            key={def.id}
            position={[def.position.x, def.position.y, def.position.z]}
            state={state}
            selected={selected}
            onSelect={() => onSelect(def.id)}
            onHoverChange={(hovered) => handleHoverChange(def.id, hovered)}
          />
        );
      })}
    </>
  );
}
