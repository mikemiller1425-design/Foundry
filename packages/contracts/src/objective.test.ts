import { describe, expect, it } from "vitest";
import {
  OBJECTIVE_MAX_LENGTH,
  OBJECTIVE_MIN_LENGTH,
  OBJECTIVE_WORKSPACES,
  ObjectiveSubmissionSchema,
} from "./objective";

const VALID = {
  objective: "Add a JSON task store module with a test suite",
  workspace: "foundry_managed",
  riskClass: "R2",
} as const;

describe("ObjectiveSubmissionSchema — accepted shape", () => {
  it("accepts a bounded objective in the managed workspace at an R0–R2 risk class", () => {
    for (const riskClass of ["R0", "R1", "R2"] as const) {
      const parsed = ObjectiveSubmissionSchema.safeParse({ ...VALID, riskClass });
      expect(parsed.success).toBe(true);
    }
  });

  it("trims surrounding whitespace so the persisted objective is what was validated", () => {
    const parsed = ObjectiveSubmissionSchema.parse({
      ...VALID,
      objective: `   ${VALID.objective}   `,
    });
    expect(parsed.objective).toBe(VALID.objective);
  });
});

describe("ObjectiveSubmissionSchema — bounded text", () => {
  it("rejects an objective below the length floor", () => {
    const parsed = ObjectiveSubmissionSchema.safeParse({ ...VALID, objective: "too short" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an over-long objective", () => {
    const parsed = ObjectiveSubmissionSchema.safeParse({
      ...VALID,
      objective: "x".repeat(OBJECTIVE_MAX_LENGTH + 1),
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts exactly the floor and exactly the ceiling", () => {
    expect(
      ObjectiveSubmissionSchema.safeParse({ ...VALID, objective: "x".repeat(OBJECTIVE_MIN_LENGTH) })
        .success,
    ).toBe(true);
    expect(
      ObjectiveSubmissionSchema.safeParse({ ...VALID, objective: "x".repeat(OBJECTIVE_MAX_LENGTH) })
        .success,
    ).toBe(true);
  });

  it("rejects newlines, tabs, and other control characters", () => {
    for (const smuggled of [
      "line one\nline two",
      "column one\tcolumn two",
      "a null\u0000byte hides here",
      "a delete\u007Fchar hides here",
      "a carriage\rreturn hides here",
    ]) {
      const parsed = ObjectiveSubmissionSchema.safeParse({ ...VALID, objective: smuggled });
      expect(parsed.success, JSON.stringify(smuggled)).toBe(false);
    }
  });

  it("rejects a whitespace-only objective rather than accepting an empty one", () => {
    expect(
      ObjectiveSubmissionSchema.safeParse({ ...VALID, objective: "               " }).success,
    ).toBe(false);
  });
});

describe("ObjectiveSubmissionSchema — workspace policy", () => {
  it("permits exactly one workspace", () => {
    expect(OBJECTIVE_WORKSPACES).toEqual(["foundry_managed"]);
  });

  it("rejects an operator-nominated directory, a repository path, and a home path", () => {
    for (const workspace of [
      "/Users/operator/projects/thing",
      "./",
      "~",
      "repository",
      "operator_nominated",
    ]) {
      expect(ObjectiveSubmissionSchema.safeParse({ ...VALID, workspace }).success, workspace).toBe(
        false,
      );
    }
  });
});

describe("ObjectiveSubmissionSchema — risk ceiling", () => {
  it("makes R3, R4, and R5 unrepresentable (principle 19)", () => {
    for (const riskClass of ["R3", "R4", "R5"] as const) {
      expect(ObjectiveSubmissionSchema.safeParse({ ...VALID, riskClass }).success, riskClass).toBe(
        false,
      );
    }
  });
});

describe("ObjectiveSubmissionSchema — no silent acceptance", () => {
  it("rejects an unknown field rather than dropping it", () => {
    const parsed = ObjectiveSubmissionSchema.safeParse({
      ...VALID,
      stageName: "backend_implementation",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a submission missing any required field", () => {
    for (const omitted of ["objective", "workspace", "riskClass"] as const) {
      const input: Record<string, unknown> = { ...VALID };
      delete input[omitted];
      expect(ObjectiveSubmissionSchema.safeParse(input).success, omitted).toBe(false);
    }
  });
});
