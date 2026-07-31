import { describe, expect, it } from "vitest";
import {
  DemoCommandSchema,
  DemoCommandTypeSchema,
  HISTORY_ALTERING_DEMO_COMMANDS,
} from "./commands";

describe("DemoCommandSchema", () => {
  it("accepts each of the six exhaustive demo commandTypes with correct params", () => {
    expect(DemoCommandSchema.safeParse({ commandType: "demo.start", params: {} }).success).toBe(
      true,
    );
    expect(DemoCommandSchema.safeParse({ commandType: "demo.pause", params: {} }).success).toBe(
      true,
    );
    expect(DemoCommandSchema.safeParse({ commandType: "demo.resume", params: {} }).success).toBe(
      true,
    );
    expect(
      DemoCommandSchema.safeParse({
        commandType: "demo.set_speed",
        params: { multiplier: 2 },
      }).success,
    ).toBe(true);
    expect(DemoCommandSchema.safeParse({ commandType: "demo.reset", params: {} }).success).toBe(
      true,
    );
    expect(
      DemoCommandSchema.safeParse({ commandType: "demo.replay", params: { seed: "abc" } }).success,
    ).toBe(true);
    expect(DemoCommandSchema.safeParse({ commandType: "demo.replay", params: {} }).success).toBe(
      true,
    );
  });

  it("rejects any commandType outside the exhaustive set", () => {
    expect(
      DemoCommandSchema.safeParse({ commandType: "demo.fast_forward", params: {} }).success,
    ).toBe(false);
    expect(
      DemoCommandSchema.safeParse({ commandType: "shell.execute", params: { cmd: "rm -rf /" } })
        .success,
    ).toBe(false);
  });

  it("rejects demo.set_speed without a numeric multiplier", () => {
    expect(DemoCommandSchema.safeParse({ commandType: "demo.set_speed", params: {} }).success).toBe(
      false,
    );
    expect(
      DemoCommandSchema.safeParse({
        commandType: "demo.set_speed",
        params: { multiplier: -1 },
      }).success,
    ).toBe(false);
  });

  it("rejects params shapes that don't match their commandType (no cross-command leakage)", () => {
    expect(
      DemoCommandSchema.safeParse({ commandType: "demo.start", params: { multiplier: 2 } }).success,
    ).toBe(false);
  });

  it("DemoCommandTypeSchema enumerates exactly the six approved values", () => {
    expect(DemoCommandTypeSchema.options).toEqual([
      "demo.start",
      "demo.pause",
      "demo.resume",
      "demo.set_speed",
      "demo.reset",
      "demo.replay",
    ]);
  });

  it("only reset and replay are marked history-altering", () => {
    expect(HISTORY_ALTERING_DEMO_COMMANDS).toEqual(["demo.reset", "demo.replay"]);
  });
});
