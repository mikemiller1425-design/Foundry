import type { StageSummary } from "@/lib/mock-runtime/selectors";
import type { BuildStageName } from "@foundry/contracts";
import { CONSTRUCTION_SITE_PHASE_VISUALS } from "@foundry/world-model";
import type { IndicatorShape } from "@/components/world/ShapeGeometry";

// docs/02-specification/world-model.md → "Construction site" → Allowed
// states: "Foundation → frame → enclosed → inspected → completed
// (stage-mapped)"; State→visual: "Structural progression by completed
// stages, not elapsed time." Unlike the other four operational buildings,
// the Construction Site does not use the generic Building.status
// vocabulary — `@foundry/world-model`'s `CONSTRUCTION_SITE_PHASE_VISUALS`
// (built at FBL-007) already reserves this separate phase vocabulary for
// exactly this reason. Phase is derived purely from how many of the seven
// canonical v1-scope.md BuildStages have completed, in their fixed
// sequence — never from elapsed time or animation.
export type ConstructionSitePhase = keyof typeof CONSTRUCTION_SITE_PHASE_VISUALS;

const STAGE_ORDER: readonly BuildStageName[] = [
  "planning",
  "scaffold",
  "frontend_implementation",
  "backend_implementation",
  "integration",
  "qa_validation",
  "deployment_package",
];

export function computeConstructionSitePhase(stages: readonly StageSummary[]): ConstructionSitePhase {
  const completedCount = STAGE_ORDER.filter((name) =>
    stages.some((s) => s.name === name && s.status === "completed"),
  ).length;

  if (completedCount >= 7) return "completed";
  if (completedCount >= 5) return "inspected";
  if (completedCount >= 3) return "enclosed";
  if (completedCount >= 1) return "frame";
  return "foundation";
}

export interface ConstructionSitePhaseVisualSpec {
  phase: ConstructionSitePhase;
  label: string;
  color: string;
  shape: IndicatorShape;
}

export const CONSTRUCTION_SITE_VISUALS: Record<ConstructionSitePhase, ConstructionSitePhaseVisualSpec> =
  {
    foundation: {
      phase: "foundation",
      label: CONSTRUCTION_SITE_PHASE_VISUALS.foundation,
      color: "#78716c",
      shape: "box",
    },
    frame: {
      phase: "frame",
      label: CONSTRUCTION_SITE_PHASE_VISUALS.frame,
      color: "#a8a29e",
      shape: "tetrahedron",
    },
    enclosed: {
      phase: "enclosed",
      label: CONSTRUCTION_SITE_PHASE_VISUALS.enclosed,
      color: "#38bdf8",
      shape: "octahedron",
    },
    inspected: {
      phase: "inspected",
      label: CONSTRUCTION_SITE_PHASE_VISUALS.inspected,
      color: "#a78bfa",
      shape: "icosahedron",
    },
    completed: {
      phase: "completed",
      label: CONSTRUCTION_SITE_PHASE_VISUALS.completed,
      color: "#34d399",
      shape: "sphere",
    },
  };

export const ALL_CONSTRUCTION_SITE_PHASES: readonly ConstructionSitePhase[] = [
  "foundation",
  "frame",
  "enclosed",
  "inspected",
  "completed",
];

/** Signature over every non-color dimension — proves no two phases differ by color alone. */
export function constructionSiteNonColorSignature(spec: ConstructionSitePhaseVisualSpec): string {
  return spec.shape;
}
