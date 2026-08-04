"use client";

import { CLAUDE_CODE_STAGE, MAX_BUDGET_USD_CEILING } from "@foundry/contracts";
import { useRuntime } from "@/lib/mock-runtime";
import type { ExecutionGateReport } from "@/lib/backend/executionGate";
import { useCallback, useEffect, useState } from "react";

/**
 * The execution authorization gate (AC-110).
 *
 * This is journey step 6 — *"authorize execution as an explicit act,
 * having read exactly what will run"* — and it is the last human decision
 * before anything real could happen.
 *
 * Three things this panel exists to make impossible to misread:
 *
 * 1. **Authorizing is not running.** It records permission for one future
 *    run of one stage. Performing that run is a separate rung under this
 *    same authorization, and no control here starts, schedules, or spends
 *    it. The panel says so on the control, in the confirmation, and in the
 *    issued record.
 * 2. **What it binds to is visible.** The plan's backend-generated content
 *    hash is shown, because "authorize execution" means nothing unless the
 *    operator can see *which* plan they are authorizing. Edit the plan and
 *    the binding no longer matches, and the gate refuses.
 * 3. **The gate's verdict is the backend's, not this component's.** The
 *    panel renders what `GET …/execution-authorization` reports. It never
 *    computes permission, and it cannot compute the binding — the producer
 *    is not in this bundle (`F-113a`).
 *
 * Rendered in backend mode only.
 */

const DEFAULT_BUDGET_USD = 5;

export function ExecutionAuthorizationPanel() {
  const {
    runtimeMode,
    worldState,
    connectionStatus,
    mutationsEnabled,
    authorizeExecution,
    readExecutionGate,
    credentialState,
  } = useRuntime();

  const [budget, setBudget] = useState(String(DEFAULT_BUDGET_USD));
  const [pending, setPending] = useState(false);
  const [gate, setGate] = useState<ExecutionGateReport | null>(null);

  const persisted = worldState.currentPlan ?? null;
  const authorization = persisted?.authorization ?? null;
  const realStage = persisted?.plan.stages.find((stage) => stage.runtime === "claude_code");

  const refreshGate = useCallback(async () => {
    if (!readExecutionGate) return;
    setGate(await readExecutionGate(realStage?.name ?? CLAUDE_CODE_STAGE));
  }, [readExecutionGate, realStage?.name]);

  // Re-read whenever the authorization or the connection changes. The
  // verdict is backend truth, so it is fetched rather than inferred from
  // what this component just did.
  useEffect(() => {
    if (runtimeMode !== "backend" || connectionStatus !== "connected") return;
    void refreshGate();
  }, [runtimeMode, connectionStatus, authorization?.authorizationId, refreshGate]);

  if (runtimeMode !== "backend") return null;

  if (connectionStatus !== "connected") {
    return (
      <Frame state="unreachable">
        <p role="status">
          Backend unreachable — execution cannot be authorized, and any authorization shown
          elsewhere may be out of date.
        </p>
      </Frame>
    );
  }

  if (!persisted) {
    return (
      <Frame state="no-plan">
        <p role="status">
          No plan yet. There is nothing to authorize: an authorization binds to the content of a
          specific plan.
        </p>
      </Frame>
    );
  }

  if (!persisted.review) {
    return (
      <Frame state="awaiting-review">
        <p role="status">
          The plan has not been reviewed. Reviewing and authorizing are separate decisions, and the
          first has to happen first.
        </p>
      </Frame>
    );
  }

  if (persisted.review.decision !== "proceed") {
    return (
      <Frame state="not-proceeding">
        <p role="status">
          The plan was reviewed as <strong>{persisted.review.decision}</strong>. Execution cannot be
          authorized against a plan that was not accepted.
        </p>
      </Frame>
    );
  }

  if (!realStage) {
    return (
      <Frame state="nothing-to-authorize">
        <p role="status">
          This plan allocates no stage to the controlled Claude Code runtime, so there is no real
          execution to authorize.
        </p>
      </Frame>
    );
  }

  async function authorize() {
    if (!authorizeExecution || pending) return;
    const parsed = Number(budget);
    setPending(true);
    try {
      await authorizeExecution({
        stageName: realStage?.name ?? CLAUDE_CODE_STAGE,
        maxBudgetUsd: parsed,
      });
      await refreshGate();
    } finally {
      setPending(false);
    }
  }

  const blocked = !mutationsEnabled
    ? "Backend disconnected — execution cannot be authorized."
    : credentialState?.needsCredential
      ? "Authorizing requires an operator credential — see the Operator credential panel."
      : null;

  return (
    <Frame state={authorization ? "authorized" : "unauthorized"}>
      {/* The binding, shown before the control that uses it. An operator
          authorizing execution must be able to see which plan content the
          permission is tied to. */}
      <dl className="space-y-1">
        <Row label="stage that would run" value={realStage.name} testId="authorization-stage" />
        <Row label="risk class" value={persisted.plan.riskClass} testId="authorization-risk" />
        <Row label="workspace" value={persisted.plan.workspace} testId="authorization-workspace" />
        <Row
          label="plan content hash (the binding)"
          value={persisted.contentHash}
          testId="authorization-binding"
          mono
        />
      </dl>

      <p data-testid="authorization-boundary" className="mt-2 text-[11px] text-neutral-400">
        This hash is generated by the backend from the plan&apos;s persisted content and compared
        server-side. Editing the plan changes it, which invalidates any authorization issued against
        it. The revision indicator shown in the plan panel is a change signal, not this binding.
      </p>

      {authorization ? (
        <div data-testid="authorization-record" className="mt-3">
          <h4 className="font-medium">Authorization issued</h4>
          <dl className="mt-1 space-y-1">
            <Row label="who" value={authorization.authorizedBy} testId="authorization-who" />
            <Row label="what" value={`${authorization.stageName}, once`} testId="authorization-what" />
            <Row label="when" value={authorization.authorizedAt} testId="authorization-when" />
            <Row
              label="bound to"
              value={authorization.planContentHash}
              testId="authorization-bound-to"
              mono
            />
            <Row
              label="budget ceiling"
              value={`$${authorization.maxBudgetUsd}`}
              testId="authorization-budget"
            />
          </dl>
          <p className="mt-2 text-amber-300" data-testid="authorization-not-running">
            Permission only — <strong>nothing has run</strong>. This authorization is single-use and
            is not reissued. Performing the run it permits is a separate step that is not
            implemented yet, so no process, no model call, and no spend has occurred.
          </p>
        </div>
      ) : (
        <div data-testid="authorization-form" className="mt-3">
          <label htmlFor="authorization-budget-input" className="block text-neutral-500">
            Budget ceiling (USD, max ${MAX_BUDGET_USD_CEILING})
          </label>
          <input
            id="authorization-budget-input"
            type="number"
            min="0.01"
            max={MAX_BUDGET_USD_CEILING}
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 p-1 text-neutral-200"
          />
          <button
            type="button"
            data-testid="authorization-submit"
            disabled={blocked !== null || pending}
            onClick={() => void authorize()}
            className="mt-2 w-full rounded border border-neutral-700 px-2 py-1 text-left hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            <span className="font-medium">
              {pending ? "Authorizing…" : `Authorize one run of ${realStage.name}`}
            </span>
            <span className="block text-[11px] text-neutral-400">
              Grants permission for one run of this one stage, once. It does not start it, and
              nothing runs as a result.
            </span>
          </button>
          {blocked && (
            <p data-testid="authorization-blocked" className="mt-1 text-[11px] text-amber-300">
              {blocked}
            </p>
          )}
        </div>
      )}

      <h4 className="mt-3 font-medium">Gate</h4>
      {gate === null ? (
        <p className="mt-1 text-neutral-500">Reading the gate&apos;s current verdict…</p>
      ) : gate.unavailable ? (
        <p data-testid="gate-unavailable" className="mt-1 text-amber-300">
          The gate&apos;s state could not be read: {gate.unavailable}
        </p>
      ) : (
        <div data-testid="gate-verdict" data-gate-permitted={String(gate.permitted)} className="mt-1">
          <p className={gate.permitted ? "text-emerald-300" : "text-neutral-300"}>
            {gate.permitted
              ? `Permitted: one run of ${gate.stageName} would be allowed. Nothing has started — reading this changes nothing.`
              : `Refused: one run of ${gate.stageName} would not be allowed.`}
          </p>
          {gate.refusals.length > 0 && (
            <ul data-testid="gate-refusals" className="mt-1 list-disc space-y-1 pl-4">
              {gate.refusals.map((refusal) => (
                <li key={refusal.code} data-refusal-code={refusal.code}>
                  <span className="text-neutral-300">{refusal.reason}</span>
                  {refusal.correctiveAction && (
                    <span className="block text-neutral-500">{refusal.correctiveAction}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {gate.spentRunIds.length > 0 && (
            <p className="mt-1 text-neutral-500">
              Spent by: {gate.spentRunIds.join(", ")}. A spent execution is never restarted
              automatically.
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
      aria-label="Execution authorization"
      data-testid="execution-authorization-panel"
      data-authorization-state={state}
      className="rounded border border-neutral-800 p-2 text-xs"
    >
      <h3 className="font-medium">Execution authorization</h3>
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
      <dd className={`inline ${mono ? "break-all font-mono text-[11px]" : ""}`} data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
