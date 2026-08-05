import { DoubleSide } from "three";

// Shared selection-ring mesh, generalizing the ring Lighthouse.tsx (FBL-014
// / FBL-015) introduced for its own selected state. A shape (ring), not a
// color change, so it survives reduced motion and is never confused with
// any state's own color — the same rule applied here for every FBL-016+
// selectable object rather than re-deriving it per object type.
const SELECTION_RING_COLOR = "#4ade80";

export function SelectionRing({
  innerRadius = 1.15,
  outerRadius = 1.35,
  y = 0.05,
  color = SELECTION_RING_COLOR,
  opacity = 1,
}: {
  innerRadius?: number;
  outerRadius?: number;
  y?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[innerRadius, outerRadius, 24]} />
      <meshBasicMaterial
        color={color}
        side={DoubleSide}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}
