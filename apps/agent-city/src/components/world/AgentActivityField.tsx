"use client";

import type { AgentStatus } from "@foundry/contracts";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { useReducedMotion } from "@/lib/world/useReducedMotion";

export function AgentActivityField({ status, color }: { status: AgentStatus; color: string }) {
  const motionGroup = useRef<Group>(null);
  const reducedMotion = useReducedMotion();

  useFrame((_state, delta) => {
    if (!reducedMotion && motionGroup.current && (status === "working" || status === "traveling")) {
      motionGroup.current.rotation.y += delta * (status === "working" ? 0.7 : 1.25);
    }
  });

  if (status === "idle" || status === "assigned") return null;

  if (status === "working") {
    return (
      <group ref={motionGroup} position={[0, 0.55, 0]}>
        {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((angle) => (
          <mesh key={angle} position={[Math.cos(angle) * 0.42, 0, Math.sin(angle) * 0.42]}>
            <boxGeometry args={[0.09, 0.09, 0.09]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.48} />
          </mesh>
        ))}
      </group>
    );
  }

  if (status === "traveling") {
    return (
      <group ref={motionGroup} position={[0, 0.1, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.035, 6, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.68} />
        </mesh>
        <mesh position={[0.48, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.1, 0.24, 6]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    );
  }

  if (status === "waiting") {
    return (
      <group position={[0, 0.16, 0]}>
        <mesh position={[-0.32, 0, 0]}>
          <sphereGeometry args={[0.055, 8, 6]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.055, 8, 6]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0.32, 0, 0]}>
          <sphereGeometry args={[0.055, 8, 6]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    );
  }

  if (status === "paused") {
    return (
      <group position={[0, 0.48, -0.22]}>
        <mesh position={[-0.08, 0, 0]}>
          <boxGeometry args={[0.07, 0.42, 0.05]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0.08, 0, 0]}>
          <boxGeometry args={[0.07, 0.42, 0.05]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    );
  }

  if (status === "failed") {
    return (
      <mesh position={[0, 0.22, -0.28]}>
        <tetrahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.52} />
      </mesh>
    );
  }

  return (
    <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.28, 0.5, 20]} />
      <meshBasicMaterial color={color} transparent opacity={0.2} />
    </mesh>
  );
}
