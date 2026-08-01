import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CommandHandler, PersistenceService } from "@foundry/persistence";
import {
  ClaudeCodeAdapter,
  createFixtureRepository,
  runControlledStage,
  type ClaudeCodeProfile,
  type ValidationProfile,
} from "@foundry/runtime-adapters";

/**
 * The FBL-028 operator entrypoint: performs the one real, controlled
 * Claude Code run and writes a complete evidence package.
 *
 * This is a deliberate, operator-invoked action, not part of any test
 * suite — it spends real money, requires network access, and by
 * specification (F-12, `v1-scope.md` stage 4) happens exactly once. The
 * mechanism it drives is the same one `controlledStage.test.ts` covers
 * offline; the only substitution removed here is the Claude Code process
 * itself.
 *
 * The `AgentRun` is recorded through the ordinary FBL-023/025 path, so
 * duplicate protection, restart durability, and the R0–R2 ceiling come
 * from the same enforcement everything else uses rather than from
 * anything special-cased for this rung.
 */

const CLAUDE_EXECUTABLE =
  process.env.FOUNDRY_CLAUDE_PATH ??
  "/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe";
const GIT_EXECUTABLE = process.env.FOUNDRY_GIT_PATH ?? "/usr/bin/git";
const AGENT_RUN_ID = process.env.FOUNDRY_AGENT_RUN_ID ?? "agentrun-fbl-028-backend-implementation";
const EVIDENCE_DIR =
  process.env.FOUNDRY_EVIDENCE_DIR ?? path.join(process.cwd(), "docs", "evidence", "fbl-028");
const DB_PATH = process.env.FOUNDRY_DB_PATH ?? path.join(EVIDENCE_DIR, "agentrun.sqlite");
/** Kept when set, so the operator can inspect the repository afterwards. */
const KEEP_FIXTURE = process.env.FOUNDRY_KEEP_FIXTURE === "1";

async function main(): Promise<void> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });

  const fixture = createFixtureRepository();
  console.log(`fixture repository: ${fixture.root}`);

  const claudeProfile: ClaudeCodeProfile = {
    repositoryRoot: fixture.root,
    executablePath: CLAUDE_EXECUTABLE,
    model: "sonnet",
    timeoutMs: 10 * 60_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 1024 * 1024,
    maxEvidenceBytes: 8 * 1024 * 1024,
    maxBudgetUsd: 2,
    // The empirically minimal set: Claude Code resolves its credentials
    // from the macOS Keychain, which needs the account name (`USER`),
    // and locates its own configuration via `HOME`. Notably *not* PATH.
    // See the security note in claudeCodeAdapter.ts.
    allowedEnvironmentVariables: ["HOME", "USER"],
  };

  const validationProfile: ValidationProfile = {
    repositoryRoot: fixture.root,
    gitExecutablePath: GIT_EXECUTABLE,
    nodeExecutablePath: process.execPath,
    timeoutMs: 2 * 60_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 1024 * 1024,
    maxEvidenceBytes: 8 * 1024 * 1024,
  };

  const persistence = new PersistenceService(DB_PATH);
  const handler = new CommandHandler(persistence);

  try {
    // Duplicate protection comes from the persisted log, so a rerun of
    // this script against the same database refuses rather than
    // executing a second controlled stage.
    // Captured *before* AgentRun.Start, because after it the entity
    // exists by design. This value is what the orchestrator's guard
    // consults, so both layers agree on whether this is a duplicate.
    const alreadyStarted = persistence.getEntity("agentRuns", AGENT_RUN_ID) !== undefined;

    const started = alreadyStarted
      ? { accepted: false, reason: "AgentRun already exists in the persisted log." }
      : handler.submit(
          {
            commandType: "AgentRun.Start",
            entityId: AGENT_RUN_ID,
            params: {
              agentId: "agent-builder",
              taskId: "task-backend-implementation",
              runtimeType: "claude_code",
              riskClass: "R2",
            },
          },
          { actorType: "operator", actorId: "operator-1" },
        );

    if (!started.accepted) {
      console.error(`refusing to run: ${started.reason ?? "AgentRun.Start was rejected"}`);
      process.exitCode = 2;
      return;
    }

    const adapter = new ClaudeCodeAdapter(claudeProfile);
    console.log(`policy: ${adapter.policy.id} (max risk ${adapter.policy.maxRiskClass})`);
    console.log("executing controlled stage — this makes real API calls");

    const evidence = await runControlledStage(
      {
        agentRunId: AGENT_RUN_ID,
        agentId: "agent-builder",
        taskId: "task-backend-implementation",
        fixture,
        claudeProfile,
        validationProfile,
      },
      {
        adapter,
        hasExistingRun: () => alreadyStarted,
      },
    );

    // Record the terminal AgentRun state through the ordinary command
    // path, so the run is durable and reconstructable like any other.
    const terminal =
      evidence.outcome === "succeeded"
        ? handler.submit(
            {
              commandType: "AgentRun.Complete",
              entityId: AGENT_RUN_ID,
              params: {
                exitCode: evidence.runEvidence?.commands[0]?.exitCode ?? 0,
                outputArtifactIds: [],
                evidenceIds: [evidence.runEvidence?.evidenceId ?? "unknown"],
              },
            },
            { actorType: "operator", actorId: "operator-1" },
          )
        : evidence.outcome === "timed_out"
          ? handler.submit(
              {
                commandType: "AgentRun.Timeout",
                entityId: AGENT_RUN_ID,
                params: {
                  evidenceIds: [evidence.runEvidence?.evidenceId ?? "unknown"],
                  logRef: path.join(EVIDENCE_DIR, "evidence.json"),
                },
              },
              { actorType: "operator", actorId: "operator-1" },
            )
          : handler.submit(
              {
                commandType: "AgentRun.Fail",
                entityId: AGENT_RUN_ID,
                params: {
                  failureCode: evidence.outcome,
                  failureMessage: evidence.verdict,
                  evidenceIds: [evidence.runEvidence?.evidenceId ?? "unknown"],
                },
              },
              { actorType: "operator", actorId: "operator-1" },
            );

    const packageRecord = {
      ...evidence,
      agentRunTerminalCommandAccepted: terminal.accepted,
      agentRunTerminalCommandReason: terminal.reason ?? null,
      persistedAgentRun: persistence.getEntity("agentRuns", AGENT_RUN_ID),
      persistedEvents: persistence.getAllEvents(),
    };

    writeFileSync(
      path.join(EVIDENCE_DIR, "evidence.json"),
      `${JSON.stringify(packageRecord, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(path.join(EVIDENCE_DIR, "diff.patch"), evidence.writeScope?.diff ?? "", "utf8");
    writeFileSync(
      path.join(EVIDENCE_DIR, "stdout.txt"),
      evidence.runEvidence?.commands[0]?.output.stdout ?? "",
      "utf8",
    );
    writeFileSync(
      path.join(EVIDENCE_DIR, "stderr.txt"),
      evidence.runEvidence?.commands[0]?.output.stderr ?? "",
      "utf8",
    );
    writeFileSync(path.join(EVIDENCE_DIR, "tests.txt"), evidence.tests?.stdout ?? "", "utf8");

    console.log(`outcome: ${evidence.outcome}`);
    console.log(`verdict: ${evidence.verdict}`);
    console.log(`evidence written to ${EVIDENCE_DIR}`);

    if (evidence.outcome !== "succeeded") process.exitCode = 1;
  } finally {
    persistence.close();
    if (!KEEP_FIXTURE) {
      rmSync(fixture.root, { recursive: true, force: true });
    } else {
      console.log(`fixture retained at ${fixture.root}`);
    }
  }
}

await main();
