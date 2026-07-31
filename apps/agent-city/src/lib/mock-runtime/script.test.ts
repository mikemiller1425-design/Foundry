import { FoundryEventSchema } from "@foundry/event-types";
import { WORLD_AGENTS } from "@foundry/world-model";
import { describe, expect, it } from "vitest";
import { buildCanonicalScript } from "./script";

describe("buildCanonicalScript — deterministic ordering", () => {
  it("the same seed produces byte-identical events on every call", () => {
    const a = buildCanonicalScript("seed-a");
    const b = buildCanonicalScript("seed-a");
    expect(a).toEqual(b);
  });

  it("different seeds produce the same structural sequence but different ids", () => {
    const a = buildCanonicalScript("seed-a");
    const b = buildCanonicalScript("seed-b");
    expect(a.map((e) => e.type)).toEqual(b.map((e) => e.type));
    expect(a[0]?.id).not.toBe(b[0]?.id);
  });

  it("event order never regresses in occurredAt (append-only, chronological)", () => {
    const script = buildCanonicalScript("order-check");
    for (let i = 1; i < script.length; i++) {
      const current = script[i];
      const previous = script[i - 1];
      expect(current).toBeDefined();
      expect(previous).toBeDefined();
      expect(Date.parse(current!.occurredAt)).toBeGreaterThanOrEqual(
        Date.parse(previous!.occurredAt),
      );
    }
  });

  it("every event in the script independently validates against FoundryEventSchema", () => {
    const script = buildCanonicalScript("validate-all");
    for (const e of script) {
      expect(FoundryEventSchema.safeParse(e).success).toBe(true);
    }
  });

  it("event ids are unique within a single script (idempotency precondition)", () => {
    const script = buildCanonicalScript("unique-ids");
    const ids = script.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buildCanonicalScript — complete canonical demo coverage", () => {
  const script = buildCanonicalScript("coverage");
  const types = script.map((e) => e.type);

  it("covers objective submission through build creation", () => {
    expect(types).toContain("operator.objective_submitted");
    expect(types).toContain("build.created");
  });

  it("covers Architect plan/stages and Builder assignment", () => {
    expect(types).toContain("build.planned");
    expect(types.filter((t) => t === "agent.assigned").length).toBeGreaterThanOrEqual(3);
  });

  it("covers incremental requirements including the one intentional failure and recovery", () => {
    const failed = script.filter((e) => e.type === "requirement.failed");
    expect(failed).toHaveLength(1);
    expect(types).toContain("requirement.retried");
    expect(types).toContain("stage.blocked");
    const passedCount = script.filter((e) => e.type === "requirement.passed").length;
    expect(passedCount).toBeGreaterThan(0);
  });

  it("covers Inspector validation strictly after artifact readiness/transfer", () => {
    expect(types).toContain("stage.validation_started");
    expect(types).toContain("stage.validation_passed");
    expect(types.filter((t) => t === "stage.validation_failed")).toHaveLength(0);
  });

  it("F-05: only the Inspector ever authors stage.validation_started/passed — the Builder cannot self-certify", () => {
    const builderId = WORLD_AGENTS.find((a) => a.role === "builder")!.id;
    const inspectorId = WORLD_AGENTS.find((a) => a.role === "inspector")!.id;
    const validationEvents = script.filter(
      (e) => e.type === "stage.validation_started" || e.type === "stage.validation_passed",
    );
    expect(validationEvents.length).toBeGreaterThan(0);
    for (const event of validationEvents) {
      expect(event.actorId).toBe(inspectorId);
      expect(event.actorId).not.toBe(builderId);
    }
  });

  it("covers all three transfer legs in order (resolves audit finding B-01)", () => {
    const transferStarts = script.filter((e) => e.type === "transfer.started");
    expect(transferStarts).toHaveLength(3);
    const legs = transferStarts.map(
      (e) => e.payload as { sourceBuildingId: string; destinationBuildingId: string },
    );
    expect(legs).toHaveLength(3);
    const [leg1, leg2, leg3] = legs as [
      { sourceBuildingId: string; destinationBuildingId: string },
      { sourceBuildingId: string; destinationBuildingId: string },
      { sourceBuildingId: string; destinationBuildingId: string },
    ];
    expect(leg1.sourceBuildingId).toBe("construction-office");
    expect(leg1.destinationBuildingId).toBe("warehouse");
    expect(leg2.sourceBuildingId).toBe("warehouse");
    expect(leg2.destinationBuildingId).toBe("qa");
    expect(leg3.sourceBuildingId).toBe("qa");
    expect(leg3.destinationBuildingId).toBe("deployment-dock");
  });

  it("covers approval request and approve", () => {
    expect(types).toContain("approval.requested");
    expect(types).toContain("approval.approved");
    expect(types).not.toContain("approval.rejected");
  });

  it("covers final completion", () => {
    expect(types).toContain("build.completed");
    expect(types[types.length - 1]).toBe("upgrade.completed");
  });

  it("covers Warehouse upgrade eligibility, approval, start, and completion in order", () => {
    const upgradeEvents = types.filter((t) => t.startsWith("upgrade."));
    expect(upgradeEvents).toEqual([
      "upgrade.eligible",
      "upgrade.requested",
      "upgrade.approved",
      "upgrade.started",
      "upgrade.completed",
    ]);
    const completed = script.find((e) => e.type === "upgrade.completed");
    expect(completed?.payload).toMatchObject({ fromLevel: 1, toLevel: 2 });
  });
});

describe("buildCanonicalScript — ordering invariants (resolves audit finding B-01)", () => {
  const script = buildCanonicalScript("ordering");
  const indexOf = (predicate: (e: (typeof script)[number]) => boolean) =>
    script.findIndex(predicate);

  it("QA receipt (Warehouse→QA transfer.completed) precedes Inspector's stage.started", () => {
    const receiptIndex = script.findIndex(
      (e, i) =>
        e.type === "transfer.completed" &&
        script
          .slice(0, i)
          .some(
            (prior) =>
              prior.type === "transfer.started" &&
              (prior.payload as { destinationBuildingId: string }).destinationBuildingId === "qa",
          ),
    );
    const inspectorStartIndex = indexOf(
      (e) =>
        e.type === "stage.started" &&
        e.payload &&
        "sourceBuildingId" in e.payload &&
        (e.payload as { sourceBuildingId: string }).sourceBuildingId === "qa",
    );
    expect(receiptIndex).toBeGreaterThanOrEqual(0);
    expect(inspectorStartIndex).toBeGreaterThan(receiptIndex);
  });

  it("stage.validation_passed precedes approval.requested", () => {
    expect(indexOf((e) => e.type === "stage.validation_passed")).toBeLessThan(
      indexOf((e) => e.type === "approval.requested"),
    );
  });

  it("approval.approved precedes the QA→Dock transfer.started", () => {
    const approvedIndex = indexOf((e) => e.type === "approval.approved");
    const dockTransferStartIndex = indexOf(
      (e) =>
        e.type === "transfer.started" &&
        (e.payload as { destinationBuildingId: string }).destinationBuildingId ===
          "deployment-dock",
    );
    expect(approvedIndex).toBeLessThan(dockTransferStartIndex);
  });

  it("the final transfer.completed precedes deployment_package's stage.completed, which precedes build.completed", () => {
    const transferCompletedIndices = script
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.type === "transfer.completed")
      .map(({ i }) => i);
    const finalTransferCompleted = transferCompletedIndices.at(-1);
    const stageCompletedIndices = script
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.type === "stage.completed")
      .map(({ i }) => i);
    const finalStageCompleted = stageCompletedIndices.at(-1);
    const buildCompletedIndex = indexOf((e) => e.type === "build.completed");

    expect(finalTransferCompleted).toBeDefined();
    expect(finalStageCompleted).toBeDefined();
    expect(finalTransferCompleted!).toBeLessThan(finalStageCompleted!);
    expect(finalStageCompleted!).toBeLessThan(buildCompletedIndex);
  });

  it("one build produces exactly one deployment_package artifact (counted once toward upgrade eligibility)", () => {
    const deploymentArtifacts = script.filter(
      (e) =>
        e.type === "artifact.created" &&
        (e.payload as { artifactType: string }).artifactType === "deployment_package",
    );
    expect(deploymentArtifacts).toHaveLength(1);
  });
});
