import type { FoundryEvent } from "@foundry/event-types";

/**
 * Produces a short, human-readable summary for the event feed. Every event
 * gets a textual representation (Principle 24) — events not explicitly
 * covered below still get a readable fallback, never a blank row.
 */
export function describeEvent(event: FoundryEvent): string {
  const p = event.payload as Record<string, unknown>;
  switch (event.type) {
    case "system.started":
      return `Neighborhood "${p.neighborhoodId}" started (service ${p.serviceVersion})`;
    case "system.health_changed":
      return `System health changed: ${p.previousHealth} → ${p.newHealth}`;
    case "operator.objective_submitted":
      return `Operator submitted objective: "${p.objective}"`;
    case "operator.plan_reviewed": {
      // The decision and its limit in one line: a reviewer scanning the
      // timeline must not read "proceed" as "execution authorized".
      const decision = String(p.decision);
      const meaning =
        decision === "proceed"
          ? "review recorded, no execution authorized"
          : decision === "rejected"
            ? "plan rejected"
            : "revision requested";
      return `Operator reviewed plan: ${decision} — ${meaning}`;
    }
    case "operator.execution_authorized": {
      // The limit travels with the line. An operator scanning the timeline
      // must not read "authorized" as "running" — permission and the run
      // are separate acts, and only the first of them has happened.
      return `Operator authorized execution of ${String(p.stageName)} (\u2264 $${String(p.maxBudgetUsd)}) — permission only, nothing started`;
    }
    case "operator.command_submitted":
      return `Operator command submitted: ${p.commandType}`;
    case "operator.command_accepted":
      return `Command accepted: ${p.commandType}`;
    case "operator.command_rejected":
      return `Command rejected: ${p.commandType} — ${p.reason}`;
    case "agent.registered":
      return `Agent registered as ${p.role}`;
    case "agent.assigned":
      return `Agent assigned to task ${p.taskId}`;
    case "agent.departed":
      return `Agent departed for ${p.destinationBuildingId}`;
    case "agent.arrived":
      return `Agent arrived at ${p.destinationBuildingId}`;
    case "agent.started_work":
      return `Agent started work (${p.runtimeType})`;
    case "agent.paused":
      return `Agent paused${p.reason ? `: ${p.reason}` : ""}`;
    case "agent.resumed":
      return "Agent resumed";
    case "agent.failed":
      return `Agent failed: ${p.message}`;
    case "agent.completed_work":
      return "Agent completed work";
    case "agent.returned_home":
      return "Agent returned home";
    case "agentrun.started":
      return `Run started (${p.runtimeType}, risk ${p.riskClass})`;
    case "agentrun.completed":
      return `Run completed (exit ${p.exitCode})`;
    case "agentrun.failed":
      return `Run failed: ${p.failureMessage}`;
    case "agentrun.timed_out":
      return "Run timed out";
    // Deliberately does not repeat the objective text. `build.created`
    // carries `objective` as the Build's snapshot of it, but the operator
    // reads these two rows one after the other, and echoing the same
    // sentence twice looked like the objective had been submitted twice.
    // The objective is stated once, on the row that reports its
    // submission; this row reports the new fact, which is that a Build now
    // exists to pursue it. The full payload is still one click away.
    case "build.created":
      return "Build created for the submitted objective";
    case "build.planned":
      return `Build planned (${(p.stageIds as unknown[]).length} stages) — proposal only, nothing scheduled`;
    case "build.ready":
      return "Build ready to start";
    case "build.started":
      return "Build started";
    case "build.paused":
      return "Build paused";
    case "build.resumed":
      return "Build resumed";
    case "build.completed":
      return "Build completed";
    case "build.failed":
      return `Build failed: ${p.failureCode}`;
    case "build.cancelled":
      return "Build cancelled";
    case "stage.created":
      return "Stage created";
    case "stage.ready":
      return "Stage ready";
    case "stage.started":
      return "Stage started";
    case "stage.blocked":
      return `Stage blocked: ${p.reason}`;
    case "stage.validation_started":
      return "Inspector validation started";
    case "stage.validation_passed":
      return "Inspector validation passed";
    case "stage.validation_failed":
      return "Inspector validation failed";
    case "stage.completed":
      return "Stage completed";
    case "stage.failed":
      return "Stage failed";
    case "revision.requested":
      return `Revision requested: ${p.reason}`;
    case "revision.started":
      return "Revision started";
    case "revision.completed":
      return "Revision completed";
    case "requirement.started":
      return "Requirement started";
    case "requirement.passed":
      return "Requirement passed";
    case "requirement.failed":
      return `Requirement failed: ${p.message}`;
    case "requirement.retried":
      return "Requirement retried";
    case "artifact.created":
      return `Artifact created: ${p.name} (${p.artifactType})`;
    case "artifact.validated":
      return "Artifact validated";
    case "artifact.ready":
      return "Artifact ready for transfer";
    case "transfer.created":
      return "Transfer created";
    case "transfer.blocked":
      return `Transfer blocked: ${p.reason}`;
    case "transfer.ready":
      return "Transfer ready";
    case "transfer.started":
      return `Transfer started: ${p.sourceBuildingId} → ${p.destinationBuildingId}`;
    case "transfer.arrived":
      return "Vehicle arrived";
    case "transfer.completed":
      return "Transfer completed — receipt confirmed";
    case "transfer.failed":
      return `Transfer failed: ${p.reason}`;
    case "approval.requested":
      return `Approval requested: ${p.title}`;
    case "approval.approved":
      return `Approval approved by ${p.resolvedBy}`;
    case "approval.rejected":
      return `Approval rejected by ${p.resolvedBy}`;
    case "approval.revision_requested":
      return `Approval resolved as revision requested by ${p.resolvedBy}`;
    case "building.selected":
      return `Building ${p.buildingId} selected`;
    case "building.state_changed":
      return `Building state changed: ${p.priorState} → ${p.newState}`;
    case "upgrade.eligible":
      return "Upgrade became eligible";
    case "upgrade.requested":
      return "Upgrade requested";
    case "upgrade.approved":
      return "Upgrade approved";
    case "upgrade.started":
      return "Upgrade started";
    case "upgrade.completed":
      return `Upgrade completed: level ${p.fromLevel} → ${p.toLevel}`;
    case "upgrade.failed":
      return "Upgrade failed";
    default: {
      // Exhaustive above for the current vocabulary; this only runs if a
      // future event type is added to event-model.md before this switch is
      // updated — it still gets a readable row, never a blank one.
      const fallback = event as { type: string; entityType: string; entityId: string };
      return `${fallback.type} on ${fallback.entityType} ${fallback.entityId}`;
    }
  }
}
