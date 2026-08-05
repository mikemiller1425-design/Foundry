import { describe, expect, it } from "vitest";
import { runtimeSourceLabel, type RuntimeSource } from "./adapter";

describe("runtime adapter source identity", () => {
  it("labels deterministic fixtures without implying backend authority", () => {
    const source: RuntimeSource = {
      kind: "fixture",
      fixtureId: "approval-gate",
      label: "Approval gate",
      authority: "fixture",
    };

    expect(runtimeSourceLabel(source)).toBe("Fixture · Approval gate");
  });

  it("labels backend authority explicitly", () => {
    expect(
      runtimeSourceLabel({
        kind: "backend",
        label: "Backend event stream",
        authority: "backend",
      }),
    ).toBe("Backend event stream");
  });
});
