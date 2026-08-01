import { describe, expect, it } from "vitest";
import { COMMAND_TYPES, CommandRequestSchema, CommandTypeSchema } from "./commands";

describe("CommandTypeSchema", () => {
  it("enumerates a non-empty, deduplicated closed vocabulary", () => {
    expect(COMMAND_TYPES.length).toBeGreaterThan(0);
    expect(new Set(COMMAND_TYPES).size).toBe(COMMAND_TYPES.length);
  });

  it("accepts every documented command type", () => {
    for (const type of COMMAND_TYPES) {
      expect(CommandTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it("rejects an undocumented command type", () => {
    expect(CommandTypeSchema.safeParse("Agent.Teleport").success).toBe(false);
    expect(CommandTypeSchema.safeParse("Event.Append").success).toBe(false);
    expect(CommandTypeSchema.safeParse("WorldState.ReconcileFromSnapshot").success).toBe(false);
  });
});

describe("CommandRequestSchema", () => {
  it("accepts a well-formed command envelope", () => {
    const result = CommandRequestSchema.safeParse({
      commandType: "Build.Start",
      entityId: "build-1",
      params: {},
    });
    expect(result.success).toBe(true);
  });

  it("defaults params to an empty object when omitted", () => {
    const result = CommandRequestSchema.safeParse({ commandType: "Build.Start" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.params).toEqual({});
    }
  });

  it("rejects an unknown commandType", () => {
    expect(CommandRequestSchema.safeParse({ commandType: "Build.SelfDestruct" }).success).toBe(false);
  });

  it("rejects a missing commandType", () => {
    expect(CommandRequestSchema.safeParse({ params: {} }).success).toBe(false);
  });
});
