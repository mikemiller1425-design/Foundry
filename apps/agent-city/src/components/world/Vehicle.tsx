"use client";

import { type ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import { ShapeGeometry, type IndicatorShape } from "./ShapeGeometry";
import { SelectionRing } from "./SelectionRing";

const HOVER_SCALE = 1.08;
const BODY_COLOR = "#8a8a92";
const CABIN_COLOR = "#5b5b63";

// FBL-019 — the single utility vehicle (docs/02-specification/world-model.md
// → "Utility vehicle"). Simple low-poly chassis + cabin, no interior.
// Position is fixed at its home building today — motion logic is
// explicitly stubbed inert this rung (no timer-driven movement, no
// departure without a real `transfer.started`); actually moving it along a
// route is FBL-021's job. The indicator shape/color is the only part that
// varies with state.
export function Vehicle({
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
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.2, 0.6, 0.7]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>
      <mesh position={[-0.15, 0.7, 0]}>
        <boxGeometry args={[0.6, 0.4, 0.6]} />
        <meshStandardMaterial color={CABIN_COLOR} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <ShapeGeometry shape={indicatorShape} size={0.22} />
        <meshStandardMaterial
          color={indicatorColor}
          emissive={indicatorColor}
          emissiveIntensity={0.6}
        />
      </mesh>
      {selected && <SelectionRing innerRadius={0.75} outerRadius={0.95} />}
    </group>
  );
}
