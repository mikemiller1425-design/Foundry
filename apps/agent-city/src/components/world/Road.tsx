import type { Position } from "@foundry/contracts";

const ROAD_WIDTH = 0.6;
const ROAD_COLOR = "#9ca3af";
const ROAD_Y = 0.02; // just above the ground plane — avoids z-fighting.

// FBL-018 — Road network (docs/02-specification/world-model.md → "Road
// network"). Static geometry only: a flat rectangle between two building
// positions. Ambient, non-interactive — roads are "informational; selection
// optional" and, per this rung's own scope boundary, carry no dynamic
// available/highlighted/inactive state until FBL-021 wires it to
// `transfer.*` events; every segment renders identically today. Never
// implies a transfer exists (world-model.md "Never represents": "proof that
// a transfer exists").
export function Road({ from, to }: { from: Position; to: Position }) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  const midX = (from.x + to.x) / 2;
  const midZ = (from.z + to.z) / 2;
  // Y-axis rotation mapping local +X to the world-space direction (dx, dz):
  // three.js's rotation-around-Y maps (1,0,0) -> (cos θ, 0, -sin θ), so
  // θ = atan2(-dz, dx) is the angle that aligns local +X with (dx, dz).
  const angleY = Math.atan2(-dz, dx);

  return (
    <group position={[midX, ROAD_Y, midZ]} rotation={[0, angleY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, ROAD_WIDTH]} />
        <meshStandardMaterial color={ROAD_COLOR} />
      </mesh>
    </group>
  );
}
