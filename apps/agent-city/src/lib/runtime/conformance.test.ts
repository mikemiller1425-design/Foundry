import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { buildCanonicalScript } from "@/lib/mock-runtime/script";
import { reduceWorldState } from "@/lib/mock-runtime/worldStateReducer";
import type { RuntimeReadAdapter } from "./adapter";
import { describe, expect, it } from "vitest";
import { validateRuntimeReadAdapter } from "./conformance";

function fixtureAdapter(overrides: Partial<RuntimeReadAdapter> = {}): RuntimeReadAdapter {
  const events = buildCanonicalScript("adapter-conformance-test");
  return {
    runtimeMode: "mock",
    runtimeSource: {
      kind: "fixture",
      fixtureId: "adapter-conformance-test",
      label: "Adapter conformance test",
      authority: "fixture",
    },
    projectionStatus: "current",
    events,
    worldState: reduceWorldState(events),
    isRunning: false,
    isComplete: true,
    connectionStatus: "connected",
    mutationsEnabled: true,
    ...overrides,
  };
}

describe("RuntimeReadAdapter conformance", () => {
  it("accepts a complete fixture provider contract", () => {
    const report = validateRuntimeReadAdapter(fixtureAdapter());
    expect(report.status).toBe("conformant");
    expect(report.checks.every((check) => check.severity === "pass")).toBe(true);
  });

  it("accepts the same canonical read model through a backend authority", () => {
    const report = validateRuntimeReadAdapter(
      fixtureAdapter({
        runtimeMode: "backend",
        runtimeSource: { kind: "backend", label: "Foundry backend", authority: "backend" },
        mutationsEnabled: true,
      }),
    );
    expect(report.status).toBe("conformant");
  });

  it("refuses duplicate ids and unsafe stale backend mutation", () => {
    const event = buildCanonicalScript("adapter-invalid-test")[0]!;
    const report = validateRuntimeReadAdapter(
      fixtureAdapter({
        runtimeMode: "backend",
        runtimeSource: { kind: "backend", label: "Foundry backend", authority: "backend" },
        projectionStatus: "stale",
        events: [event, event],
        worldState: createInitialWorldState(),
        mutationsEnabled: true,
      }),
    );
    expect(report.status).toBe("invalid");
    expect(report.checks.find((check) => check.id === "event-identity")?.severity).toBe("fail");
    expect(report.checks.find((check) => check.id === "mutation-gate")?.severity).toBe("fail");
  });

  it("reports legacy contexts as degraded rather than inventing authority", () => {
    const report = validateRuntimeReadAdapter(
      fixtureAdapter({ runtimeMode: undefined, runtimeSource: undefined }),
    );
    expect(report.status).toBe("degraded");
  });
});
