"use client";

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

const BACKGROUND_COLOR = "#151a24";
// The canonical camera sits ~24 units from its target (cameraMath.ts) and
// can zoom to 40, so fog must stay out of the way well past that before
// it starts fading anything — otherwise most of the visible ground reads
// as fogged-out background instead of a legible surface. Near/far were
// originally tuned without accounting for that and washed the ground out
// almost entirely; this range keeps the whole camera-reachable area clear
// and only fades the true distant edges into the background.
const FOG_NEAR = 45;
const FOG_FAR = 160;
const GROUND_COLOR = "#333c52";
const GROUND_SIZE = 200;
const GRID_COLOR = "#5b6478";
const GRID_CENTER_LINE_COLOR = "#8b95ab";
const GRID_DIVISIONS = 40;
const DISTRICT_PAD_COLOR = "#3f495f";
const SIDEWALK_COLOR = "#b9b5aa";
const PLAZA_COLOR = "#8f8576";
const PLANTER_COLOR = "#2f5d4b";

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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[position[0], position[1], position[2]]}>
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

export function Environment() {
  return (
    <>
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <fog attach="fog" args={[BACKGROUND_COLOR, FOG_NEAR, FOG_FAR]} />

      {/* Ambient fill keeps shadowed faces legible (never pure black),
          so a future object's non-lit side never reads as "no state". */}
      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#dbeafe", "#273042", 0.45]} />
      {/* Key light: fixed position (no day/night cycle — a static "always
          readable" direction, not a simulation of real sunlight). */}
      <directionalLight position={[12, 20, 8]} intensity={1.4} color="#fff7ed" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color={GROUND_COLOR} />
      </mesh>
      {/* GridHelper (a three.js built-in line primitive, not a texture)
          gives scale/orientation depth cues without any imported asset. */}
      <gridHelper
        args={[GROUND_SIZE, GRID_DIVISIONS, GRID_CENTER_LINE_COLOR, GRID_COLOR]}
        position={[0, 0.01, 0]}
      />
      <CityBlock position={[-4, 0.012, 4]} size={[10, 4.4]} />
      <CityBlock position={[6, 0.012, 0]} size={[8.8, 4.2]} />
      <CityBlock position={[-12, 0.012, -2]} size={[4.4, 4.6]} />
      <CityBlock position={[12, 0.012, 0]} size={[3.8, 4.4]} />
      <StreetFurniture />
    </>
  );
}
