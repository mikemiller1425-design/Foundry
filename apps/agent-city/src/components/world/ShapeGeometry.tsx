// Shared non-color indicator-shape geometry, generalizing the shape switch
// Lighthouse.tsx (FBL-014) introduced for its own beacon. Every FBL-016+
// world object reuses this one switch instead of duplicating it per object
// type, so "distinct, not color-alone" stays backed by one implementation.
export type IndicatorShape =
  | "icosahedron"
  | "torus"
  | "cone"
  | "box"
  | "octahedron"
  | "tetrahedron"
  | "sphere"
  | "cylinder";

export function ShapeGeometry({ shape, size = 0.4 }: { shape: IndicatorShape; size?: number }) {
  switch (shape) {
    case "icosahedron":
      return <icosahedronGeometry args={[size, 0]} />;
    case "torus":
      return <torusGeometry args={[size * 0.85, size * 0.35, 6, 12]} />;
    case "cone":
      return <coneGeometry args={[size, size * 1.7, 5]} />;
    case "box":
      return <boxGeometry args={[size * 1.4, size * 1.4, size * 1.4]} />;
    case "octahedron":
      return <octahedronGeometry args={[size * 1.1, 0]} />;
    case "tetrahedron":
      return <tetrahedronGeometry args={[size * 0.9, 0]} />;
    case "sphere":
      return <sphereGeometry args={[size, 10, 8]} />;
    case "cylinder":
      return <cylinderGeometry args={[size * 0.7, size * 0.7, size * 1.6, 10]} />;
  }
}
