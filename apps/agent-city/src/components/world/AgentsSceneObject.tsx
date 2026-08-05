"use client";

import { useFrame } from "@react-three/fiber";
import { useRuntime } from "@/lib/mock-runtime";
import { computeAgentPosition } from "@/lib/world/agentPosition";
import { AGENT_VISUALS } from "@/lib/world/agentVisuals";
import { WORLD_AGENTS } from "@foundry/world-model";
import { type RefObject, useRef } from "react";
import { Vector3 } from "three";
import type { Selection } from "@/components/controls/selection";
import type { WorldObjectMarkerMap } from "@/lib/world/objectMarkerState";
import { Agent } from "./Agent";

const MARKER_HEIGHT = 1.05;

// FBL-020 — bridges the shared runtime context into R3F's render tree (the
// its-fine-backed pattern every prior world object uses) for exactly the
// three agents (`@foundry/world-model`'s `WORLD_AGENTS`, built at
// FBL-007) — never decorative citizens, never more than three. Each
// agent's position resolves to exactly one building (its live
// `currentBuildingId`), so one agent can never be visually represented in
// two locations at once (this rung's own explicit failure condition).
// Reuses the FBL-015 selection framework's existing `"agent"` kind — the
// pre-existing 2D "Agents" navigator list (FBL-010) already selects
// agents this way; this rung only adds the 3D representation to the same
// funnel, not a parallel one.
export function AgentsSceneObject({
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
  const scratchVector = useRef(new Vector3());

  useFrame(({ camera }) => {
    WORLD_AGENTS.forEach((def, index) => {
      const agent = worldState.agents.find((a) => a.id === def.id);
      const position = agent ? computeAgentPosition(agent.currentBuildingId, index) : null;
      if (!position) {
        markerMapRef.current.delete(def.id);
        return;
      }
      scratchVector.current.set(position.x, position.y + MARKER_HEIGHT, position.z);
      const projected = scratchVector.current.clone().project(camera);
      const inFrontOfCamera = projected.z < 1;
      const withinFrame = Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1;
      const selected = selection?.kind === "agent" && selection.id === def.id;
      const spec = AGENT_VISUALS[agent?.status ?? "idle"];
      markerMapRef.current.set(def.id, {
        id: def.id,
        label: def.name,
        visible: inFrontOfCamera && withinFrame,
        xPercent: ((projected.x + 1) / 2) * 100,
        yPercent: ((1 - projected.y) / 2) * 100,
        state: spec.label,
        hovered: hoveredIdRef.current === def.id,
        selected,
      });
    });
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
      {WORLD_AGENTS.map((def, index) => {
        const agent = worldState.agents.find((a) => a.id === def.id);
        const position = agent ? computeAgentPosition(agent.currentBuildingId, index) : null;
        if (!position) return null;
        const spec = AGENT_VISUALS[agent?.status ?? "idle"];
        const selected = selection?.kind === "agent" && selection.id === def.id;
        return (
          <Agent
            key={def.id}
            position={[position.x, position.y, position.z]}
            role={def.role}
            status={agent?.status ?? "idle"}
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
