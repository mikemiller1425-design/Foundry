import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OBJECTIVE_MAX_LENGTH } from "@foundry/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandHandler, type CommandActor } from "./commandHandler";
import { ObjectiveIntake, type ObjectiveIdFactory } from "./objectiveIntake";
import { PersistenceService } from "./persistenceService";

const OPERATOR: CommandActor = {
  actorType: "operator",
  actorId: "operator-1",
  authenticated: true,
};
const UNAUTHENTICATED: CommandActor = {
  actorType: "operator",
  actorId: "operator-1",
  authenticated: false,
};
const AGENT: CommandActor = {
  actorType: "agent",
  actorId: "agent-builder",
  authenticated: true,
};
const ANONYMOUS: CommandActor = {
  actorType: "frontend",
  actorId: "anonymous",
  authenticated: false,
};

const OBJECTIVE = "Add a JSON task store module with a test suite";

const SUBMISSION = {
  objective: OBJECTIVE,
  workspace: "foundry_managed",
  riskClass: "R2",
} as const;

let dir: string;
let persistence: PersistenceService;
let handler: CommandHandler;
let intake: ObjectiveIntake;

/** Deterministic ids, so assertions name what they mean. */
const fixedIds: ObjectiveIdFactory = (kind) => `${kind}-fixed`;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "foundry-objective-intake-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  handler = new CommandHandler(persistence);
  intake = new ObjectiveIntake(handler, fixedIds);
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

function fullSnapshot() {
  return {
    events: persistence.getAllEvents(),
    worldState: persistence.getWorldStateSnapshot(),
  };
}

describe("ObjectiveIntake — the accepted path", () => {
  it("creates a Project and a Build as backend truth from one submission", () => {
    const result = intake.submit(SUBMISSION, OPERATOR);

    expect(result.accepted).toBe(true);
    expect(result.projectId).toBe("project-fixed");
    expect(result.buildId).toBe("build-fixed");
    expect(result.objective).toBe(OBJECTIVE);

    const project = persistence.getEntity<{ objective: string; status: string }>(
      "projects",
      "project-fixed",
    );
    expect(project?.objective).toBe(OBJECTIVE);
    expect(project?.status).toBe("active");

    const build = persistence.getEntity<{ projectId: string; objectiveSnapshot: string }>(
      "builds",
      "build-fixed",
    );
    expect(build?.projectId).toBe("project-fixed");
    expect(build?.objectiveSnapshot).toBe(OBJECTIVE);
  });

  it("emits exactly the two declared events, in order, and nothing else", () => {
    const result = intake.submit(SUBMISSION, OPERATOR);

    expect(result.events?.map((e) => e.type)).toEqual([
      "operator.objective_submitted",
      "build.created",
    ]);
    expect(persistence.getAllEvents().map((e) => e.type)).toEqual([
      "operator.objective_submitted",
      "build.created",
    ]);
  });

  it("attributes both events to the authenticated operator", () => {
    intake.submit(SUBMISSION, OPERATOR);
    for (const event of persistence.getAllEvents()) {
      expect(event.actorType).toBe("operator");
      expect(event.actorId).toBe("operator-1");
    }
  });

  it("surfaces the objective in the WorldState projection the frontend reads", () => {
    intake.submit(SUBMISSION, OPERATOR);
    const snapshot = persistence.getWorldStateSnapshot();
    expect(snapshot.currentBuild?.objectiveSnapshot).toBe(OBJECTIVE);
    expect(snapshot.currentBuild?.status).toBe("planned");
  });

  it("persists the trimmed objective, not the text as typed around it", () => {
    const result = intake.submit({ ...SUBMISSION, objective: `  ${OBJECTIVE}  ` }, OPERATOR);
    expect(result.accepted).toBe(true);
    expect(
      persistence.getEntity<{ objective: string }>("projects", "project-fixed")?.objective,
    ).toBe(OBJECTIVE);
  });

  it("does not plan, schedule, or execute anything — no stage, task, agent run, or artifact", () => {
    intake.submit(SUBMISSION, OPERATOR);
    for (const entityType of [
      "buildStages",
      "tasks",
      "agentRuns",
      "artifacts",
      "approvals",
    ] as const) {
      expect(persistence.listEntities(entityType), entityType).toEqual([]);
    }
  });
});

describe("ObjectiveIntake — authorization", () => {
  it.each([
    ["an unauthenticated operator", UNAUTHENTICATED],
    ["an authenticated agent", AGENT],
    ["an anonymous frontend caller", ANONYMOUS],
  ])("refuses %s with zero mutation", (_label, actor) => {
    const before = fullSnapshot();
    const result = intake.submit(SUBMISSION, actor);

    expect(result.accepted).toBe(false);
    expect(result.code).toBe("unauthorized");
    expect(result.reason).toMatch(/authenticated operator/i);
    expect(result.correctiveAction).toBeTruthy();
    expect(fullSnapshot()).toEqual(before);
  });

  it("does not leak field-level validation detail to an unauthorized caller", () => {
    const result = intake.submit({ objective: "no" }, ANONYMOUS);
    expect(result.code).toBe("unauthorized");
    expect(result.issues).toBeUndefined();
  });
});

describe("ObjectiveIntake — envelope rejections leave persisted state unchanged", () => {
  it.each([
    ["an objective below the length floor", { ...SUBMISSION, objective: "too short" }],
    ["an over-long objective", { ...SUBMISSION, objective: "x".repeat(OBJECTIVE_MAX_LENGTH + 1) }],
    ["a disallowed workspace", { ...SUBMISSION, workspace: "/Users/operator/real-project" }],
    ["an R3 risk class", { ...SUBMISSION, riskClass: "R3" }],
    ["an unknown field", { ...SUBMISSION, stageName: "backend_implementation" }],
    ["a missing objective", { workspace: "foundry_managed", riskClass: "R2" }],
    ["a non-object submission", "just a string"],
  ])("rejects %s with a structured reason and zero mutation", (_label, submission) => {
    const before = fullSnapshot();
    const result = intake.submit(submission, OPERATOR);

    expect(result.accepted).toBe(false);
    expect(result.code).toBe("invalid_objective");
    expect(result.reason).toBeTruthy();
    expect(result.correctiveAction).toBeTruthy();
    expect(fullSnapshot()).toEqual(before);
  });

  it("names the offending field so the operator knows what to change", () => {
    const result = intake.submit({ ...SUBMISSION, riskClass: "R5" }, OPERATOR);
    expect(result.issues?.map((issue) => issue.field)).toContain("riskClass");
  });

  it("reports every offending field at once rather than one per attempt", () => {
    const result = intake.submit(
      { objective: "no", workspace: "elsewhere", riskClass: "R4" },
      OPERATOR,
    );
    const fields = result.issues?.map((issue) => issue.field) ?? [];
    expect(fields).toEqual(expect.arrayContaining(["objective", "workspace", "riskClass"]));
  });
});

describe("ObjectiveIntake — V1 limits are the handler's ruling, reported here", () => {
  it("refuses a second objective while the first project is still open", () => {
    expect(intake.submit(SUBMISSION, OPERATOR).accepted).toBe(true);

    const second = new ObjectiveIntake(handler, (kind) => `${kind}-second`);
    const before = fullSnapshot();
    const result = second.submit(
      { ...SUBMISSION, objective: "Add a second unrelated module" },
      OPERATOR,
    );

    expect(result.accepted).toBe(false);
    expect(result.code).toBe("command_rejected");
    expect(result.reason).toMatch(/one active project/i);
    expect(result.correctiveAction).toBeTruthy();
    expect(fullSnapshot()).toEqual(before);
  });
});

describe("ObjectiveIntake — structural: no second write path", () => {
  it("works when given a CommandHandler and nothing else", () => {
    // The constructor takes no PersistenceService, so intake has no
    // `appendEvent`, no reducer, and no database handle to reach for. This
    // asserts the property the way it is enforced: by what is reachable.
    const isolated = new ObjectiveIntake(new CommandHandler(persistence), fixedIds);
    expect(isolated.submit(SUBMISSION, OPERATOR).accepted).toBe(true);
    expect(persistence.getAllEvents()).toHaveLength(2);
  });

  it("writes nothing at all when its CommandHandler refuses everything", () => {
    const refusing = {
      submit: () => ({
        accepted: false as const,
        commandType: "Project.Create" as const,
        reason: "refused",
      }),
    } as unknown as CommandHandler;
    const blocked = new ObjectiveIntake(refusing, fixedIds);

    const before = fullSnapshot();
    expect(blocked.submit(SUBMISSION, OPERATOR).accepted).toBe(false);
    expect(fullSnapshot()).toEqual(before);
  });
});
