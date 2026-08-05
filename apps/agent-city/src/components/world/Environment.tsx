"use client";

import { atmosphereById, type AtmosphereMode } from "@/lib/world/atmosphere";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

// FBL-013 — minimal readable neighborhood environment
// (docs/02-specification/world-model.md global rules: "Readable at
// 5120×1440, 3840×1080, and 2560×1440"; "Color is never the only status
// signal"). Restrained, low-poly, stylized-operational direction: flat
// color background/ground/lights, no textures, no weather, no day/night
// cycle, no geometry beyond the ground plane — buildings and the
// Lighthouse are later rungs (FBL-014+). Fog (not a literal sky dome or
// distant geometry) is what supplies the horizon/depth cue here: it fades
// the ground plane into the background color at distance, so there is no
// abrupt visible edge no matter how the camera pans within its bounds.

// The canonical camera sits ~24 units from its target (cameraMath.ts) and
// can zoom to 40, so fog must stay out of the way well past that before
// it starts fading anything — otherwise most of the visible ground reads
// as fogged-out background instead of a legible surface. Near/far were
// originally tuned without accounting for that and washed the ground out
// almost entirely; this range keeps the whole camera-reachable area clear
// and only fades the true distant edges into the background.
const FOG_NEAR = 38;
const FOG_FAR = 110;
const GROUND_SIZE = 120;
const GRID_SIZE = 58;
const GRID_CENTER_LINE_COLOR = "#60718d";
const GRID_DIVISIONS = 29;
const DISTRICT_PAD_COLOR = "#344158";
const SIDEWALK_COLOR = "#a9adac";
const PLAZA_COLOR = "#716f6d";
const PLANTER_COLOR = "#244f43";
const DISTRICT_RADIUS = 29;

function GroundPlane({
  position,
  size,
  color,
}: {
  position: readonly [number, number, number];
  size: readonly [number, number];
  color: string;
}) {
  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[position[0], position[1], position[2]]}
    >
      <planeGeometry args={[size[0], size[1]]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function CityBlock({
  position,
  size,
}: {
  position: readonly [number, number, number];
  size: readonly [number, number];
}) {
  return (
    <>
      <GroundPlane position={position} size={size} color={DISTRICT_PAD_COLOR} />
      <mesh position={[position[0], position[1] + 0.03, position[2] + size[1] / 2]}>
        <boxGeometry args={[size[0], 0.08, 0.12]} />
        <meshStandardMaterial color={SIDEWALK_COLOR} roughness={0.85} />
      </mesh>
      <mesh position={[position[0], position[1] + 0.03, position[2] - size[1] / 2]}>
        <boxGeometry args={[size[0], 0.08, 0.12]} />
        <meshStandardMaterial color={SIDEWALK_COLOR} roughness={0.85} />
      </mesh>
      <mesh position={[position[0] + size[0] / 2, position[1] + 0.03, position[2]]}>
        <boxGeometry args={[0.12, 0.08, size[1]]} />
        <meshStandardMaterial color={SIDEWALK_COLOR} roughness={0.85} />
      </mesh>
      <mesh position={[position[0] - size[0] / 2, position[1] + 0.03, position[2]]}>
        <boxGeometry args={[0.12, 0.08, size[1]]} />
        <meshStandardMaterial color={SIDEWALK_COLOR} roughness={0.85} />
      </mesh>
    </>
  );
}

function StreetFurniture() {
  const bollards = [
    [-6.2, 3.3],
    [-5.6, 3.3],
    [-5, 3.3],
    [2.8, -0.9],
    [3.4, -0.9],
    [10.7, 1.2],
    [11.3, 1.2],
  ] as const;

  return (
    <>
      <GroundPlane position={[12, 0.018, -1.8]} size={[3.2, 2.2]} color={PLAZA_COLOR} />
      <mesh position={[12, 0.12, -1.8]}>
        <cylinderGeometry args={[0.52, 0.52, 0.18, 24]} />
        <meshStandardMaterial color="#a49a8a" roughness={0.82} />
      </mesh>
      <mesh position={[-12, 0.1, -4.2]}>
        <boxGeometry args={[3.2, 0.2, 1.1]} />
        <meshStandardMaterial color={PLANTER_COLOR} roughness={0.92} />
      </mesh>
      <mesh position={[-12, 0.42, -4.2]}>
        <boxGeometry args={[2.7, 0.38, 0.74]} />
        <meshStandardMaterial color="#4f8f6b" roughness={0.95} />
      </mesh>
      {bollards.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.22, z]}>
          <cylinderGeometry args={[0.07, 0.07, 0.36, 10]} />
          <meshStandardMaterial color="#d0c7b8" roughness={0.72} />
        </mesh>
      ))}
    </>
  );
}

function DistrictFoundation() {
  return (
    <>
      <mesh receiveShadow position={[0, -0.14, -2]}>
        <cylinderGeometry args={[DISTRICT_RADIUS, DISTRICT_RADIUS + 0.7, 0.26, 64]} />
        <meshStandardMaterial color="#182438" roughness={0.94} metalness={0.04} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -2]}>
        <ringGeometry args={[DISTRICT_RADIUS - 0.18, DISTRICT_RADIUS, 64]} />
        <meshBasicMaterial color="#6fdcff" transparent opacity={0.3} />
      </mesh>
    </>
  );
}

function DistrictLandscape() {
  const trees = [
    [-15.5, -6.2],
    [-14.2, -6.9],
    [-11.1, 1.6],
    [-9.9, 1.9],
    [8.7, 3.6],
    [9.9, 3.4],
    [14.7, -4.4],
    [15.8, -4.9],
  ] as const;
  const lamps = [
    [-8, 1.5],
    [-1, 1.8],
    [5.6, -3],
    [10.5, -4.5],
  ] as const;

  return (
    <>
      {trees.map(([x, z]) => (
        <group key={`tree-${x}-${z}`} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.1, 0.14, 1.1, 8]} />
            <meshStandardMaterial color="#6c5545" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 1.28, 0]}>
            <coneGeometry args={[0.58, 1.35, 8]} />
            <meshStandardMaterial color="#2d725c" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {lamps.map(([x, z]) => (
        <group key={`lamp-${x}-${z}`} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.035, 0.055, 1.6, 8]} />
            <meshStandardMaterial color="#65738a" roughness={0.68} metalness={0.35} />
          </mesh>
          <mesh position={[0, 1.62, 0]}>
            <sphereGeometry args={[0.11, 10, 8]} />
            <meshStandardMaterial color="#e7f7ff" emissive="#78dfff" emissiveIntensity={1.1} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function AmbientHorizon({ color, motion }: { color: string; motion: boolean }) {
  const groupRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!motion || !groupRef.current) return;
    groupRef.current.rotation.y = clock.elapsedTime * 0.018;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.32) * 0.12;
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2;
        const radius = 24 + (index % 3) * 1.4;
        return (
          <mesh
            key={index}
            position={[
              Math.cos(angle) * radius,
              2.2 + (index % 4) * 0.42,
              Math.sin(angle) * radius,
            ]}
          >
            <sphereGeometry args={[0.055 + (index % 3) * 0.018, 8, 6]} />
            <meshBasicMaterial color={color} transparent opacity={0.48} />
          </mesh>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, -2]}>
        <ringGeometry args={[27.7, 27.78, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

export function Environment({
  atmosphereMode = "focus",
  ambientMotion = false,
}: {
  atmosphereMode?: AtmosphereMode;
  ambientMotion?: boolean;
}) {
  const atmosphere = atmosphereById(atmosphereMode);
  return (
    <>
      <color attach="background" args={[atmosphere.background]} />
      <fog attach="fog" args={[atmosphere.fog, FOG_NEAR, FOG_FAR]} />

      {/* Ambient fill keeps shadowed faces legible (never pure black),
          so a future object's non-lit side never reads as "no state". */}
      <ambientLight intensity={0.58} />
      <hemisphereLight args={[atmosphere.hemisphereSky, "#172238", 0.62]} />
      {/* Key light: fixed position (no day/night cycle — a static "always
          readable" direction, not a simulation of real sunlight). */}
      <directionalLight
        castShadow
        position={[14, 22, 10]}
        intensity={1.65}
        color={atmosphere.keyLight}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={70}
      />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color={atmosphere.ground} roughness={1} />
      </mesh>
      <DistrictFoundation />
      {/* GridHelper (a three.js built-in line primitive, not a texture)
          gives scale/orientation depth cues without any imported asset. */}
      <gridHelper
        args={[GRID_SIZE, GRID_DIVISIONS, GRID_CENTER_LINE_COLOR, atmosphere.grid]}
        position={[0, 0.008, -2]}
      />
      <CityBlock position={[-4, 0.012, 4]} size={[10, 4.4]} />
      <CityBlock position={[6, 0.012, 0]} size={[8.8, 4.2]} />
      <CityBlock position={[-12, 0.012, -2]} size={[4.4, 4.6]} />
      <CityBlock position={[12, 0.012, 0]} size={[3.8, 4.4]} />
      <StreetFurniture />
      <DistrictLandscape />
      <AmbientHorizon color={atmosphere.ambientSignal} motion={ambientMotion} />
    </>
  );
}
