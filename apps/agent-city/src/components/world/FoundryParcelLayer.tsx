"use client";

import type { Selection } from "@/components/controls/selection";
import { FOUNDRY_PARCELS } from "@/lib/world/worldAtlas";
import type { ThreeEvent } from "@react-three/fiber";

function ParcelBorder({
  center,
  size,
  color,
  selected,
  onSelect,
}: {
  center: readonly [number, number, number];
  size: readonly [number, number];
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const thickness = selected ? 0.11 : 0.055;
  const opacity = selected ? 0.9 : 0.28;
  const [x, y, z] = center;
  const [width, depth] = size;
  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };
  const material = (
    <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
  );

  return (
    <group>
      <mesh position={[x, y, z + depth / 2]} onClick={handleSelect}>
        <boxGeometry args={[width, 0.025, thickness]} />
        {material}
      </mesh>
      <mesh position={[x, y, z - depth / 2]} onClick={handleSelect}>
        <boxGeometry args={[width, 0.025, thickness]} />
        {material}
      </mesh>
      <mesh position={[x + width / 2, y, z]} onClick={handleSelect}>
        <boxGeometry args={[thickness, 0.025, depth]} />
        {material}
      </mesh>
      <mesh position={[x - width / 2, y, z]} onClick={handleSelect}>
        <boxGeometry args={[thickness, 0.025, depth]} />
        {material}
      </mesh>
      <mesh position={[x - width / 2 + 0.18, y + 0.18, z - depth / 2 + 0.18]}>
        <cylinderGeometry args={[0.055, 0.08, 0.32, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.36} />
      </mesh>
    </group>
  );
}

export function FoundryParcelLayer({
  selection,
  onSelect,
}: {
  selection: Selection | null;
  onSelect: (id: string) => void;
}) {
  return (
    <group>
      {FOUNDRY_PARCELS.map((parcel) => (
        <ParcelBorder
          key={parcel.id}
          center={parcel.center}
          size={parcel.size}
          color={parcel.accent}
          selected={selection?.kind === "parcel" && selection.id === parcel.id}
          onSelect={() => onSelect(parcel.id)}
        />
      ))}
    </group>
  );
}
