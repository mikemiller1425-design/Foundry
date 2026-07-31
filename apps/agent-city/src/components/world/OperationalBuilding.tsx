"use client";

import { type ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import type { BuildingType } from "@foundry/contracts";
import { ShapeGeometry, type IndicatorShape } from "./ShapeGeometry";
import { SelectionRing } from "./SelectionRing";

const HOVER_SCALE = 1.05;

export type OperationalBuildingType = Exclude<BuildingType, "lighthouse" | "home">;

const BODY_DIMENSIONS: Record<OperationalBuildingType, readonly [number, number, number]> = {
  construction_office: [2.2, 1.6, 1.6],
  warehouse: [3, 1.8, 2.2],
  qa: [2, 1.8, 1.6],
  deployment_dock: [2.6, 1.4, 1.8],
  construction_site: [1.8, 1.2, 1.8],
};

const BODY_COLOR: Record<OperationalBuildingType, string> = {
  construction_office: "#8b8378",
  warehouse: "#7a746a",
  qa: "#6e8b8b",
  deployment_dock: "#7a6a5a",
  construction_site: "#9a9088",
};

/**
 * The world-space height of the indicator mesh above `position.y` — the
 * single source of truth shared by the renderer below and
 * WorldBuildings.tsx's screen-projection marker, so the marker always
 * samples the point the visible indicator mesh actually occupies rather
 * than an approximate constant that can drift out of alignment with a
 * building's own body height and leave the marker's projected screen point
 * over empty space instead of the rendered object.
 */
export function getOperationalBuildingIndicatorHeight(
  buildingType: OperationalBuildingType,
  level = 1,
): number {
  const [, h] = BODY_DIMENSIONS[buildingType];
  const isUpgradedWarehouse = buildingType === "warehouse" && level >= 2;
  return h + (isUpgradedWarehouse ? 1.5 : 0.3);
}

// FBL-017 — Construction Office, Warehouse, QA, Deployment Dock,
// Construction Site (docs/02-specification/world-model.md). One shared
// component parameterized by `buildingType` (base body size/color, for
// visual distinctness between the five) and by the caller-supplied
// indicator color/shape (the actual state signal — from
// operationalBuildingVisuals.ts for the generic Building.status vocabulary,
// or constructionSitePhase.ts's separate phase vocabulary for the
// Construction Site). The Warehouse Level 2 geometry variant renders only
// when `level >= 2`, which WorldState only ever reaches via a real
// `upgrade.completed` event (worldStateReducer.ts) — never a local toggle.
export function OperationalBuilding({
  buildingType,
  position,
  level = 1,
  indicatorColor,
  indicatorShape,
  selected = false,
  onSelect,
  onHoverChange,
}: {
  buildingType: OperationalBuildingType;
  position: readonly [number, number, number];
  level?: number;
  indicatorColor: string;
  indicatorShape: IndicatorShape;
  selected?: boolean;
  onSelect?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [w, h, d] = BODY_DIMENSIONS[buildingType];
  const scale = hovered ? HOVER_SCALE : 1;
  const isUpgradedWarehouse = buildingType === "warehouse" && level >= 2;
  const indicatorHeight = getOperationalBuildingIndicatorHeight(buildingType, level);

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
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={BODY_COLOR[buildingType]} />
      </mesh>
      {isUpgradedWarehouse && (
        <mesh position={[0, h + 0.6, 0]}>
          <boxGeometry args={[w * 0.8, 1.2, d * 0.8]} />
          <meshStandardMaterial color={BODY_COLOR.warehouse} />
        </mesh>
      )}
      <mesh position={[0, indicatorHeight, 0]}>
        <ShapeGeometry shape={indicatorShape} size={0.3} />
        <meshStandardMaterial
          color={indicatorColor}
          emissive={indicatorColor}
          emissiveIntensity={0.6}
        />
      </mesh>
      {selected && (
        <SelectionRing
          innerRadius={Math.max(w, d) / 2 + 0.15}
          outerRadius={Math.max(w, d) / 2 + 0.35}
        />
      )}
    </group>
  );
}
