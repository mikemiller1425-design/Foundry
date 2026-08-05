import { WorldStateSchema } from "@foundry/contracts";
import { FoundryEventSchema } from "@foundry/event-types";
import type { RuntimeReadAdapter } from "./adapter";

export type ConformanceSeverity = "pass" | "warning" | "fail";

export interface ConformanceCheck {
  id: string;
  label: string;
  severity: ConformanceSeverity;
  detail: string;
}

export interface RuntimeConformanceReport {
  status: "conformant" | "degraded" | "invalid";
  checks: readonly ConformanceCheck[];
}

/**
 * Full, read-only boundary audit intended for tests, diagnostics, and handoff
 * verification. Providers still parse at ingestion; this does not replace
 * transport validation or mutate/repair malformed input.
 */
export function validateRuntimeReadAdapter(adapter: RuntimeReadAdapter): RuntimeConformanceReport {
  const checks: ConformanceCheck[] = [];
  const worldResult = WorldStateSchema.safeParse(adapter.worldState);
  checks.push({
    id: "world-schema",
    label: "World projection schema",
    severity: worldResult.success ? "pass" : "fail",
    detail: worldResult.success ? "Valid WorldState" : "WorldState failed canonical validation",
  });

  const invalidEventCount = adapter.events.reduce(
    (count, event) => count + (FoundryEventSchema.safeParse(event).success ? 0 : 1),
    0,
  );
  checks.push({
    id: "event-schema",
    label: "Event envelope schema",
    severity: invalidEventCount === 0 ? "pass" : "fail",
    detail:
      invalidEventCount === 0
        ? `${adapter.events.length} canonical events valid`
        : `${invalidEventCount} invalid event${invalidEventCount === 1 ? "" : "s"}`,
  });

  const ids = adapter.events.map((event) => event.id);
  const duplicateCount = ids.length - new Set(ids).size;
  checks.push({
    id: "event-identity",
    label: "Event identity",
    severity: duplicateCount === 0 ? "pass" : "fail",
    detail:
      duplicateCount === 0 ? "No duplicate event ids" : `${duplicateCount} duplicate event ids`,
  });

  const sourceAligned =
    !adapter.runtimeSource ||
    !adapter.runtimeMode ||
    (adapter.runtimeSource.kind === "fixture" && adapter.runtimeMode === "mock") ||
    (adapter.runtimeSource.kind === "backend" && adapter.runtimeMode === "backend");
  checks.push({
    id: "source-authority",
    label: "Source authority",
    severity:
      !adapter.runtimeSource || !adapter.runtimeMode ? "warning" : sourceAligned ? "pass" : "fail",
    detail:
      !adapter.runtimeSource || !adapter.runtimeMode
        ? "Legacy context does not declare complete source metadata"
        : sourceAligned
          ? `${adapter.runtimeSource.authority} authority declared explicitly`
          : "Runtime mode contradicts declared authority",
  });

  const unsafeProjectionMutation =
    adapter.runtimeMode === "backend" &&
    adapter.mutationsEnabled &&
    (adapter.connectionStatus !== "connected" || adapter.projectionStatus !== "current");
  checks.push({
    id: "mutation-gate",
    label: "Projection mutation gate",
    severity: unsafeProjectionMutation ? "fail" : "pass",
    detail: unsafeProjectionMutation
      ? "Backend mutations enabled without a current connected projection"
      : adapter.mutationsEnabled
        ? adapter.runtimeMode === "backend"
          ? "Backend mutations gated by current connected projection"
          : "Fixture-local demo controls only"
        : "Mutation controls disabled",
  });

  const hasFail = checks.some((check) => check.severity === "fail");
  const hasWarning = checks.some((check) => check.severity === "warning");
  return {
    status: hasFail ? "invalid" : hasWarning ? "degraded" : "conformant",
    checks,
  };
}
