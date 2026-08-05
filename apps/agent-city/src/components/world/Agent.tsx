"use client";

import { type ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import { ShapeGeometry, type IndicatorShape } from "./ShapeGeometry";
import { SelectionRing } from "./SelectionRing";
import type { AgentRole } from "@foundry/contracts";
import type { AgentStatus } from "@foundry/contracts";
import { AgentActivityField } from "./AgentActivityField";

const HOVER_SCALE = 1.1;
const HEAD_COLOR = "#e4e4e7";
const ROLE_COLOR: Record<AgentRole, string> = {
  architect: "#67c7e8",
  builder: "#e7a94d",
  inspector: "#67d4ad",
};

function RoleIdentity({ role }: { role: AgentRole }) {
  if (role === "architect") {
    return (
      <mesh castShadow position={[0, 0.47, 0.19]}>
        <boxGeometry args={[0.28, 0.12, 0.08]} />
        <meshStandardMaterial color="#b7ecff" emissive="#67c7e8" emissiveIntensity={0.18} />
      </mesh>
    );
  }
  if (role === "builder") {
    return (
      <mesh castShadow position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.18, 0.14, 0.1, 8]} />
        <meshStandardMaterial color="#f2bd66" roughness={0.72} />
      </mesh>
    );
  }
  return (
    <mesh castShadow position={[0, 0.45, 0.2]}>
      <octahedronGeometry args={[0.12, 0]} />
      <meshStandardMaterial color="#b6f5df" emissive="#67d4ad" emissiveIntensity={0.16} />
    </mesh>
  );
}

// FBL-020 — Architect / Builder / Inspector agents
// (docs/02-specification/world-model.md → "Architect / Builder / Inspector
// agents"). Simple low-poly figure — a small stand-in body + head, per the
// rung's own "simple low-poly/icon representation acceptable." Never a
// decorative citizen/NPC: exactly these three, no others. Body/head never
// change with state; only the indicator shape/color above the head does,
// driven by agentVisuals.ts's declarative table.
export function Agent({
  position,
  role,
  status,
  indicatorColor,
  indicatorShape,
  selected = false,
  onSelect,
  onHoverChange,
}: {
  position: readonly [number, number, number];
  role: AgentRole;
  status: AgentStatus;
  indicatorColor: string;
  indicatorShape: IndicatorShape;
  selected?: boolean;
  onSelect?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const scale = hovered ? HOVER_SCALE : 1;

  function handlePointerOver(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    setHovered(true);
    onHoverChange?.(true);
    document.body.style.cursor = "pointer";
  }

  function handlePointerOut(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    setHovered(false);
    onHoverChange?.(false);
    document.body.style.cursor = "auto";
  }

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onSelect?.();
  }

  return (
    <group
      position={[position[0], position[1], position[2]]}
      scale={scale}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <mesh castShadow position={[0, 0.35, 0]}>
        <capsuleGeometry args={[0.18, 0.4, 4, 8]} />
        <meshStandardMaterial color={ROLE_COLOR[role]} roughness={0.72} />
      </mesh>
      <RoleIdentity role={role} />
      <AgentActivityField status={status} color={indicatorColor} />
      <mesh castShadow position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshStandardMaterial color={HEAD_COLOR} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <ShapeGeometry shape={indicatorShape} size={0.16} />
        <meshStandardMaterial
          color={indicatorColor}
          emissive={indicatorColor}
          emissiveIntensity={0.7}
        />
      </mesh>
      {selected && <SelectionRing innerRadius={0.35} outerRadius={0.5} />}
      {hovered && !selected && (
        <SelectionRing innerRadius={0.34} outerRadius={0.47} color="#64d8ff" opacity={0.75} />
      )}
    </group>
  );
}
