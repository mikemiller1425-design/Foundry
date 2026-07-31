import type { AgentRole } from "@foundry/contracts";

// docs/01-mission/v1-scope.md § "Required workers";
// docs/02-specification/domain-model.md → Agent → V1 limits (exactly three agents).
export interface WorldAgentDefinition {
  id: string;
  name: string;
  role: AgentRole;
  homeBuildingId: string;
}

export const WORLD_AGENTS: readonly WorldAgentDefinition[] = [
  { id: "agent-architect", name: "Architect", role: "architect", homeBuildingId: "home-architect" },
  { id: "agent-builder", name: "Builder", role: "builder", homeBuildingId: "home-builder" },
  { id: "agent-inspector", name: "Inspector", role: "inspector", homeBuildingId: "home-inspector" },
] as const;
