import { describe, expect, it } from "vitest";
import {
  DEFAULT_OBJECTIVE_WORKSPACE,
  OBJECTIVE_MAX_LENGTH,
  OBJECTIVE_MIN_LENGTH,
  OBJECTIVE_WORKSPACES,
  ObjectiveSubmissionSchema,
  ObjectiveWorkspaceSchema,
  V1_RISK_CLASSES,
} from "./objective";
import { V1RiskClassSchema } from "./common";

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

/**
 * AC-107 — the exported option lists must agree with the schemas, so a UI
 * that reads them cannot offer something the contract forbids.
 */
describe("exported option lists match the schemas they describe", () => {
  it("V1_RISK_CLASSES contains exactly what V1RiskClassSchema accepts", () => {
    for (const riskClass of V1_RISK_CLASSES) {
      expect(V1RiskClassSchema.safeParse(riskClass).success, riskClass).toBe(true);
    }
    for (const rejected of ["R3", "R4", "R5"]) {
      expect((V1_RISK_CLASSES as readonly string[]).includes(rejected), rejected).toBe(false);
    }
    expect(V1_RISK_CLASSES).toHaveLength(3);
  });

  it("DEFAULT_OBJECTIVE_WORKSPACE is a permitted workspace", () => {
    expect(ObjectiveWorkspaceSchema.safeParse(DEFAULT_OBJECTIVE_WORKSPACE).success).toBe(true);
  });

  it("every listed workspace is accepted by the schema", () => {
    for (const workspace of OBJECTIVE_WORKSPACES) {
      expect(ObjectiveWorkspaceSchema.safeParse(workspace).success, workspace).toBe(true);
    }
  });
});
