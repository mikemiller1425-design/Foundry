import { describe, expect, it } from "vitest";
import {
  AgentRunSchema,
  AgentSchema,
  ApprovalSchema,
  ArtifactSchema,
  BuildSchema,
  BuildStageSchema,
  BuildingSchema,
  ProjectSchema,
  RequirementSchema,
  RevisionSchema,
  TaskSchema,
  TransferSchema,
  UpgradeSchema,
  VehicleSchema,
  WorldStateSchema,
} from ".";

const now = "2026-07-30T00:00:00.000Z";

const validAgent = {
  id: "agent-1",
  name: "Architect",
  role: "architect",
  status: "idle",
  homeBuildingId: "home-architect",
  currentBuildingId: "home-architect",
  authorityLevel: 1,
  runtimeType: "mock",
  createdAt: now,
  updatedAt: now,
  lastHeartbeatAt: now,
};

const validBuilding = {
  id: "building-1",
  name: "Lighthouse",
  buildingType: "lighthouse",
  level: 1,
  status: "idle",
  position: { x: 0, y: 0, z: 0 },
  capabilities: [],
  createdAt: now,
  updatedAt: now,
};

const validProject = {
  id: "project-1",
  name: "Agent City V1",
  objective: "Build a task-management app",
  status: "active",
  createdAt: now,
  updatedAt: now,
};

const validBuild = {
  id: "build-1",
  projectId: "project-1",
  sequenceNumber: 1,
  status: "planned",
  objectiveSnapshot: "Build a task-management app",
  currentStageId: "stage-1",
  createdAt: now,
  updatedAt: now,
};

const validBuildStage = {
  id: "stage-1",
  buildId: "build-1",
  name: "planning",
  sequence: 1,
  status: "planned",
  required: true,
  sourceBuildingId: "building-office",
  destinationBuildingId: "building-office",
  createdAt: now,
  updatedAt: now,
};

const validRevision = {
  id: "revision-1",
  buildId: "build-1",
  stageId: "stage-1",
  reason: "Requirement failed",
  requestedBy: "approval",
  status: "requested",
  createdAt: now,
  updatedAt: now,
};

const validRequirement = {
  id: "req-1",
  stageId: "stage-1",
  name: "Delete task — error-state handling",
  description: "Deleting a task must surface an error state on failure",
  status: "pending",
  required: true,
  validatorType: "automated",
  evidenceIds: [],
  createdAt: now,
  updatedAt: now,
};

const validTask = {
  id: "task-1",
  stageId: "stage-1",
  title: "Implement delete handler",
  status: "queued",
  assignedAgentId: "agent-1",
  riskClass: "R1",
  inputArtifactIds: [],
  outputArtifactIds: [],
  createdAt: now,
  updatedAt: now,
};

const validAgentRun = {
  id: "run-1",
  agentId: "agent-1",
  taskId: "task-1",
  runtimeType: "mock",
  status: "queued",
  riskClass: "R1",
  startedAt: now,
};

const validArtifact = {
  id: "artifact-1",
  buildId: "build-1",
  stageId: "stage-1",
  artifactType: "plan",
  name: "Build plan",
  status: "draft",
  storageUri: "mock://artifacts/plan",
  checksum: "sha256:abc",
  createdByAgentId: "agent-1",
  createdAt: now,
  updatedAt: now,
};

const validTransfer = {
  id: "transfer-1",
  buildId: "build-1",
  stageId: "stage-integration",
  leg: "construction_office_to_warehouse",
  status: "created",
  sourceBuildingId: "building-office",
  destinationBuildingId: "building-warehouse",
  artifactIds: ["artifact-1"],
  vehicleId: "vehicle-1",
  createdAt: now,
  updatedAt: now,
};

const validVehicle = {
  id: "vehicle-1",
  name: "Utility vehicle",
  vehicleType: "utility",
  status: "parked",
  homeBuildingId: "building-warehouse",
  position: { x: 0, y: 0, z: 0 },
  createdAt: now,
  updatedAt: now,
};

const validApproval = {
  id: "approval-1",
  buildId: "build-1",
  stageId: "stage-deployment_package",
  status: "pending",
  riskClass: "R1",
  title: "Approve deployment package",
  reason: "QA validation passed",
  recommendedAction: "approve",
  evidenceIds: [],
  requestedAt: now,
};

const validUpgrade = {
  id: "upgrade-1",
  buildingId: "building-warehouse",
  fromLevel: 1,
  toLevel: 2,
  status: "locked",
  requirementIds: [],
  createdAt: now,
};

const validWorldState = {
  buildings: [validBuilding],
  agents: [validAgent],
  currentBuild: validBuild,
  activeTransfers: [],
  approvals: [],
  inventoryCounts: { successfulPackages: 9 },
  health: { status: "healthy", reasons: ["nominal"] },
  lastProcessedEventId: null,
};

describe("entity schemas accept a valid record and reject an invalid one", () => {
  const cases: Array<[string, import("zod").ZodType, unknown]> = [
    ["Agent", AgentSchema, validAgent],
    ["Building", BuildingSchema, validBuilding],
    ["Project", ProjectSchema, validProject],
    ["Build", BuildSchema, validBuild],
    ["BuildStage", BuildStageSchema, validBuildStage],
    ["Revision", RevisionSchema, validRevision],
    ["Requirement", RequirementSchema, validRequirement],
    ["Task", TaskSchema, validTask],
    ["AgentRun", AgentRunSchema, validAgentRun],
    ["Artifact", ArtifactSchema, validArtifact],
    ["Transfer", TransferSchema, validTransfer],
    ["Vehicle", VehicleSchema, validVehicle],
    ["Approval", ApprovalSchema, validApproval],
    ["Upgrade", UpgradeSchema, validUpgrade],
    ["WorldState", WorldStateSchema, validWorldState],
  ];

  for (const [name, schema, valid] of cases) {
    it(`${name}: accepts a valid record`, () => {
      expect(schema.safeParse(valid).success).toBe(true);
    });

    it(`${name}: rejects a record missing a required field`, () => {
      const { id: _omit, ...withoutId } = valid as Record<string, unknown>;
      void _omit;
      const result = schema.safeParse(withoutId);
      // WorldState has no top-level "id" field; strip a field that exists instead.
      if (name === "WorldState") {
        const { health: _h, ...withoutHealth } = valid as Record<string, unknown>;
        void _h;
        expect(schema.safeParse(withoutHealth).success).toBe(false);
      } else {
        expect(result.success).toBe(false);
      }
    });

    it(`${name}: rejects an unknown enum/status value where the schema defines a closed vocabulary`, () => {
      const statusKey = "status" in (valid as Record<string, unknown>) ? "status" : null;
      if (!statusKey) return;
      const invalid = { ...(valid as Record<string, unknown>), [statusKey]: "not_a_real_status" };
      expect(schema.safeParse(invalid).success).toBe(false);
    });
  }
});

describe("closed status vocabularies are exhaustive per domain-model.md", () => {
  it("BuildStage V1 limits to exactly the seven named stages, in sequence", () => {
    const stages = [
      "planning",
      "scaffold",
      "frontend_implementation",
      "backend_implementation",
      "integration",
      "qa_validation",
      "deployment_package",
    ];
    for (const name of stages) {
      expect(BuildStageSchema.safeParse({ ...validBuildStage, name }).success).toBe(true);
    }
    expect(BuildStageSchema.safeParse({ ...validBuildStage, name: "extra_stage" }).success).toBe(
      false,
    );
  });

  it("Transfer accepts only the three defined legs", () => {
    for (const leg of [
      "construction_office_to_warehouse",
      "warehouse_to_qa",
      "qa_to_deployment_dock",
    ]) {
      expect(TransferSchema.safeParse({ ...validTransfer, leg }).success).toBe(true);
    }
    expect(TransferSchema.safeParse({ ...validTransfer, leg: "warehouse_to_dock" }).success).toBe(
      false,
    );
  });

  it("Vehicle vehicleType is fixed to 'utility' (V1 limits: exactly one vehicle type)", () => {
    expect(VehicleSchema.safeParse({ ...validVehicle, vehicleType: "cargo_truck" }).success).toBe(
      false,
    );
  });

  it("AgentRun/Task riskClass rejects R3–R5 (V1 limits to R0–R2)", () => {
    expect(TaskSchema.safeParse({ ...validTask, riskClass: "R3" }).success).toBe(false);
    expect(AgentRunSchema.safeParse({ ...validAgentRun, riskClass: "R4" }).success).toBe(false);
  });
});
