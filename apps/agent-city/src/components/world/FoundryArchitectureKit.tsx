/** Shared, state-neutral visual language for the Foundry district. */
export const FOUNDRY_ARCHITECTURE = {
  civicCyan: "#64d8ff",
  civicAmber: "#f4b860",
  darkMetal: "#263349",
  paleMetal: "#8da1ba",
} as const;

export function FoundryPlinthBand({
  width,
  depth,
  y = 0.14,
  color = FOUNDRY_ARCHITECTURE.civicCyan,
}: {
  width: number;
  depth: number;
  y?: number;
  color?: string;
}) {
  const thickness = 0.045;
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0, depth / 2]}>
        <boxGeometry args={[width, thickness, thickness]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.34} />
      </mesh>
      <mesh position={[0, 0, -depth / 2]}>
        <boxGeometry args={[width, thickness, thickness]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[width / 2, 0, 0]}>
        <boxGeometry args={[thickness, thickness, depth]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[-width / 2, 0, 0]}>
        <boxGeometry args={[thickness, thickness, depth]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

export function FoundryCornerFins({
  width,
  depth,
  height,
  y,
}: {
  width: number;
  depth: number;
  height: number;
  y: number;
}) {
  const corners = [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [-width / 2, depth / 2],
    [width / 2, depth / 2],
  ] as const;
  return (
    <>
      {corners.map(([x, z]) => (
        <mesh key={`${x}-${z}`} castShadow position={[x, y, z]}>
          <boxGeometry args={[0.07, height, 0.07]} />
          <meshStandardMaterial
            color={FOUNDRY_ARCHITECTURE.paleMetal}
            metalness={0.46}
            roughness={0.42}
          />
        </mesh>
      ))}
    </>
  );
}

export function FoundryRadialBand({
  radius,
  y,
  color = FOUNDRY_ARCHITECTURE.civicCyan,
  opacity = 0.55,
}: {
  radius: number;
  y: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.035, 6, 32]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}
