import type { Position } from "@foundry/contracts";

const ROAD_WIDTH = 0.6;
const ROAD_COLOR = "#545b66";
const ROAD_HIGHLIGHTED_COLOR = "#facc15";
const ROAD_Y = 0.02; // just above the ground plane — avoids z-fighting.
const CURB_COLOR = "#c9c4b8";
const LANE_MARK_COLOR = "#e8e1cf";

// FBL-018 added the static route graph (docs/02-specification/
// world-model.md → "Road network"); FBL-021 adds the `highlighted` signal
// — color only, no shape/motion change, since a road is never a
// selectable object with its own state label elsewhere to keep a
// non-color signal consistent with (world-model.md: "Path emphasis only
// when transfer ready/in progress"). `highlighted` is driven exclusively
// by `computeActiveRoadSegmentId` (roadNetwork.ts), itself derived only
// from a real Transfer's status — a road can highlight, but this
// component has no path back into WorldState, so it can never *authorize*
// a transfer (world-model.md "Never represents": "proof that a transfer
// exists").
export function Road({
  from,
  to,
  highlighted = false,
}: {
  from: Position;
  to: Position;
  highlighted?: boolean;
}) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  const midX = (from.x + to.x) / 2;
  const midZ = (from.z + to.z) / 2;
  // Y-axis rotation mapping local +X to the world-space direction (dx, dz):
  // three.js's rotation-around-Y maps (1,0,0) -> (cos θ, 0, -sin θ), so
  // θ = atan2(-dz, dx) is the angle that aligns local +X with (dx, dz).
  const angleY = Math.atan2(-dz, dx);
  const dashCount = Math.max(1, Math.floor(length / 1.25));

  return (
    <group position={[midX, ROAD_Y, midZ]} rotation={[0, angleY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, ROAD_WIDTH]} />
        <meshStandardMaterial
          color={highlighted ? ROAD_HIGHLIGHTED_COLOR : ROAD_COLOR}
          emissive={highlighted ? ROAD_HIGHLIGHTED_COLOR : "#000000"}
          emissiveIntensity={highlighted ? 0.4 : 0}
        />
      </mesh>
      <mesh position={[0, 0.03, ROAD_WIDTH / 2 + 0.08]}>
        <boxGeometry args={[length, 0.08, 0.1]} />
        <meshStandardMaterial color={CURB_COLOR} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.03, -ROAD_WIDTH / 2 - 0.08]}>
        <boxGeometry args={[length, 0.08, 0.1]} />
        <meshStandardMaterial color={CURB_COLOR} roughness={0.85} />
      </mesh>
      {Array.from({ length: dashCount }, (_, index) => {
        const x = -length / 2 + ((index + 0.5) / dashCount) * length;
        return (
          <mesh key={index} position={[x, 0.04, 0]}>
            <boxGeometry args={[0.45, 0.025, 0.055]} />
            <meshStandardMaterial
              color={highlighted ? ROAD_HIGHLIGHTED_COLOR : LANE_MARK_COLOR}
              emissive={highlighted ? ROAD_HIGHLIGHTED_COLOR : "#000000"}
              emissiveIntensity={highlighted ? 0.5 : 0}
              roughness={0.72}
            />
          </mesh>
        );
      })}
    </group>
  );
}
