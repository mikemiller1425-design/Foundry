import { describe, expect, it } from "vitest";
import {
  COMMAND_PARAM_SCHEMAS,
  COMMAND_TYPES,
  CommandRequestSchema,
  CommandTypeSchema,
  parseCommandParams,
} from "./commands";
import { BUILD_STAGE_SEQUENCE } from "./entities/buildStage";

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
    expect(CommandRequestSchema.safeParse({ commandType: "Build.SelfDestruct" }).success).toBe(
      false,
    );
  });

  it("rejects a missing commandType", () => {
    expect(CommandRequestSchema.safeParse({ params: {} }).success).toBe(false);
  });
});

/**
 * AC-107 — per-command parameter schemas, declared for the objective,
 * plan, and authorization commands specifically.
 */
describe("COMMAND_PARAM_SCHEMAS (AC-107)", () => {
  it("declares shapes only for the commands this rung owns", () => {
    expect(Object.keys(COMMAND_PARAM_SCHEMAS).sort()).toEqual([
      "Build.Create",
      "Build.Plan",
      "Project.Create",
    ]);
  });

  it("every declared key is a real command in the closed vocabulary", () => {
    for (const key of Object.keys(COMMAND_PARAM_SCHEMAS)) {
      expect(COMMAND_TYPES).toContain(key);
    }
  });

  it("leaves every other command envelope-only, rather than refusing it", () => {
    const result = parseCommandParams("Approval.Approve", { anything: true });
    expect(result.ok).toBe(true);
  });

  it("does not change CommandRequestSchema — enforcement wiring is AC-108's", () => {
    // A malformed Project.Create still passes the *envelope*; the handler
    // is what refuses it today, with a stated reason at HTTP 200.
    expect(
      CommandRequestSchema.safeParse({
        commandType: "Project.Create",
        entityId: "p1",
        params: { objective: "no" },
      }).success,
    ).toBe(true);
  });
});

describe("parseCommandParams — Project.Create", () => {
  it("accepts a bounded objective with its project id", () => {
    const result = parseCommandParams("Project.Create", {
      objective: "Add a JSON task store module with tests",
      projectId: "project-1",
    });
    expect(result.ok).toBe(true);
  });

  it.each([
    ["a too-short objective", { objective: "no", projectId: "p1" }],
    ["an over-long objective", { objective: "x".repeat(501), projectId: "p1" }],
    ["a missing project id", { objective: "Add a bounded thing here" }],
    ["an unknown field", { objective: "Add a bounded thing here", projectId: "p1", risk: "R5" }],
  ])("rejects %s with a named field", (_label, params) => {
    const result = parseCommandParams("Project.Create", params);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(typeof result.issues[0]!.field).toBe("string");
      expect(result.issues[0]!.message.length).toBeGreaterThan(0);
    }
  });
});

describe("parseCommandParams — Build.Create", () => {
  it("accepts a coherent build creation", () => {
    expect(
      parseCommandParams("Build.Create", {
        projectId: "project-1",
        buildId: "build-1",
        objective: "Add a JSON task store module with tests",
      }).ok,
    ).toBe(true);
  });

  it("rejects a missing buildId, which is what made a Build invisible to the handler", () => {
    expect(
      parseCommandParams("Build.Create", {
        projectId: "project-1",
        objective: "Add a JSON task store module with tests",
      }).ok,
    ).toBe(false);
  });
});

describe("parseCommandParams — Build.Plan", () => {
  it("requires exactly one stage id per authoritative stage", () => {
    const base = {
      planId: "plan-1",
      planArtifactId: "artifact-1",
      requirementCount: 3,
    };
    expect(
      parseCommandParams("Build.Plan", {
        ...base,
        stageIds: BUILD_STAGE_SEQUENCE.map((_, i) => `stage-${i + 1}`),
      }).ok,
    ).toBe(true);
    expect(parseCommandParams("Build.Plan", { ...base, stageIds: ["stage-1"] }).ok).toBe(false);
  });

  it("rejects a negative requirement count", () => {
    expect(
      parseCommandParams("Build.Plan", {
        planId: "plan-1",
        planArtifactId: "artifact-1",
        stageIds: BUILD_STAGE_SEQUENCE.map((_, i) => `stage-${i + 1}`),
        requirementCount: -1,
      }).ok,
    ).toBe(false);
  });
});
