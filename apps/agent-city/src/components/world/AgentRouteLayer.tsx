"use client";

import { useRuntime } from "@/lib/mock-runtime";
import { deriveAgentRouteCue, routeSamples } from "@/lib/world/agentSpatialStory";
import { AGENT_VISUALS } from "@/lib/world/agentVisuals";

export function AgentRouteLayer() {
  const { events, worldState } = useRuntime();
  const routes = worldState.agents
    .map((agent) => ({
      agent,
      cue: deriveAgentRouteCue(agent.id, agent.status, events),
    }))
    .filter((entry) => entry.cue !== null);

  return (
    <group>
      {routes.map(({ agent, cue }) => {
        if (!cue) return null;
        const samples = routeSamples(cue.source, cue.destination);
        const color = AGENT_VISUALS[agent.status].color;
        const angle = Math.atan2(
          cue.destination[0] - cue.source[0],
          cue.destination[2] - cue.source[2],
        );
        return (
          <group key={cue.eventId}>
            {samples.map(([x, y, z], index) => (
              <mesh key={`${x}-${z}`} position={[x, y + 0.04, z]} rotation={[0, angle, 0]}>
                {index === samples.length - 1 ? (
                  <coneGeometry args={[0.18, 0.42, 6]} />
                ) : (
                  <boxGeometry args={[0.12, 0.07, 0.32]} />
                )}
                <meshBasicMaterial color={color} transparent opacity={0.84} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}
