"use client";

import { type ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import { ShapeGeometry } from "./ShapeGeometry";
import { SelectionRing } from "./SelectionRing";
import { RESIDENCE_VISUALS } from "@/lib/world/residenceVisuals";
import type { ResidenceState } from "@/lib/world/residenceState";
import type { ResidenceIdentity } from "@/lib/world/residenceIdentity";
import {
  FOUNDRY_ARCHITECTURE,
  FoundryCornerFins,
  FoundryPlinthBand,
  FoundryRadialBand,
} from "./FoundryArchitectureKit";

const HOVER_SCALE = 1.06;
const BODY_COLOR = "#7a7266";
const ROOF_COLOR = "#4b453c";
const TRIM_COLOR = "#d7c8aa";
const FOUNDATION_COLOR = "#bbb4a8";
const PORCH_COLOR = "#a88f66";
const CHIMNEY_COLOR = "#5b5047";

function ResidenceIdentityDetails({ identity }: { identity: ResidenceIdentity }) {
  if (identity === "architect") {
    return (
      <>
        <mesh castShadow position={[-0.58, 1.48, -0.22]}>
          <boxGeometry args={[0.32, 0.78, 0.46]} />
          <meshStandardMaterial color="#34465f" metalness={0.18} roughness={0.58} />
        </mesh>
        <mesh position={[-0.58, 1.5, 0.02]}>
          <boxGeometry args={[0.2, 0.4, 0.025]} />
          <meshStandardMaterial color="#9de8ff" emissive="#64d8ff" emissiveIntensity={0.26} />
        </mesh>
      </>
    );
  }
  if (identity === "builder") {
    return (
      <>
        <mesh castShadow position={[0, 1.34, 0.98]} rotation={[0.16, 0, 0]}>
          <boxGeometry args={[1.5, 0.12, 0.55]} />
          <meshStandardMaterial color="#71583b" metalness={0.12} roughness={0.66} />
        </mesh>
        <mesh position={[0, 1.29, 1.21]}>
          <boxGeometry args={[1.08, 0.055, 0.06]} />
          <meshStandardMaterial
            color={FOUNDRY_ARCHITECTURE.civicAmber}
            emissive={FOUNDRY_ARCHITECTURE.civicAmber}
            emissiveIntensity={0.3}
          />
        </mesh>
      </>
    );
  }
  return (
    <group position={[0.48, 1.72, -0.25]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.31, 0.38, 0.72, 8]} />
        <meshStandardMaterial color="#3e5961" metalness={0.22} roughness={0.52} />
      </mesh>
      <FoundryRadialBand radius={0.34} y={0.18} />
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.38, 0.3, 8]} />
        <meshStandardMaterial color="#24343f" roughness={0.62} />
      </mesh>
    </group>
  );
}

// FBL-016 — Architect / Builder / Inspector residences
// (docs/02-specification/world-model.md → "Architect / Builder / Inspector
// residences"). Simple procedural low-poly house — no interior. A
// residence never represents active work (Principle 7 / this rung's own
// "never represents" rule), so its body/roof never change with state; only
// the window (lit/unlit) and a small distinct indicator shape at the
// ridge, driven entirely by RESIDENCE_VISUALS (residenceVisuals.ts) — the
// same declarative-table pattern the unit tests check for distinctness.
export function Residence({
  position,
  identity,
  state,
  selected = false,
  onSelect,
  onHoverChange,
}: {
  position: readonly [number, number, number];
  identity: ResidenceIdentity;
  state: ResidenceState;
  selected?: boolean;
  onSelect?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const spec = RESIDENCE_VISUALS[state];
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
      <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
        <boxGeometry args={[1.4, 1.2, 1.4]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.15, 0.8, 4]} />
        <meshStandardMaterial color={ROOF_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.7, 0.16, 1.7]} />
        <meshStandardMaterial color={FOUNDATION_COLOR} roughness={0.8} />
      </mesh>
      <FoundryPlinthBand width={1.56} depth={1.56} y={0.18} />
      <FoundryCornerFins width={1.46} depth={1.46} height={0.72} y={0.56} />
      <ResidenceIdentityDetails identity={identity} />
      <mesh position={[0, 0.18, 0.92]}>
        <boxGeometry args={[1.15, 0.18, 0.45]} />
        <meshStandardMaterial color={PORCH_COLOR} roughness={0.75} />
      </mesh>
      <mesh position={[-0.42, 0.48, 0.94]}>
        <boxGeometry args={[0.12, 0.62, 0.12]} />
        <meshStandardMaterial color={TRIM_COLOR} />
      </mesh>
      <mesh position={[0.42, 0.48, 0.94]}>
        <boxGeometry args={[0.12, 0.62, 0.12]} />
        <meshStandardMaterial color={TRIM_COLOR} />
      </mesh>
      <mesh position={[0, 0.84, 0.94]}>
        <boxGeometry args={[1, 0.12, 0.12]} />
        <meshStandardMaterial color={TRIM_COLOR} />
      </mesh>
      <mesh position={[0.74, 1.55, -0.26]}>
        <boxGeometry args={[0.22, 0.62, 0.22]} />
        <meshStandardMaterial color={CHIMNEY_COLOR} roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.55, 0.71]}>
        <planeGeometry args={[0.4, 0.4]} />
        <meshStandardMaterial
          color={spec.windowLit ? spec.color : "#1c1c1e"}
          emissive={spec.windowLit ? spec.color : "#000000"}
          emissiveIntensity={spec.windowLit ? 0.8 : 0}
        />
      </mesh>
      <mesh position={[-0.52, 0.88, 0.72]}>
        <planeGeometry args={[0.28, 0.32]} />
        <meshStandardMaterial
          color={spec.windowLit ? spec.color : "#20242b"}
          emissive={spec.windowLit ? spec.color : "#000000"}
          emissiveIntensity={spec.windowLit ? 0.45 : 0}
        />
      </mesh>
      <mesh position={[0.52, 0.88, 0.72]}>
        <planeGeometry args={[0.28, 0.32]} />
        <meshStandardMaterial
          color={spec.windowLit ? spec.color : "#20242b"}
          emissive={spec.windowLit ? spec.color : "#000000"}
          emissiveIntensity={spec.windowLit ? 0.45 : 0}
        />
      </mesh>
      <mesh position={[-0.86, 0.38, 0.55]}>
        <boxGeometry args={[0.16, 0.48, 0.16]} />
        <meshStandardMaterial color="#6b5a44" roughness={0.8} />
      </mesh>
      <mesh position={[-0.86, 0.66, 0.55]}>
        <boxGeometry args={[0.42, 0.08, 0.08]} />
        <meshStandardMaterial color={spec.color} emissive={spec.color} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 2.05, 0]}>
        <ShapeGeometry shape={spec.shape} size={0.28} />
        <meshStandardMaterial color={spec.color} emissive={spec.color} emissiveIntensity={0.6} />
      </mesh>
      {selected && <SelectionRing innerRadius={0.95} outerRadius={1.15} />}
      {hovered && !selected && (
        <SelectionRing innerRadius={0.92} outerRadius={1.08} color="#64d8ff" opacity={0.7} />
      )}
    </group>
  );
}
