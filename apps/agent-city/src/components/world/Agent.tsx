"use client";

import { type ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import { ShapeGeometry, type IndicatorShape } from "./ShapeGeometry";
import { SelectionRing } from "./SelectionRing";

const HOVER_SCALE = 1.1;
const BODY_COLOR = "#d4d4d8";
const HEAD_COLOR = "#e4e4e7";

// FBL-020 — Architect / Builder / Inspector agents
// (docs/02-specification/world-model.md → "Architect / Builder / Inspector
// agents"). Simple low-poly figure — a small stand-in body + head, per the
// rung's own "simple low-poly/icon representation acceptable." Never a
// decorative citizen/NPC: exactly these three, no others. Body/head never
// change with state; only the indicator shape/color above the head does,
// driven by agentVisuals.ts's declarative table.
export function Agent({
  position,
  indicatorColor,
  indicatorShape,
  selected = false,
  onSelect,
  onHoverChange,
}: {
  position: readonly [number, number, number];
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
      <mesh position={[0, 0.35, 0]}>
        <capsuleGeometry args={[0.18, 0.4, 4, 8]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
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
    </group>
  );
}
