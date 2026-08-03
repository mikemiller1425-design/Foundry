import { describe, expect, it } from "vitest";
import { resolveRuntimeSelection } from "./runtimeMode";

/**
 * AC-105 / F-103 — mode is a run-time input.
 *
 * These pin the resolution itself. That one *built artifact* honours it
 * without a rebuild is proved separately by `pnpm verify:runtime-mode`,
 * which builds once and starts the same output twice.
 */
describe("resolveRuntimeSelection", () => {
  it("defaults to the mock runtime with no configuration at all", () => {
    expect(resolveRuntimeSelection({})).toEqual({
      mode: "mock",
      backendUrl: null,
      source: "default",
    });
  });

  it("selects backend mode from the run-time variable", () => {
    expect(resolveRuntimeSelection({ FOUNDRY_API_URL: "http://127.0.0.1:4000" })).toEqual({
      mode: "backend",
      backendUrl: "http://127.0.0.1:4000",
      source: "FOUNDRY_API_URL",
    });
  });

  it("still honours the legacy build-time variable, so existing runs keep working", () => {
    expect(resolveRuntimeSelection({ NEXT_PUBLIC_FOUNDRY_API_URL: "http://backend.test" })).toEqual(
      {
        mode: "backend",
        backendUrl: "http://backend.test",
        source: "NEXT_PUBLIC_FOUNDRY_API_URL",
      },
    );
  });

  it("prefers the run-time variable over the legacy one", () => {
    const selection = resolveRuntimeSelection({
      FOUNDRY_API_URL: "http://runtime.test",
      NEXT_PUBLIC_FOUNDRY_API_URL: "http://legacy.test",
    });
    expect(selection.backendUrl).toBe("http://runtime.test");
    expect(selection.source).toBe("FOUNDRY_API_URL");
  });

  it("treats empty and whitespace-only values as unset, not as a backend", () => {
    for (const value of ["", "   ", "\t"]) {
      expect(resolveRuntimeSelection({ FOUNDRY_API_URL: value }).mode, JSON.stringify(value)).toBe(
        "mock",
      );
      expect(
        resolveRuntimeSelection({ NEXT_PUBLIC_FOUNDRY_API_URL: value }).mode,
        JSON.stringify(value),
      ).toBe("mock");
    }
  });

  it("lets an empty run-time value fall through to the legacy one rather than forcing mock", () => {
    const selection = resolveRuntimeSelection({
      FOUNDRY_API_URL: "",
      NEXT_PUBLIC_FOUNDRY_API_URL: "http://legacy.test",
    });
    expect(selection.mode).toBe("backend");
    expect(selection.source).toBe("NEXT_PUBLIC_FOUNDRY_API_URL");
  });

  it("trims surrounding whitespace from the resolved URL", () => {
    expect(resolveRuntimeSelection({ FOUNDRY_API_URL: "  http://a.test  " }).backendUrl).toBe(
      "http://a.test",
    );
  });

  it("the same environment shape yields both modes — the property F-103 requires", () => {
    const built = (env: Record<string, string | undefined>) => resolveRuntimeSelection(env).mode;
    expect(built({ FOUNDRY_API_URL: "http://127.0.0.1:4000" })).toBe("backend");
    expect(built({ FOUNDRY_API_URL: "" })).toBe("mock");
  });
});
