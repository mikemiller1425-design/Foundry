"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useState, useRef } from "react";
import { type Group, type Mesh } from "three";
import { LIGHTHOUSE_VISUALS, type BeaconShape } from "@/lib/world/lighthouseVisuals";
import type { LighthouseState } from "@/lib/world/lighthouseState";
import { useReducedMotion } from "@/lib/world/useReducedMotion";
import { SelectionRing } from "./SelectionRing";
import { FoundryRadialBand } from "./FoundryArchitectureKit";

// FBL-015: selection is never a color-only signal either — a ring at the
// base (shape, not just color) marks the selected object, and it is
// static (no animation), so it stays a valid signal under reduced motion.
const HOVER_SCALE = 1.06;

// FBL-014 — Lighthouse (docs/02-specification/world-model.md → "Lighthouse").
// Simple procedural low-poly placeholder geometry — no interior, no
// production model, no other world objects (residences/buildings/roads
// belong to FBL-016+). Selection is FBL-015's job, not this one.
//
// Every state's visual comes from LIGHTHOUSE_VISUALS (lighthouseVisuals.ts)
// — the same declarative table the unit tests check for distinctness — so
// this component never invents a mapping the tests don't also cover. Two
// independent non-color signals exist: the BEAM (the Lighthouse's defining
// visual feature: visibility + steady/rotating/pulsing motion, originating
// at the lantern) and a small beacon SHAPE at the lantern (an additional
// signal, not a replacement for the beam — shape alone stays distinct even
// under reduced motion, when rotation/pulse are frozen).
const LIGHTHOUSE_POSITION: [number, number, number] = [0, 0, -10];
const LANTERN_HEIGHT = 4.4;
const BEACON_LOCAL_Y = LANTERN_HEIGHT + 0.2;
/** World-space position of the beacon mesh — exported for the screen-projection marker (LighthouseSceneObject.tsx). */
export const BEACON_WORLD_POSITION: [number, number, number] = [
  LIGHTHOUSE_POSITION[0],
  BEACON_LOCAL_Y,
  LIGHTHOUSE_POSITION[2],
];
const BEAM_LENGTH = 6;
const BEAM_BASE_RADIUS = 1.1;

const TOWER_COLOR = "#5b6478";
const TOWER_COLOR_DISCONNECTED = "#2a2f3a";
const LANTERN_COLOR = "#333c52";

function BeaconGeometry({ shape }: { shape: BeaconShape }) {
  switch (shape) {
    case "icosahedron":
      return <icosahedronGeometry args={[0.4, 0]} />;
    case "torus":
      return <torusGeometry args={[0.35, 0.14, 6, 12]} />;
    case "cone":
      return <coneGeometry args={[0.4, 0.7, 5]} />;
    case "box":
      return <boxGeometry args={[0.6, 0.6, 0.6]} />;
    case "octahedron":
      return <octahedronGeometry args={[0.45, 0]} />;
    case "tetrahedron":
      return <tetrahedronGeometry args={[0.3, 0]} />;
  }
}

function Beacon({ state }: { state: LighthouseState }) {
  const meshRef = useRef<Mesh>(null);
  const reducedMotion = useReducedMotion();
  const spec = LIGHTHOUSE_VISUALS[state];

  useFrame((_three, delta) => {
    const mesh = meshRef.current;
    if (!mesh || reducedMotion) return;
    if (spec.beamMotion === "rotating") {
      mesh.rotation.y += delta * spec.rotationSpeed;
    } else if (spec.beamMotion === "pulsing") {
      const scale = 1 + Math.sin(performance.now() * 0.001 * spec.pulseSpeed) * 0.15;
      mesh.scale.setScalar(scale);
    }
  });

  const emissiveIntensity = state === "disconnected" ? 0 : 0.9;

  return (
    <mesh ref={meshRef} position={[0, BEACON_LOCAL_Y, 0]}>
      <BeaconGeometry shape={spec.shape} />
      <meshStandardMaterial
        color={spec.color}
        emissive={spec.color}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

/**
 * The beam: originates at the lantern and extends outward. Steady states
 * hold a fixed heading; rotating states sweep continuously around Y
 * (frozen under reduced motion); pulsing states hold a fixed heading but
 * oscillate opacity/scale (also frozen under reduced motion); disconnected
 * renders no beam at all ("beam dark").
 */
function Beam({ state }: { state: LighthouseState }) {
  const groupRef = useRef<Group>(null);
  const coneRef = useRef<Mesh>(null);
  const reducedMotion = useReducedMotion();
  const spec = LIGHTHOUSE_VISUALS[state];

  useFrame((_three, delta) => {
    if (reducedMotion) return;
    if (spec.beamMotion === "rotating" && groupRef.current) {
      groupRef.current.rotation.y += delta * spec.rotationSpeed;
    } else if (spec.beamMotion === "pulsing" && coneRef.current) {
      const material = coneRef.current.material as { opacity: number };
      const pulse = 0.35 + (Math.sin(performance.now() * 0.001 * spec.pulseSpeed) + 1) * 0.2;
      material.opacity = pulse;
    }
  });

  if (!spec.beamVisible) return null;

  return (
    <group ref={groupRef} position={[0, LANTERN_HEIGHT, 0]}>
      <mesh ref={coneRef} position={[BEAM_LENGTH / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[BEAM_BASE_RADIUS, BEAM_LENGTH, 4]} />
        <meshBasicMaterial color={spec.color} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Lighthouse({
  state,
  selected = false,
  onSelect,
  onHoverChange,
}: {
  state: LighthouseState;
  selected?: boolean;
  onSelect?: () => void;
  onHoverChange?: (hovered: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const towerColor = state === "disconnected" ? TOWER_COLOR_DISCONNECTED : TOWER_COLOR;
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
      position={LIGHTHOUSE_POSITION}
      scale={scale}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <mesh receiveShadow position={[0, 0.1, 0]}>
        <cylinderGeometry args={[1.22, 1.35, 0.2, 16]} />
        <meshStandardMaterial color="#263349" roughness={0.92} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <cylinderGeometry args={[0.5, 0.9, 4, 8]} />
        <meshStandardMaterial color={towerColor} roughness={0.78} />
      </mesh>
      <FoundryRadialBand radius={1.02} y={0.23} opacity={0.66} />
      <FoundryRadialBand radius={0.72} y={3.7} opacity={0.42} />
      <mesh castShadow position={[0, LANTERN_HEIGHT - 0.62, 0]}>
        <torusGeometry args={[0.68, 0.08, 8, 20]} />
        <meshStandardMaterial color="#93a5bd" metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, LANTERN_HEIGHT - 0.25, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.9]} />
        <meshStandardMaterial color={LANTERN_COLOR} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, LANTERN_HEIGHT + 0.16, 0]}>
        <coneGeometry args={[0.72, 0.46, 8]} />
        <meshStandardMaterial color="#253044" metalness={0.18} roughness={0.62} />
      </mesh>
      <Beam state={state} />
      <Beacon state={state} />
      {selected && <SelectionRing innerRadius={1.15} outerRadius={1.35} />}
      {hovered && !selected && (
        <SelectionRing innerRadius={1.12} outerRadius={1.3} color="#64d8ff" opacity={0.72} />
      )}
    </group>
  );
}
