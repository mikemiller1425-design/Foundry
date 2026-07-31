"use client";

import { useFrame } from "@react-three/fiber";
import { useRuntime } from "@/lib/mock-runtime";
import { selectStages } from "@/lib/mock-runtime/selectors";
import { computeCargoState } from "@/lib/world/cargoState";
import { CARGO_VISUALS } from "@/lib/world/cargoVisuals";
import { WORLD_BUILDINGS } from "@foundry/world-model";
import { type RefObject, useMemo, useRef } from "react";
import { Vector3 } from "three";
import type { WorldObjectMarkerMap } from "@/lib/world/objectMarkerState";
import { Cargo } from "./Cargo";

export const CARGO_ID = "cargo-current-build";
const CARGO_OFFSET_X = -2.2;
const MARKER_HEIGHT = 0.75;

const warehouse = WORLD_BUILDINGS.find((b) => b.id === "warehouse")!;
const CARGO_POSITION: readonly [number, number, number] = [
  warehouse.position.x + CARGO_OFFSET_X,
  warehouse.position.y,
  warehouse.position.z,
];

// FBL-021 — the scene-object bridge for the single Cargo representation
// (same its-fine-backed pattern as every prior world object). Not
// selectable (see Cargo.tsx), but still registers a marker so its state
// is real-browser-testable without pixel sampling, the same discipline
// every other FBL-016+ object follows.
export function CargoSceneObject({
  markerMapRef,
}: {
  markerMapRef: RefObject<WorldObjectMarkerMap>;
}) {
  const { worldState, events } = useRuntime();
  const stages = useMemo(() => selectStages(events), [events]);
  const scratchVector = useRef(new Vector3());
  const state = computeCargoState(worldState, stages);
  const spec = CARGO_VISUALS[state];

  useFrame(({ camera }) => {
    scratchVector.current.set(CARGO_POSITION[0], CARGO_POSITION[1] + MARKER_HEIGHT, CARGO_POSITION[2]);
    const projected = scratchVector.current.clone().project(camera);
    const inFrontOfCamera = projected.z < 1;
    const withinFrame = Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1;
    markerMapRef.current.set(CARGO_ID, {
      id: CARGO_ID,
      label: "Cargo",
      visible: inFrontOfCamera && withinFrame,
      xPercent: ((projected.x + 1) / 2) * 100,
      yPercent: ((1 - projected.y) / 2) * 100,
      state: spec.label,
      hovered: false,
      selected: false,
    });
  });

  return (
    <Cargo
      position={CARGO_POSITION}
      indicatorColor={spec.color}
      indicatorShape={spec.shape}
      sealed={spec.sealed}
    />
  );
}
