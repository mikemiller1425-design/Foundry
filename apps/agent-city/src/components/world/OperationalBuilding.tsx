"use client";

import { type ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import type { BuildingType } from "@foundry/contracts";
import { ShapeGeometry, type IndicatorShape } from "./ShapeGeometry";
import { SelectionRing } from "./SelectionRing";
import { FoundryCornerFins, FoundryPlinthBand } from "./FoundryArchitectureKit";

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

const ACCENT_COLOR: Record<OperationalBuildingType, string> = {
  construction_office: "#d6c6a8",
  warehouse: "#c4b18a",
  qa: "#9ad6dd",
  deployment_dock: "#f0b35a",
  construction_site: "#f2c94c",
};

const DARK_TRIM = "#222831";
const GLASS_COLOR = "#8fd6e8";
const WINDOW_DARK = "#111827";
const CONCRETE_COLOR = "#c4c0b6";
const METAL_COLOR = "#4b5563";

function BoxPart({
  position,
  args,
  color,
  emissive = "#000000",
  emissiveIntensity = 0,
  rotation = [0, 0, 0],
}: {
  position: readonly [number, number, number];
  args: readonly [number, number, number];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  rotation?: readonly [number, number, number];
}) {
  return (
    <mesh
      castShadow
      receiveShadow
      position={[position[0], position[1], position[2]]}
      rotation={[rotation[0], rotation[1], rotation[2]]}
    >
      <boxGeometry args={[args[0], args[1], args[2]]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={0.82}
      />
    </mesh>
  );
}

function WindowRow({
  z,
  y,
  count,
  width,
  litColor,
}: {
  z: number;
  y: number;
  count: number;
  width: number;
  litColor: string;
}) {
  const spacing = width / (count + 1);
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const x = -width / 2 + spacing * (index + 1);
        const lit = index % 2 === 0;
        return (
          <mesh key={`${z}-${index}`} position={[x, y, z]}>
            <boxGeometry args={[0.28, 0.28, 0.04]} />
            <meshStandardMaterial
              color={lit ? litColor : WINDOW_DARK}
              emissive={lit ? litColor : "#000000"}
              emissiveIntensity={lit ? 0.35 : 0}
              roughness={0.35}
            />
          </mesh>
        );
      })}
    </>
  );
}

function ConstructionOfficeDetails() {
  return (
    <>
      <BoxPart position={[0, 1.72, 0]} args={[2.45, 0.22, 1.85]} color={DARK_TRIM} />
      <BoxPart position={[-0.7, 0.98, 0.95]} args={[0.52, 0.76, 0.08]} color="#1f2937" />
      <BoxPart
        position={[0.36, 1.06, 0.95]}
        args={[0.72, 0.36, 0.08]}
        color={GLASS_COLOR}
        emissive={GLASS_COLOR}
        emissiveIntensity={0.18}
      />
      <BoxPart
        position={[0.95, 1.06, 0.95]}
        args={[0.38, 0.36, 0.08]}
        color={GLASS_COLOR}
        emissive={GLASS_COLOR}
        emissiveIntensity={0.18}
      />
      <BoxPart
        position={[0.05, 1.5, 1.02]}
        args={[1.1, 0.14, 0.08]}
        color={ACCENT_COLOR.construction_office}
        emissive={ACCENT_COLOR.construction_office}
        emissiveIntensity={0.12}
      />
      <BoxPart position={[-1.25, 0.55, -0.25]} args={[0.75, 1.1, 1.05]} color="#6f675d" />
      <BoxPart position={[0, 0.08, 1.05]} args={[2.6, 0.16, 0.42]} color={CONCRETE_COLOR} />
      <BoxPart position={[0.65, 0.32, 1.23]} args={[0.95, 0.16, 0.32]} color="#a88f66" />
    </>
  );
}

function WarehouseDetails({ level }: { level: number }) {
  const isUpgraded = level >= 2;
  return (
    <>
      <BoxPart position={[0, 1.94, 0]} args={[3.25, 0.28, 2.45]} color={DARK_TRIM} />
      <BoxPart position={[-0.85, 0.74, 1.13]} args={[0.74, 0.86, 0.08]} color="#394150" />
      <BoxPart position={[0.05, 0.74, 1.13]} args={[0.74, 0.86, 0.08]} color="#394150" />
      <BoxPart position={[0.95, 0.74, 1.13]} args={[0.74, 0.86, 0.08]} color="#394150" />
      <WindowRow z={-1.13} y={1.42} count={5} width={2.4} litColor="#fef3c7" />
      <BoxPart
        position={[-0.72, 2.16, 0]}
        args={[0.42, 0.28, 2.1]}
        color="#a8b6c8"
        emissive="#a8b6c8"
        emissiveIntensity={0.08}
        rotation={[0, 0, -0.18]}
      />
      <BoxPart
        position={[0.18, 2.16, 0]}
        args={[0.42, 0.28, 2.1]}
        color="#a8b6c8"
        emissive="#a8b6c8"
        emissiveIntensity={0.08}
        rotation={[0, 0, -0.18]}
      />
      <BoxPart
        position={[1.08, 2.16, 0]}
        args={[0.42, 0.28, 2.1]}
        color="#a8b6c8"
        emissive="#a8b6c8"
        emissiveIntensity={0.08}
        rotation={[0, 0, -0.18]}
      />
      {isUpgraded && (
        <>
          <BoxPart position={[0.92, 2.72, -0.2]} args={[0.82, 1.28, 1.16]} color="#686158" />
          <WindowRow z={0.4} y={2.72} count={2} width={0.62} litColor="#fef3c7" />
        </>
      )}
    </>
  );
}

function QaDetails() {
  return (
    <>
      <BoxPart position={[0, 1.86, 0]} args={[2.24, 0.18, 1.84]} color="#e5eef0" />
      <BoxPart
        position={[0, 1.05, 0.84]}
        args={[1.58, 1.02, 0.08]}
        color={GLASS_COLOR}
        emissive={GLASS_COLOR}
        emissiveIntensity={0.24}
      />
      <BoxPart
        position={[0, 1.05, -0.84]}
        args={[1.58, 1.02, 0.08]}
        color="#5fb3c0"
        emissive="#5fb3c0"
        emissiveIntensity={0.14}
      />
      <BoxPart position={[-1.12, 0.92, 0]} args={[0.16, 1.38, 1.78]} color="#dbe7ea" />
      <BoxPart position={[1.12, 0.92, 0]} args={[0.16, 1.38, 1.78]} color="#dbe7ea" />
      <BoxPart position={[0, 0.08, 1.08]} args={[1.5, 0.16, 0.36]} color={CONCRETE_COLOR} />
      <mesh position={[0.74, 2.18, -0.48]}>
        <cylinderGeometry args={[0.24, 0.24, 0.34, 16]} />
        <meshStandardMaterial
          color="#d9f4f7"
          emissive="#9ad6dd"
          emissiveIntensity={0.12}
          roughness={0.3}
        />
      </mesh>
    </>
  );
}

function DeploymentDockDetails() {
  return (
    <>
      <BoxPart position={[0, 1.52, 0]} args={[2.82, 0.18, 2.02]} color={DARK_TRIM} />
      <BoxPart position={[0, 0.18, 1.16]} args={[3.35, 0.28, 0.52]} color="#55504a" />
      <BoxPart position={[-1.32, 1.25, 1.02]} args={[0.16, 1.86, 0.16]} color={METAL_COLOR} />
      <BoxPart position={[1.32, 1.25, 1.02]} args={[0.16, 1.86, 0.16]} color={METAL_COLOR} />
      <BoxPart position={[0, 2.12, 1.02]} args={[2.84, 0.16, 0.16]} color={METAL_COLOR} />
      <BoxPart
        position={[0, 1.68, 1.02]}
        args={[2.1, 0.12, 0.12]}
        color={ACCENT_COLOR.deployment_dock}
        emissive={ACCENT_COLOR.deployment_dock}
        emissiveIntensity={0.18}
      />
      <BoxPart position={[-0.5, 0.78, 1.03]} args={[0.62, 0.78, 0.08]} color="#262b32" />
      <BoxPart position={[0.38, 0.78, 1.03]} args={[0.62, 0.78, 0.08]} color="#262b32" />
      <BoxPart position={[1.03, 0.2, -0.72]} args={[0.4, 0.4, 0.4]} color="#c47f45" />
    </>
  );
}

function ConstructionSiteDetails() {
  return (
    <>
      <BoxPart position={[0, 0.16, 0]} args={[2.2, 0.32, 2.2]} color="#a9a49a" />
      <BoxPart position={[-0.66, 0.9, -0.66]} args={[0.16, 1.48, 0.16]} color={METAL_COLOR} />
      <BoxPart position={[0.66, 0.9, -0.66]} args={[0.16, 1.48, 0.16]} color={METAL_COLOR} />
      <BoxPart position={[-0.66, 0.9, 0.66]} args={[0.16, 1.48, 0.16]} color={METAL_COLOR} />
      <BoxPart position={[0.66, 0.9, 0.66]} args={[0.16, 1.48, 0.16]} color={METAL_COLOR} />
      <BoxPart
        position={[0, 1.58, -0.66]}
        args={[1.48, 0.14, 0.14]}
        color={ACCENT_COLOR.construction_site}
      />
      <BoxPart
        position={[0, 1.58, 0.66]}
        args={[1.48, 0.14, 0.14]}
        color={ACCENT_COLOR.construction_site}
      />
      <BoxPart
        position={[-0.66, 1.58, 0]}
        args={[0.14, 0.14, 1.48]}
        color={ACCENT_COLOR.construction_site}
      />
      <BoxPart position={[0.92, 1.46, -0.12]} args={[0.12, 2.18, 0.12]} color="#d79a2b" />
      <BoxPart position={[1.5, 2.48, -0.12]} args={[1.28, 0.12, 0.12]} color="#d79a2b" />
      <BoxPart position={[-0.78, 0.32, 1.22]} args={[0.52, 0.38, 0.36]} color="#c47f45" />
      <BoxPart position={[-0.08, 0.26, 1.2]} args={[0.56, 0.28, 0.36]} color="#8b7358" />
    </>
  );
}

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
  if (buildingType === "construction_site") return 2.9;
  if (buildingType === "deployment_dock") return 2.55;
  if (buildingType === "qa") return 2.65;
  const isUpgradedWarehouse = buildingType === "warehouse" && level >= 2;
  return h + (isUpgradedWarehouse ? 1.5 : 0.3);
}

function BuildingArchitecture({
  buildingType,
  level,
}: {
  buildingType: OperationalBuildingType;
  level: number;
}) {
  if (buildingType === "construction_office") return <ConstructionOfficeDetails />;
  if (buildingType === "warehouse") return <WarehouseDetails level={level} />;
  if (buildingType === "qa") return <QaDetails />;
  if (buildingType === "deployment_dock") return <DeploymentDockDetails />;
  return <ConstructionSiteDetails />;
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
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={BODY_COLOR[buildingType]} roughness={0.86} />
      </mesh>
      <BuildingArchitecture buildingType={buildingType} level={level} />
      {buildingType !== "construction_site" && (
        <>
          <FoundryPlinthBand width={w + 0.18} depth={d + 0.18} />
          <FoundryCornerFins width={w + 0.12} depth={d + 0.12} height={h * 0.72} y={h * 0.5} />
        </>
      )}
      {buildingType !== "construction_site" && (
        <BoxPart position={[0, 0.04, 0]} args={[w + 0.35, 0.08, d + 0.35]} color={CONCRETE_COLOR} />
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
      {hovered && !selected && (
        <SelectionRing
          innerRadius={Math.max(w, d) / 2 + 0.12}
          outerRadius={Math.max(w, d) / 2 + 0.27}
          color="#64d8ff"
          opacity={0.7}
        />
      )}
    </group>
  );
}
