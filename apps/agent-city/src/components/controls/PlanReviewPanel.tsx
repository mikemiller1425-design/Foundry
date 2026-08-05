"use client";

import { CLAUDE_CODE_STAGE, MAX_BUDGET_USD_CEILING } from "@foundry/contracts";
import { useRuntime } from "@/lib/mock-runtime";
import { useState } from "react";

/**
 * The structured plan, and the operator's review of it (AC-108).
 *
 * This is the surface for journey step 3 — *"Read a structured plan the
 * system produced, and decide whether to proceed"* — and it is the first
 * time backend mode has something substantive to show. Before this rung
 * backend mode presented an empty world (PV1-052); once a plan exists it
 * is visibly represented **without pretending work has begun**, which is
 * the specific half of PV1-052 this rung was assigned.
 *
 * The single most important thing this panel communicates is what
 * *Proceed* does not do. A plan is a proposal; recording a review is a
 * governance act; authorizing execution is a separate, single-use act that
 * does not exist yet. Every affordance here is worded so an operator
 * cannot reasonably read "proceed" as "go".
 *
 * Rendered in backend mode only — the mock runtime never produces a plan.
 */

const DECISIONS = [
  {
    value: "proceed" as const,
    label: "Proceed",
    hint: "Records that you read this plan. Authorizes no execution.",
  },
  {
    value: "revision_requested" as const,
    label: "Request revision",
    hint: "Records that this plan needs changes.",
  },
  {
    value: "rejected" as const,
    label: "Reject",
    hint: "Records that this plan is not acceptable.",
  },
];

export function PlanReviewPanel() {
  const {
    runtimeMode,
    worldState,
    connectionStatus,
    mutationsEnabled,
    reviewPlan,
    credentialState,
  } = useRuntime();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  if (runtimeMode !== "backend") return null;

  const persisted = worldState.currentPlan ?? null;
  const build = worldState.currentBuild;

  // --- States that are not "here is a plan" --------------------------------

  if (connectionStatus !== "connected") {
    return (
      <Frame state="unreachable">
        <p role="status">
          Backend unreachable — the plan cannot be read or reviewed until the connection is
          restored. Any plan shown elsewhere may be out of date.
        </p>
      </Frame>
    );
  }

  if (!build) {
    return (
      <Frame state="empty">
        <p role="status">
          No build yet. Submit an objective and the Architect will propose a plan for it.
        </p>
      </Frame>
    );
  }

  if (!persisted) {
    // A build exists but no plan does. Distinct from "no build" because the
    // corrective action is different, and distinct from "loading" because
    // the world state has arrived and simply does not contain one.
    return (
      <Frame state="no-plan">
        <p role="status">
          A build exists but no plan has been recorded for it. If this persists, the Architect step
          did not complete — the submission response states why.
        </p>
      </Frame>
    );
  }

  const { plan, revision, review } = persisted;
  const claudeStages = plan.stages.filter((stage) => stage.runtime === "claude_code");

  async function decide(decision: "proceed" | "rejected" | "revision_requested") {
    if (!reviewPlan || pending) return;
    setPending(decision);
    try {
      await reviewPlan({ decision, note: note.trim() || undefined });
    } finally {
      setPending(null);
    }
  }

  const blocked = !mutationsEnabled
    ? "Backend disconnected — a review cannot be recorded."
    : credentialState && credentialState.needsCredential
      ? "Recording a review requires an operator credential — see the Operator credential panel."
      : null;

  return (
    <Frame state={review ? "reviewed" : "awaiting-review"}>
      <dl className="space-y-1">
        <Row label="objective" value={plan.objective} testId="plan-objective" />
        <Row label="workspace" value={plan.workspace} testId="plan-workspace" />
        <Row label="risk class" value={plan.riskClass} testId="plan-risk" />
        <Row label="plan revision" value={revision} testId="plan-revision" mono />
      </dl>

      {/* The execution boundary, stated as a fact about this plan rather
          than as general reassurance. */}
      <p data-testid="plan-execution-boundary" className="mt-2 text-[11px] text-neutral-400">
        {claudeStages.length === 0
          ? "No stage in this plan allocates the controlled Claude Code runtime."
          : `One stage allocates the controlled Claude Code runtime: ${claudeStages
              .map((s) => s.name)
              .join(", ")}. It is the only stage permitted to.`}{" "}
        Real execution additionally requires a separate single-use authorization with a budget
        ceiling of ${MAX_BUDGET_USD_CEILING} — that gate does not exist yet, so nothing here can
        run.
      </p>

      <h4 className="mt-3 font-medium">Stages ({plan.stages.length})</h4>
      <ol data-testid="plan-stages" className="mt-1 space-y-1">
        {plan.stages.map((stage) => (
          <li
            key={stage.name}
            data-testid="plan-stage"
            className="rounded border border-neutral-800 p-1.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">
                {stage.sequence}. {stage.name.replace(/_/g, " ")}
              </span>
              <span
                data-testid="plan-stage-runtime"
                className={stage.runtime === "claude_code" ? "text-amber-300" : "text-neutral-500"}
              >
                {stage.runtime}
                {stage.name === CLAUDE_CODE_STAGE && stage.runtime === "claude_code" ? " ●" : ""}
              </span>
            </div>
            <div className="text-neutral-500">
              {stage.sourceBuildingId} → {stage.destinationBuildingId}
            </div>
            {stage.requirements.map((requirement) => (
              <div key={requirement.name} className="mt-1">
                <div className="text-neutral-300">
                  {requirement.name}
                  {requirement.required ? " (mandatory)" : " (optional)"}
                </div>
                <ul className="list-disc pl-4 text-neutral-500">
                  {requirement.acceptanceCriteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </div>
            ))}
          </li>
        ))}
      </ol>

      <h4 className="mt-3 font-medium">Review</h4>
      {review ? (
        <div data-testid="plan-review-status" className="mt-1">
          <p className="text-emerald-300">
            Recorded: <strong>{review.decision}</strong> by {review.reviewedBy}
          </p>
          <p className="text-neutral-400">
            {review.decision === "proceed"
              ? "Review recorded. No execution was authorized by this decision."
              : "Recorded. A recorded review is not re-decided."}
          </p>
          {review.note && <p className="mt-1 text-neutral-400">Note: {review.note}</p>}
        </div>
      ) : (
        <div data-testid="plan-review-form" className="mt-1">
          <label htmlFor="plan-review-note" className="block text-neutral-500">
            Note (optional)
          </label>
          <textarea
            id="plan-review-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 p-1 text-neutral-200"
          />
          <div className="mt-2 flex flex-col gap-1">
            {DECISIONS.map((decision) => (
              <button
                key={decision.value}
                type="button"
                data-testid={`plan-review-${decision.value}`}
                disabled={blocked !== null || pending !== null}
                onClick={() => void decide(decision.value)}
                className="rounded border border-neutral-700 px-2 py-1 text-left hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              >
                <span className="font-medium">
                  {pending === decision.value ? "Recording…" : decision.label}
                </span>
                <span className="block text-[11px] text-neutral-400">{decision.hint}</span>
              </button>
            ))}
          </div>
          {blocked && (
            <p data-testid="plan-review-blocked" className="mt-1 text-[11px] text-amber-300">
              {blocked}
            </p>
          )}
        </div>
      )}
    </Frame>
  );
}

function Frame({ state, children }: { state: string; children: React.ReactNode }) {
  return (
    <section
      aria-label="Build plan review"
      data-testid="plan-review-panel"
      data-plan-state={state}
      className="foundry-workflow-card text-xs"
    >
      <h3 className="foundry-workflow-title">Build plan</h3>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  testId,
  mono,
}: {
  label: string;
  value: string;
  testId: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="inline text-neutral-500">{label}: </dt>
      <dd className={`inline ${mono ? "font-mono text-[11px]" : ""}`} data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
