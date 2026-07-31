"use client";

import { useFrame } from "@react-three/fiber";
import { useRuntime } from "@/lib/mock-runtime";
import { computeVehicleState } from "@/lib/world/vehicleState";
import { VEHICLE_VISUALS } from "@/lib/world/vehicleVisuals";
import { WORLD_BUILDINGS, WORLD_VEHICLE } from "@foundry/world-model";
import { type RefObject, useMemo, useRef } from "react";
import { Vector3 } from "three";
import type { Selection } from "@/components/controls/selection";
import type { WorldObjectMarkerMap } from "@/lib/world/objectMarkerState";
import { Vehicle } from "./Vehicle";

const MARKER_HEIGHT = 1.15;
const HOME_OFFSET_X = 2.2; // parked beside its home building, not overlapping it.

// FBL-019 — bridges the shared runtime context into R3F's render tree (the
// its-fine-backed pattern every prior world object uses) for the single
// utility vehicle. Reuses the FBL-015 selection framework via the same
// `onSelect(id)` funnel; position is fixed at its home building (motion
// stubbed inert until FBL-021).
export function VehicleSceneObject({
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
  const homeBuilding = useMemo(
    () => WORLD_BUILDINGS.find((b) => b.id === WORLD_VEHICLE.homeBuildingId),
    [],
  );
  const position: readonly [number, number, number] = homeBuilding
    ? [homeBuilding.position.x + HOME_OFFSET_X, homeBuilding.position.y, homeBuilding.position.z]
    : [0, 0, 0];
  const scratchVector = useRef(new Vector3());
  const state = computeVehicleState(worldState);
  const spec = VEHICLE_VISUALS[state];
  const selected = selection?.kind === "vehicle" && selection.id === WORLD_VEHICLE.id;

  useFrame(({ camera }) => {
    scratchVector.current.set(position[0], position[1] + MARKER_HEIGHT, position[2]);
    const projected = scratchVector.current.clone().project(camera);
    const inFrontOfCamera = projected.z < 1;
    const withinFrame = Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1;
    markerMapRef.current.set(WORLD_VEHICLE.id, {
      id: WORLD_VEHICLE.id,
      label: WORLD_VEHICLE.name,
      visible: inFrontOfCamera && withinFrame,
      xPercent: ((projected.x + 1) / 2) * 100,
      yPercent: ((1 - projected.y) / 2) * 100,
      state: spec.label,
      hovered: hoveredIdRef.current === WORLD_VEHICLE.id,
      selected,
    });
  });

  function handleHoverChange(hovered: boolean) {
    if (hovered) {
      hoveredIdRef.current = WORLD_VEHICLE.id;
    } else if (hoveredIdRef.current === WORLD_VEHICLE.id) {
      hoveredIdRef.current = null;
    }
  }

  return (
    <Vehicle
      position={position}
      indicatorColor={spec.color}
      indicatorShape={spec.shape}
      selected={selected}
      onSelect={() => onSelect(WORLD_VEHICLE.id)}
      onHoverChange={handleHoverChange}
    />
  );
}
