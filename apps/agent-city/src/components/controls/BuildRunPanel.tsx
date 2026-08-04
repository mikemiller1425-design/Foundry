"use client";

import { CLAUDE_CODE_STAGE } from "@foundry/contracts";
import { useRuntime } from "@/lib/mock-runtime";
import { selectStages } from "@/lib/mock-runtime/selectors";
import type { BuildRunResult } from "@/lib/backend/buildRun";
import { useMemo, useState } from "react";

/**
 * The orchestrated run, and the fact that it is simulated (AC-109).
 *
 * This is the surface for journey step 5 — *"watch stages progress, every
 * state change originating from backend authority"* — and it is the first
 * time backend mode shows work advancing at all. Before this rung the
 * world went quiet after a plan was reviewed.
 *
 * The single most important thing this panel communicates is **what is
 * actually running**. The plan allocates the `claude_code` runtime to
 * `backend_implementation`; this rung executes that stage with the mock
 * like every other one. An operator watching stages tick past must not be
 * able to conclude that Claude Code ran, so the mock is stated in the
 * panel heading, in the run control, in the per-stage row for the
 * allocated stage, and in the result — not once, in small print.
 *
 * Nothing here authorizes execution. Starting a run permits the mock
 * executor to advance a reviewed build; a real invocation needs a separate
 * single-use authorization that does not exist yet (AC-110).
 *
 * Rendered in backend mode only — the mock runtime is a recording of a run
 * that already happened (ADR-001) and has nothing to orchestrate.
 */

const STAGE_LABEL: Record<string, string> = {
  planning: "Planning",
  scaffold: "Scaffold",
  frontend_implementation: "Frontend implementation",
  backend_implementation: "Backend implementation",
  integration: "Integration",
  qa_validation: "QA validation",
  deployment_package: "Deployment package",
};

const STAGE_STATUS_COLOR: Record<string, string> = {
  planned: "text-neutral-500",
  ready: "text-sky-400",
  running: "text-sky-300",
  validating: "text-sky-300",
  blocked: "text-red-400",
  revision_required: "text-amber-400",
  completed: "text-emerald-400",
  failed: "text-red-400",
  waiting_for_approval: "text-amber-400",
  cancelled: "text-neutral-500",
};

/** The one sentence that must never be missable. */
const MOCK_STATEMENT =
  "Simulated run. Every stage is advanced by the deterministic mock executor. No Claude Code is invoked, no process is started, and no money is spent.";

export function BuildRunPanel() {
  const {
    runtimeMode,
    worldState,
    events,
    connectionStatus,
    mutationsEnabled,
    startBuildRun,
    credentialState,
  } = useRuntime();

  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<BuildRunResult | null>(null);
  const stages = useMemo(() => selectStages(events), [events]);

  if (runtimeMode !== "backend") return null;

  if (connectionStatus !== "connected") {
    return (
      <Frame state="unreachable">
        <p role="status">
          Backend unreachable — a run cannot be started or observed until the connection is restored.
          Any progress shown elsewhere may be out of date.
        </p>
      </Frame>
    );
  }

  const build = worldState.currentBuild;
  const persisted = worldState.currentPlan ?? null;

  if (!build) {
    return (
      <Frame state="no-build">
        <p role="status">No build yet. Submit an objective, then review the plan it produces.</p>
      </Frame>
    );
  }

  if (!persisted) {
    return (
      <Frame state="no-plan">
        <p role="status">
          This build has no plan, so there is nothing to orchestrate — the stages, their order, and
          their requirements all come from the plan.
        </p>
      </Frame>
    );
  }

  const review = persisted.review;
  const claudeStage = persisted.plan.stages.find((stage) => stage.runtime === "claude_code");

  if (!review) {
    return (
      <Frame state="awaiting-review">
        <p role="status">
          The plan has not been reviewed. A build is not started from a plan nobody read — read it
          above and record a decision first.
        </p>
      </Frame>
    );
  }

  if (review.decision !== "proceed") {
    return (
      <Frame state="not-proceeding">
        <p role="status">
          The plan was reviewed as <strong>{review.decision}</strong>, so this build will not run. A
          recorded review is an immutable decision; it is not re-decided.
        </p>
      </Frame>
    );
  }

  async function start() {
    if (!startBuildRun || pending) return;
    setPending(true);
    try {
      setResult(await startBuildRun());
    } finally {
      setPending(false);
    }
  }

  const blocked = !mutationsEnabled
    ? "Backend disconnected — a run cannot be started."
    : credentialState?.needsCredential
      ? "Starting a run requires an operator credential — see the Operator credential panel."
      : null;

  const state =
    build.status === "waiting_for_approval"
      ? "at-gate"
      : build.status === "running"
        ? "running"
        : build.status === "planned"
          ? "ready"
          : "finished";

  return (
    <Frame state={state}>
      <p data-testid="run-mock-statement" className="text-amber-300">
        {MOCK_STATEMENT}
      </p>

      {claudeStage && (
        <p data-testid="run-claude-allocation" className="mt-1 text-neutral-400">
          The plan allocates the controlled Claude Code runtime to{" "}
          <strong>{STAGE_LABEL[claudeStage.name] ?? claudeStage.name}</strong>. In this rung that
          stage is executed by the mock like the others. Real execution additionally requires a
          separate single-use authorization, which does not exist yet.
        </p>
      )}

      {state === "ready" && (
        <div className="mt-2">
          <button
            type="button"
            data-testid="run-start"
            disabled={blocked !== null || pending}
            onClick={() => void start()}
            className="w-full rounded border border-neutral-700 px-2 py-1 text-left hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            <span className="font-medium">
              {pending ? "Starting…" : "Run this plan with the mock executor"}
            </span>
            <span className="block text-[11px] text-neutral-400">
              Advances six stages and stops at the approval gate. Nothing is executed.
            </span>
          </button>
          {blocked && (
            <p data-testid="run-blocked" className="mt-1 text-[11px] text-amber-300">
              {blocked}
            </p>
          )}
        </div>
      )}

      {state === "running" && (
        <p data-testid="run-progress" role="status" className="mt-2 text-sky-300">
          Running. Every transition below originates from a backend event — nothing advances here
          before the backend records it.
        </p>
      )}

      {state === "at-gate" && (
        <p data-testid="run-at-gate" role="status" className="mt-2 text-amber-300">
          Stopped at the approval gate. Independent QA validation passed and an approval is pending;
          the deployment package stage is gated on it and has not been created. Resolving the
          approval records your decision — carrying the build past this gate is not implemented in
          this rung.
        </p>
      )}

      {state === "finished" && (
        <p data-testid="run-finished" role="status" className="mt-2 text-neutral-400">
          This build is {build.status}. A build is started once; its history is the record of what
          happened.
        </p>
      )}

      {result && !result.accepted && (
        <div data-testid="run-rejection" className="mt-2 rounded border border-amber-700 p-1.5">
          <p className="text-amber-300">The run was not started.</p>
          <p className="text-neutral-300">{result.reason}</p>
          {result.correctiveAction && (
            <p className="mt-1 text-neutral-400">{result.correctiveAction}</p>
          )}
        </div>
      )}

      {result?.accepted && (
        <p data-testid="run-accepted" className="mt-2 text-emerald-300">
          Run started — {result.stepCount ?? "several"} declared commands, executor{" "}
          <strong>{result.executor ?? "mock"}</strong>, stopping at the approval gate.
        </p>
      )}

      <h4 className="mt-3 font-medium">Stages ({stages.length})</h4>
      {stages.length === 0 ? (
        <p className="mt-1 text-neutral-500">
          No stage has been scheduled yet. A reviewed plan is a proposal until a run starts.
        </p>
      ) : (
        <ol data-testid="run-stages" className="mt-1 space-y-0.5">
          {stages.map((stage) => (
            <li
              key={stage.id}
              data-testid="run-stage"
              data-stage-name={stage.name}
              className="flex items-baseline justify-between gap-2"
            >
              <span className="truncate">{STAGE_LABEL[stage.name] ?? stage.name}</span>
              <span className="flex items-baseline gap-1.5">
                {stage.name === CLAUDE_CODE_STAGE && (
                  // The row that would otherwise be misread. Stated on the
                  // stage itself, so it is visible while that stage runs
                  // rather than only in a banner further up the panel.
                  <span data-testid="run-stage-executor" className="text-amber-300">
                    mock (planned: claude_code)
                  </span>
                )}
                <span className={STAGE_STATUS_COLOR[stage.status] ?? "text-neutral-400"}>
                  {stage.status.replace(/_/g, " ")}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Frame>
  );
}

function Frame({ state, children }: { state: string; children: React.ReactNode }) {
  return (
    <section
      aria-label="Build run"
      data-testid="build-run-panel"
      data-run-state={state}
      className="rounded border border-neutral-800 p-2 text-xs"
    >
      <h3 className="font-medium">Build run — mock executor</h3>
      {children}
    </section>
  );
}
