import { ShapeGeometry, type IndicatorShape } from "./ShapeGeometry";

const CRATE_COLOR = "#8b7355";

// FBL-021 — Cargo (docs/02-specification/world-model.md → "Cargo",
// v1-scope.md § "Required world elements": "One cargo representation").
// A simple crate sitting at the Warehouse (the "Inventory for packages,
// stage bundles, transfer-ready items" hub, per world-model.md's own
// Warehouse description) — position is fixed; only the indicator
// shape/color changes with state (cargoState.ts / cargoVisuals.ts), so a
// claim about "cargo sealed" is always backed by the same state the 2D
// detail surfaces would read. Non-interactive: not part of the FBL-015
// selection framework — Cargo represents a fact about the current build,
// not an independently selectable operational entity.
export function Cargo({
  position,
  indicatorColor,
  indicatorShape,
  sealed,
}: {
  position: readonly [number, number, number];
  indicatorColor: string;
  indicatorShape: IndicatorShape;
  sealed: boolean;
}) {
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color={CRATE_COLOR} wireframe={!sealed} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <ShapeGeometry shape={indicatorShape} size={0.18} />
        <meshStandardMaterial
          color={indicatorColor}
          emissive={indicatorColor}
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  );
}
