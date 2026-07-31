import type { FoundryEvent } from "@foundry/event-types";
import { WORLD_AGENTS, WORLD_BUILDINGS, WORLD_VEHICLE } from "@foundry/world-model";
import { createIdGenerator } from "./ids";
import { createEventFactory } from "./eventFactory";

function buildingId(type: string): string {
  const match = WORLD_BUILDINGS.find((b) => b.buildingType === type);
  if (!match) throw new Error(`No world building of type "${type}"`);
  return match.id;
}

const HOME_ARCHITECT = "home-architect";
const HOME_BUILDER = "home-builder";
const HOME_INSPECTOR = "home-inspector";
const CONSTRUCTION_OFFICE = buildingId("construction_office");
const WAREHOUSE = buildingId("warehouse");
const QA = buildingId("qa");
const DEPLOYMENT_DOCK = buildingId("deployment_dock");

const ARCHITECT = WORLD_AGENTS.find((a) => a.role === "architect")!.id;
const BUILDER = WORLD_AGENTS.find((a) => a.role === "builder")!.id;
const INSPECTOR = WORLD_AGENTS.find((a) => a.role === "inspector")!.id;
const VEHICLE = WORLD_VEHICLE.id;

const OBJECTIVE =
  "Build a basic task-management web application supporting task creation, completion, deletion, loading states, error states, persistence, and tests.";

export const STAGE_NAMES = [
  "planning",
  "scaffold",
  "frontend_implementation",
  "backend_implementation",
  "integration",
  "qa_validation",
  "deployment_package",
] as const;

/**
 * Builds the complete, ordered, deterministic V1 demonstration event
 * sequence (docs/01-mission/v1-scope.md § "Required workflow", canonical
 * B-01 sequence work→validate→approve→transfer→dock). Pure function: same
 * seed always produces the identical event sequence (ids/timestamps
 * included) — FBL-008's determinism requirement.
 */
export function buildCanonicalScript(seed: string): FoundryEvent[] {
  const id = createIdGenerator(seed);
  const projectId = id("project");
  const buildId = id("build");
  const event = createEventFactory(seed, buildId);

  const stageIds: Record<(typeof STAGE_NAMES)[number], string> = {
    planning: id("stage-planning"),
    scaffold: id("stage-scaffold"),
    frontend_implementation: id("stage-frontend"),
    backend_implementation: id("stage-backend"),
    integration: id("stage-integration"),
    qa_validation: id("stage-qa"),
    deployment_package: id("stage-deploy"),
  };

  const events: FoundryEvent[] = [];
  const push = (e: FoundryEvent) => events.push(e);

  // --- System + agent registration -----------------------------------
  push(
    event({
      type: "system.started",
      entityType: "System",
      entityId: "neighborhood-1",
      actorType: "backend",
      actorId: "backend",
      payload: { serviceVersion: "1.0.0", neighborhoodId: "neighborhood-1" },
    }),
  );
  for (const agent of WORLD_AGENTS) {
    push(
      event({
        type: "agent.registered",
        entityType: "Agent",
        entityId: agent.id,
        actorType: "backend",
        actorId: "backend",
        payload: { role: agent.role, homeBuildingId: agent.homeBuildingId },
      }),
    );
  }

  // --- Objective submission + build creation (v1-scope steps 1-2) ----
  push(
    event({
      type: "operator.objective_submitted",
      entityType: "Project",
      entityId: projectId,
      actorType: "operator",
      actorId: "operator-1",
      payload: { objective: OBJECTIVE, projectId },
    }),
  );
  push(
    event({
      type: "build.created",
      entityType: "Build",
      entityId: buildId,
      actorType: "backend",
      actorId: "backend",
      payload: { projectId, buildId, objective: OBJECTIVE },
    }),
  );

  // --- Stage 1: planning (Architect) — v1-scope step 3 ---------------
  const planArtifactId = id("artifact-plan");
  push(stageCreated(event, stageIds.planning));
  push(stageReady(event, stageIds.planning));
  travelAndWork(event, push, {
    agentId: ARCHITECT,
    homeBuildingId: HOME_ARCHITECT,
    destinationBuildingId: CONSTRUCTION_OFFICE,
    stageId: stageIds.planning,
    taskId: id("task-planning"),
    runtimeType: "mock",
    riskClass: "R0",
    outputArtifactIds: [planArtifactId],
  });
  artifactLifecycle(event, push, planArtifactId, "plan", "Build plan");
  push(
    event({
      type: "build.planned",
      entityType: "Build",
      entityId: buildId,
      actorType: "backend",
      actorId: "backend",
      payload: {
        stageIds: Object.values(stageIds),
        requirementCount: 3,
        planArtifactId,
      },
    }),
  );
  push(stageCompleted(event, stageIds.planning, [planArtifactId]));
  push(returnedHome(event, ARCHITECT, HOME_ARCHITECT));
  push(
    event({
      type: "build.ready",
      entityType: "Build",
      entityId: buildId,
      actorType: "backend",
      actorId: "backend",
      payload: {},
    }),
  );
  push(
    event({
      type: "build.started",
      entityType: "Build",
      entityId: buildId,
      actorType: "backend",
      actorId: "backend",
      payload: {},
    }),
  );

  // --- Stage 2: scaffold (Builder) — v1-scope step 4 ------------------
  const scaffoldArtifactId = id("artifact-scaffold");
  push(stageCreated(event, stageIds.scaffold));
  push(stageReady(event, stageIds.scaffold));
  travelAndWork(event, push, {
    agentId: BUILDER,
    homeBuildingId: HOME_BUILDER,
    destinationBuildingId: CONSTRUCTION_OFFICE,
    stageId: stageIds.scaffold,
    taskId: id("task-scaffold"),
    runtimeType: "mock",
    riskClass: "R1",
    outputArtifactIds: [scaffoldArtifactId],
  });
  artifactLifecycle(event, push, scaffoldArtifactId, "source_code", "Application scaffold");
  push(stageCompleted(event, stageIds.scaffold, [scaffoldArtifactId]));

  // --- Stage 3: frontend_implementation (Builder) — intentional failure
  //     (v1-scope steps 5-9: incremental requirements, one failure,
  //     blocked progression, retry/repair) ------------------------------
  const frontendArtifactId = id("artifact-frontend");
  push(stageCreated(event, stageIds.frontend_implementation));
  push(stageReady(event, stageIds.frontend_implementation));
  push(
    event({
      type: "stage.started",
      entityType: "BuildStage",
      entityId: stageIds.frontend_implementation,
      actorType: "backend",
      actorId: "backend",
      payload: { assignedAgentIds: [BUILDER], sourceBuildingId: CONSTRUCTION_OFFICE },
    }),
  );

  const createRequirement = id("requirement-create-task");
  push(requirementPassed(event, createRequirement, "Create task"));
  const completeRequirement = id("requirement-complete-task");
  push(requirementPassed(event, completeRequirement, "Complete task"));

  const deleteRequirement = id("requirement-delete-task");
  push(
    event({
      type: "requirement.started",
      entityType: "Requirement",
      entityId: deleteRequirement,
      actorType: "agent",
      actorId: BUILDER,
      payload: {},
    }),
  );
  const failedEvent = event({
    type: "requirement.failed",
    entityType: "Requirement",
    entityId: deleteRequirement,
    actorType: "agent",
    actorId: BUILDER,
    payload: {
      evidenceIds: [],
      message:
        "Delete task — error-state handling: deleting a task does not surface an error state on failure",
      retryEligible: true,
    },
  });
  push(failedEvent);
  push(
    event({
      type: "stage.blocked",
      entityType: "BuildStage",
      entityId: stageIds.frontend_implementation,
      actorType: "backend",
      actorId: "backend",
      payload: { requirementIds: [deleteRequirement], reason: "Mandatory requirement failed" },
      causationId: failedEvent.id,
    }),
  );
  push(
    event({
      type: "requirement.retried",
      entityType: "Requirement",
      entityId: deleteRequirement,
      actorType: "agent",
      actorId: BUILDER,
      payload: { priorEventId: failedEvent.id },
      causationId: failedEvent.id,
    }),
  );
  push(
    event({
      type: "requirement.started",
      entityType: "Requirement",
      entityId: deleteRequirement,
      actorType: "agent",
      actorId: BUILDER,
      payload: {},
    }),
  );
  push(requirementPassed(event, deleteRequirement, "Delete task — error-state handling (retry)"));

  const frontendRunId = id("run-frontend");
  push(
    event({
      type: "agentrun.started",
      entityType: "AgentRun",
      entityId: frontendRunId,
      actorType: "agent",
      actorId: BUILDER,
      payload: {
        agentId: BUILDER,
        taskId: id("task-frontend"),
        runtimeType: "mock",
        riskClass: "R1",
      },
    }),
  );
  push(
    event({
      type: "agentrun.completed",
      entityType: "AgentRun",
      entityId: frontendRunId,
      actorType: "runtime_adapter",
      actorId: "runtime-adapter-mock",
      payload: { exitCode: 0, outputArtifactIds: [frontendArtifactId], evidenceIds: [] },
    }),
  );
  artifactLifecycle(event, push, frontendArtifactId, "source_code", "Frontend implementation");
  push(stageCompleted(event, stageIds.frontend_implementation, [frontendArtifactId]));

  // --- Stage 4: backend_implementation (Builder via claude_code) ------
  const backendArtifactId = id("artifact-backend");
  push(stageCreated(event, stageIds.backend_implementation));
  push(stageReady(event, stageIds.backend_implementation));
  push(
    event({
      type: "stage.started",
      entityType: "BuildStage",
      entityId: stageIds.backend_implementation,
      actorType: "backend",
      actorId: "backend",
      payload: { assignedAgentIds: [BUILDER], sourceBuildingId: CONSTRUCTION_OFFICE },
    }),
  );
  const backendRunId = id("run-backend");
  push(
    event({
      type: "agentrun.started",
      entityType: "AgentRun",
      entityId: backendRunId,
      actorType: "agent",
      actorId: BUILDER,
      // The one V1 stage that uses the claude_code runtime (domain-model.md
      // AgentRun invariants). This is still a simulated, mocked record —
      // FBL-008 invokes no real runtime.
      payload: {
        agentId: BUILDER,
        taskId: id("task-backend"),
        runtimeType: "claude_code",
        riskClass: "R1",
      },
    }),
  );
  push(
    event({
      type: "agentrun.completed",
      entityType: "AgentRun",
      entityId: backendRunId,
      actorType: "runtime_adapter",
      actorId: "runtime-adapter-mock",
      payload: { exitCode: 0, outputArtifactIds: [backendArtifactId], evidenceIds: [] },
    }),
  );
  push(
    requirementPassed(event, id("requirement-backend-tests"), "Backend persistence and API tests"),
  );
  artifactLifecycle(event, push, backendArtifactId, "source_code", "Backend implementation");
  push(stageCompleted(event, stageIds.backend_implementation, [backendArtifactId]));

  // --- Stage 5: integration (Builder) + CO→WH transfer ----------------
  const buildPackageArtifactId = id("artifact-build-package");
  push(stageCreated(event, stageIds.integration));
  push(stageReady(event, stageIds.integration));
  travelAndWork(event, push, {
    agentId: BUILDER,
    homeBuildingId: HOME_BUILDER,
    destinationBuildingId: CONSTRUCTION_OFFICE,
    alreadyAtDestination: true,
    stageId: stageIds.integration,
    taskId: id("task-integration"),
    runtimeType: "mock",
    riskClass: "R1",
    outputArtifactIds: [buildPackageArtifactId],
  });
  artifactLifecycle(
    event,
    push,
    buildPackageArtifactId,
    "build_package",
    "Integrated build package",
  );
  const integrationCompleted = stageCompleted(event, stageIds.integration, [
    buildPackageArtifactId,
  ]);
  push(integrationCompleted);
  push(returnedHome(event, BUILDER, HOME_BUILDER));

  const transferCoToWh = id("transfer-co-wh");
  push(
    event({
      type: "transfer.created",
      entityType: "Transfer",
      entityId: transferCoToWh,
      actorType: "backend",
      actorId: "backend",
      payload: {},
    }),
  );
  push(
    event({
      type: "transfer.ready",
      entityType: "Transfer",
      entityId: transferCoToWh,
      actorType: "backend",
      actorId: "backend",
      payload: {},
      causationId: integrationCompleted.id,
    }),
  );
  const transferCoToWhStarted = event({
    type: "transfer.started",
    entityType: "Transfer",
    entityId: transferCoToWh,
    actorType: "backend",
    actorId: "backend",
    payload: {
      vehicleId: VEHICLE,
      sourceBuildingId: CONSTRUCTION_OFFICE,
      destinationBuildingId: WAREHOUSE,
      artifactIds: [buildPackageArtifactId],
    },
  });
  push(transferCoToWhStarted);
  push(
    event({
      type: "transfer.arrived",
      entityType: "Transfer",
      entityId: transferCoToWh,
      actorType: "backend",
      actorId: "backend",
      payload: {},
    }),
  );
  const transferCoToWhCompleted = event({
    type: "transfer.completed",
    entityType: "Transfer",
    entityId: transferCoToWh,
    actorType: "backend",
    actorId: "backend",
    payload: { receiptArtifactId: buildPackageArtifactId },
  });
  push(transferCoToWhCompleted);

  // --- Stage 6: qa_validation (Inspector) + WH→QA transfer ------------
  push(stageCreated(event, stageIds.qa_validation));
  push(
    event({
      type: "stage.ready",
      entityType: "BuildStage",
      entityId: stageIds.qa_validation,
      actorType: "backend",
      actorId: "backend",
      payload: {},
      causationId: integrationCompleted.id,
    }),
  );

  const transferWhToQa = id("transfer-wh-qa");
  push(
    event({
      type: "transfer.created",
      entityType: "Transfer",
      entityId: transferWhToQa,
      actorType: "backend",
      actorId: "backend",
      payload: {},
    }),
  );
  push(
    event({
      type: "transfer.ready",
      entityType: "Transfer",
      entityId: transferWhToQa,
      actorType: "backend",
      actorId: "backend",
      payload: {},
    }),
  );
  push(
    event({
      type: "transfer.started",
      entityType: "Transfer",
      entityId: transferWhToQa,
      actorType: "backend",
      actorId: "backend",
      payload: {
        vehicleId: VEHICLE,
        sourceBuildingId: WAREHOUSE,
        destinationBuildingId: QA,
        artifactIds: [buildPackageArtifactId],
      },
    }),
  );
  push(
    event({
      type: "transfer.arrived",
      entityType: "Transfer",
      entityId: transferWhToQa,
      actorType: "backend",
      actorId: "backend",
      payload: {},
    }),
  );
  const transferWhToQaCompleted = event({
    type: "transfer.completed",
    entityType: "Transfer",
    entityId: transferWhToQa,
    actorType: "backend",
    actorId: "backend",
    payload: { receiptArtifactId: buildPackageArtifactId },
  });
  push(transferWhToQaCompleted);

  // Inspector validation begins only after receipt at QA (resolves B-01).
  push(
    event({
      type: "stage.started",
      entityType: "BuildStage",
      entityId: stageIds.qa_validation,
      actorType: "backend",
      actorId: "backend",
      payload: { assignedAgentIds: [INSPECTOR], sourceBuildingId: QA },
      causationId: transferWhToQaCompleted.id,
    }),
  );
  push(
    event({
      type: "agent.assigned",
      entityType: "Agent",
      entityId: INSPECTOR,
      actorType: "backend",
      actorId: "backend",
      payload: {
        taskId: id("task-qa"),
        stageId: stageIds.qa_validation,
        destinationBuildingId: QA,
      },
    }),
  );
  push(
    event({
      type: "agent.departed",
      entityType: "Agent",
      entityId: INSPECTOR,
      actorType: "agent",
      actorId: INSPECTOR,
      payload: { sourceBuildingId: HOME_INSPECTOR, destinationBuildingId: QA },
    }),
  );
  push(
    event({
      type: "agent.arrived",
      entityType: "Agent",
      entityId: INSPECTOR,
      actorType: "agent",
      actorId: INSPECTOR,
      payload: { destinationBuildingId: QA },
    }),
  );
  push(
    event({
      type: "stage.validation_started",
      entityType: "BuildStage",
      entityId: stageIds.qa_validation,
      actorType: "agent",
      actorId: INSPECTOR,
      payload: {},
    }),
  );
  const qaRunId = id("run-qa");
  push(
    event({
      type: "agentrun.started",
      entityType: "AgentRun",
      entityId: qaRunId,
      actorType: "agent",
      actorId: INSPECTOR,
      payload: {
        agentId: INSPECTOR,
        taskId: id("task-qa-run"),
        runtimeType: "mock",
        riskClass: "R0",
      },
    }),
  );
  push(
    event({
      type: "agentrun.completed",
      entityType: "AgentRun",
      entityId: qaRunId,
      actorType: "runtime_adapter",
      actorId: "runtime-adapter-mock",
      payload: { exitCode: 0, outputArtifactIds: [], evidenceIds: [] },
    }),
  );
  const qaRequirement = id("requirement-independent-validation");
  push(requirementPassed(event, qaRequirement, "Independent validation"));
  push(
    event({
      type: "stage.validation_passed",
      entityType: "BuildStage",
      entityId: stageIds.qa_validation,
      actorType: "agent",
      actorId: INSPECTOR,
      payload: { evidenceIds: [], passedRequirementIds: [qaRequirement] },
    }),
  );
  const testReportArtifactId = id("artifact-test-report");
  artifactLifecycle(event, push, testReportArtifactId, "test_report", "QA test report");
  push(
    stageCompleted(event, stageIds.qa_validation, [testReportArtifactId, buildPackageArtifactId]),
  );
  push(returnedHome(event, INSPECTOR, HOME_INSPECTOR));

  // --- Approval + Stage 7: deployment_package + QA→Dock transfer -----
  const approvalId = id("approval-deploy");
  push(
    event({
      type: "approval.requested",
      entityType: "Approval",
      entityId: approvalId,
      actorType: "backend",
      actorId: "backend",
      payload: {
        approvalId,
        title: "Approve deployment package",
        reason: "QA validation passed; artifact ready for final transfer",
        riskClass: "R1",
        evidenceIds: [testReportArtifactId],
        recommendedAction: "approve",
      },
    }),
  );
  push(
    event({
      type: "approval.approved",
      entityType: "Approval",
      entityId: approvalId,
      actorType: "operator",
      actorId: "operator-1",
      payload: {
        resolvedBy: "operator-1",
        resolutionNote: "Validated build package approved for deployment",
      },
    }),
  );

  push(stageCreated(event, stageIds.deployment_package));
  push(
    event({
      type: "stage.ready",
      entityType: "BuildStage",
      entityId: stageIds.deployment_package,
      actorType: "backend",
      actorId: "backend",
      payload: {},
    }),
  );

  const transferQaToDock = id("transfer-qa-dock");
  push(
    event({
      type: "transfer.created",
      entityType: "Transfer",
      entityId: transferQaToDock,
      actorType: "backend",
      actorId: "backend",
      payload: {},
    }),
  );
  push(
    event({
      type: "transfer.ready",
      entityType: "Transfer",
      entityId: transferQaToDock,
      actorType: "backend",
      actorId: "backend",
      payload: {},
    }),
  );
  push(
    event({
      type: "stage.started",
      entityType: "BuildStage",
      entityId: stageIds.deployment_package,
      actorType: "backend",
      actorId: "backend",
      payload: { assignedAgentIds: [], sourceBuildingId: QA },
    }),
  );
  push(
    event({
      type: "transfer.started",
      entityType: "Transfer",
      entityId: transferQaToDock,
      actorType: "backend",
      actorId: "backend",
      payload: {
        vehicleId: VEHICLE,
        sourceBuildingId: QA,
        destinationBuildingId: DEPLOYMENT_DOCK,
        artifactIds: [buildPackageArtifactId],
      },
    }),
  );
  push(
    event({
      type: "transfer.arrived",
      entityType: "Transfer",
      entityId: transferQaToDock,
      actorType: "backend",
      actorId: "backend",
      payload: {},
    }),
  );
  const transferQaToDockCompleted = event({
    type: "transfer.completed",
    entityType: "Transfer",
    entityId: transferQaToDock,
    actorType: "backend",
    actorId: "backend",
    payload: { receiptArtifactId: buildPackageArtifactId },
  });
  push(transferQaToDockCompleted);

  const deploymentPackageArtifactId = id("artifact-deployment-package");
  artifactLifecycle(
    event,
    push,
    deploymentPackageArtifactId,
    "deployment_package",
    "Final deployment package",
  );
  const deploymentStageCompleted = event({
    type: "stage.completed",
    entityType: "BuildStage",
    entityId: stageIds.deployment_package,
    actorType: "backend",
    actorId: "backend",
    payload: {
      artifactIds: [deploymentPackageArtifactId],
      completedAt: transferQaToDockCompleted.occurredAt,
    },
    causationId: transferQaToDockCompleted.id,
  });
  push(deploymentStageCompleted);
  push(
    event({
      type: "build.completed",
      entityType: "Build",
      entityId: buildId,
      actorType: "backend",
      actorId: "backend",
      payload: {
        finalArtifactIds: [deploymentPackageArtifactId],
        completedAt: deploymentStageCompleted.occurredAt,
      },
      causationId: deploymentStageCompleted.id,
    }),
  );

  // --- Warehouse upgrade eligibility + approval + completion ----------
  // (resolves audit finding M-06: 9 seeded + this build's 1 = 10)
  const upgradeId = id("upgrade-warehouse");
  push(
    event({
      type: "upgrade.eligible",
      entityType: "Upgrade",
      entityId: upgradeId,
      actorType: "backend",
      actorId: "backend",
      payload: {
        buildingId: WAREHOUSE,
        upgradeId,
        requirementEvidence: [
          "10 successful artifact packages processed",
          "No unresolved critical event",
          "≥ 90% validation pass rate after retries",
          "Event persistence verified",
        ],
      },
    }),
  );
  push(
    event({
      type: "upgrade.requested",
      entityType: "Upgrade",
      entityId: upgradeId,
      actorType: "operator",
      actorId: "operator-1",
      payload: {},
    }),
  );
  push(
    event({
      type: "upgrade.approved",
      entityType: "Upgrade",
      entityId: upgradeId,
      actorType: "operator",
      actorId: "operator-1",
      payload: {},
    }),
  );
  push(
    event({
      type: "upgrade.started",
      entityType: "Upgrade",
      entityId: upgradeId,
      actorType: "backend",
      actorId: "backend",
      payload: {},
    }),
  );
  push(
    event({
      type: "upgrade.completed",
      entityType: "Upgrade",
      entityId: upgradeId,
      actorType: "backend",
      actorId: "backend",
      payload: { fromLevel: 1, toLevel: 2, capabilitiesAdded: ["capacity_100", "batch_intake"] },
    }),
  );

  return events;
}

// --- Small local helpers (kept file-local; not part of the public API) ---

type EventFactory = ReturnType<typeof createEventFactory>;

function stageCreated(event: EventFactory, stageId: string): FoundryEvent {
  return event({
    type: "stage.created",
    entityType: "BuildStage",
    entityId: stageId,
    actorType: "backend",
    actorId: "backend",
    payload: {},
  });
}

function stageReady(event: EventFactory, stageId: string): FoundryEvent {
  return event({
    type: "stage.ready",
    entityType: "BuildStage",
    entityId: stageId,
    actorType: "backend",
    actorId: "backend",
    payload: {},
  });
}

function stageCompleted(event: EventFactory, stageId: string, artifactIds: string[]): FoundryEvent {
  // completedAt is the moment this event occurs — built with a placeholder,
  // then set to the event's own deterministic occurredAt (never real
  // wall-clock time, which would break same-seed determinism).
  const built = event({
    type: "stage.completed",
    entityType: "BuildStage",
    entityId: stageId,
    actorType: "backend",
    actorId: "backend",
    payload: { artifactIds, completedAt: "2026-07-30T00:00:00.000Z" },
  });
  return { ...built, payload: { ...built.payload, completedAt: built.occurredAt } } as FoundryEvent;
}

function requirementPassed(
  event: EventFactory,
  requirementId: string,
  _label: string,
): FoundryEvent {
  return event({
    type: "requirement.passed",
    entityType: "Requirement",
    entityId: requirementId,
    actorType: "agent",
    actorId: "backend",
    payload: { evidenceIds: [], validatorType: "automated" },
  });
}

function artifactLifecycle(
  event: EventFactory,
  push: (e: FoundryEvent) => void,
  artifactId: string,
  artifactType: string,
  name: string,
): FoundryEvent {
  push(
    event({
      type: "artifact.created",
      entityType: "Artifact",
      entityId: artifactId,
      actorType: "backend",
      actorId: "backend",
      payload: { artifactId, artifactType, name, checksumStatus: "pending" },
    }),
  );
  push(
    event({
      type: "artifact.validated",
      entityType: "Artifact",
      entityId: artifactId,
      actorType: "backend",
      actorId: "backend",
      payload: { checksum: `sha256:${artifactId}`, evidenceIds: [] },
    }),
  );
  const ready = event({
    type: "artifact.ready",
    entityType: "Artifact",
    entityId: artifactId,
    actorType: "backend",
    actorId: "backend",
    payload: {},
  });
  push(ready);
  return ready;
}

function returnedHome(event: EventFactory, agentId: string, homeBuildingId: string): FoundryEvent {
  return event({
    type: "agent.returned_home",
    entityType: "Agent",
    entityId: agentId,
    actorType: "agent",
    actorId: agentId,
    payload: { homeBuildingId },
  });
}

interface TravelAndWorkOptions {
  agentId: string;
  homeBuildingId: string;
  destinationBuildingId: string;
  stageId: string;
  taskId: string;
  runtimeType: "mock" | "claude_code";
  riskClass: "R0" | "R1" | "R2";
  outputArtifactIds: string[];
  alreadyAtDestination?: boolean;
}

function travelAndWork(
  event: EventFactory,
  push: (e: FoundryEvent) => void,
  options: TravelAndWorkOptions,
): void {
  push(
    event({
      type: "agent.assigned",
      entityType: "Agent",
      entityId: options.agentId,
      actorType: "backend",
      actorId: "backend",
      payload: {
        taskId: options.taskId,
        stageId: options.stageId,
        destinationBuildingId: options.destinationBuildingId,
      },
    }),
  );
  if (!options.alreadyAtDestination) {
    push(
      event({
        type: "agent.departed",
        entityType: "Agent",
        entityId: options.agentId,
        actorType: "agent",
        actorId: options.agentId,
        payload: {
          sourceBuildingId: options.homeBuildingId,
          destinationBuildingId: options.destinationBuildingId,
        },
      }),
    );
    push(
      event({
        type: "agent.arrived",
        entityType: "Agent",
        entityId: options.agentId,
        actorType: "agent",
        actorId: options.agentId,
        payload: { destinationBuildingId: options.destinationBuildingId },
      }),
    );
  }
  push(
    event({
      type: "stage.started",
      entityType: "BuildStage",
      entityId: options.stageId,
      actorType: "backend",
      actorId: "backend",
      payload: {
        assignedAgentIds: [options.agentId],
        sourceBuildingId: options.destinationBuildingId,
      },
    }),
  );
  push(
    event({
      type: "agent.started_work",
      entityType: "Agent",
      entityId: options.agentId,
      actorType: "agent",
      actorId: options.agentId,
      payload: {
        taskId: options.taskId,
        stageId: options.stageId,
        runtimeType: options.runtimeType,
      },
    }),
  );
  const runId = `${options.taskId}-run`;
  push(
    event({
      type: "agentrun.started",
      entityType: "AgentRun",
      entityId: runId,
      actorType: "agent",
      actorId: options.agentId,
      payload: {
        agentId: options.agentId,
        taskId: options.taskId,
        runtimeType: options.runtimeType,
        riskClass: options.riskClass,
      },
    }),
  );
  push(
    event({
      type: "agentrun.completed",
      entityType: "AgentRun",
      entityId: runId,
      actorType: "runtime_adapter",
      actorId: "runtime-adapter-mock",
      payload: { exitCode: 0, outputArtifactIds: options.outputArtifactIds, evidenceIds: [] },
    }),
  );
  push(
    event({
      type: "agent.completed_work",
      entityType: "Agent",
      entityId: options.agentId,
      actorType: "agent",
      actorId: options.agentId,
      payload: { taskId: options.taskId, outputArtifactIds: options.outputArtifactIds },
    }),
  );
}
