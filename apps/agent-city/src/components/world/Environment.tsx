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

export function Environment() {
  return (
    <>
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <fog attach="fog" args={[BACKGROUND_COLOR, FOG_NEAR, FOG_FAR]} />

      {/* Ambient fill keeps shadowed faces legible (never pure black),
          so a future object's non-lit side never reads as "no state". */}
      <ambientLight intensity={0.75} />
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
    </>
  );
}
