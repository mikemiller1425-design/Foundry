"use client";

import { OBJECTIVE_MAX_LENGTH, type V1RiskClass } from "@foundry/contracts";
import { useRuntime } from "@/lib/mock-runtime";
import type { ObjectiveSubmissionResult } from "@/lib/backend/objectiveSubmission";
import { useState } from "react";
import { OperatorCredentialEntry } from "./OperatorCredentialEntry";

/**
 * The operator states what should be built (AC-103).
 *
 * This is step 1 of the required workflow (`v1-scope.md`) and step 4 of the
 * acceptance journey, and until now it had no implementation in either
 * runtime mode: `operator.objective_submitted` was produced by the mock
 * script and by seed scripts, never by a person.
 *
 * Three deliberate properties:
 *
 * - **Bounded, not unrestricted.** A single-line field with a length
 *   ceiling, one fixed workspace, and an R0–R2 selector.
 *   `interface-model.md` prohibits "unrestricted natural-language
 *   autonomous planning or shell execution" — nothing typed here reaches a
 *   planner or a shell. Submitting creates a Project and a Build and stops.
 * - **Every refusal is legible.** Backend validation is authoritative and
 *   its per-field reasons are rendered verbatim, including the corrective
 *   action. The field is not pre-validated into silence here; a control
 *   that quietly refuses to submit teaches the operator nothing.
 * - **Rendered only when it can work.** `submitObjective` is supplied by
 *   the backend provider alone, so in mock mode this component is absent
 *   rather than present-and-inert.
 */

const RISK_CLASSES: readonly V1RiskClass[] = ["R0", "R1", "R2"];

export function ObjectiveForm() {
  const { submitObjective, mutationsEnabled, operatorCredentialRequired } = useRuntime();
  const [objective, setObjective] = useState("");
  const [riskClass, setRiskClass] = useState<V1RiskClass>("R2");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ObjectiveSubmissionResult | null>(null);

  if (!submitObjective) return null;

  const credentialRequired = mutationsEnabled && Boolean(operatorCredentialRequired);
  const blockedReason = !mutationsEnabled
    ? "Backend disconnected — an objective cannot be submitted until the connection is restored."
    : credentialRequired
      ? "No operator credential in this browser. Submitting an objective is a human act of direction, so the backend requires an authenticated operator."
      : null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!submitObjective || pending) return;
    setPending(true);
    try {
      const outcome = await submitObjective({
        objective,
        workspace: "foundry_managed",
        riskClass,
      });
      setResult(outcome);
      // Only clear on success: a refused objective is the operator's text
      // to correct, and wiping it would make them retype it to find out
      // what was wrong.
      if (outcome.accepted) setObjective("");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="objective-form"
      aria-label="Submit objective"
      className="flex w-full min-w-0 flex-col gap-1"
    >
      <div className="flex w-full min-w-0 items-center gap-2">
        <label htmlFor="objective-input" className="shrink-0 text-xs text-neutral-400">
          Objective
        </label>
        <input
          id="objective-input"
          type="text"
          value={objective}
          maxLength={OBJECTIVE_MAX_LENGTH}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Describe one small, self-contained software artifact"
          aria-describedby="objective-workspace-note"
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        />

        <label htmlFor="objective-risk-class" className="sr-only">
          Risk class
        </label>
        <select
          id="objective-risk-class"
          value={riskClass}
          onChange={(e) => setRiskClass(e.target.value as V1RiskClass)}
          className="shrink-0 rounded border border-neutral-700 bg-neutral-900 px-1 py-1 text-xs"
        >
          {RISK_CLASSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={pending || blockedReason !== null}
          className="shrink-0 rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          {pending ? "Submitting…" : "Submit objective"}
        </button>
      </div>

      <p id="objective-workspace-note" className="text-[11px] text-neutral-500">
        Workspace: Foundry-managed (the only permitted workspace). Risk class R0–R2. Submitting
        creates a project and a build — nothing is planned or executed.
      </p>

      {/* Explains a disabled button rather than leaving the operator to
          guess whether Foundry is refusing them or simply broken. */}
      {blockedReason && (
        <p data-testid="objective-blocked" className="text-[11px] text-amber-300">
          {blockedReason}
        </p>
      )}

      {/* The credential field lived only inside `ApprovalCard`, which
          renders nothing until an approval is pending — so before AC-103
          there was no approval yet, and therefore no way to supply the
          credential this control requires. The entry point has to exist
          wherever the credential is first needed. */}
      {credentialRequired && (
        <OperatorCredentialEntry
          idPrefix="objective-operator-credential"
          explanation="Paste the operator credential the API printed at startup to enable submission."
        />
      )}

      <div role="status" aria-live="polite" data-testid="objective-result">
        {result?.accepted && (
          <p className="text-[11px] text-emerald-400">
            Objective accepted — project {result.projectId}, build {result.buildId}. It is now
            backend truth: see &quot;Current build&quot; and the timeline.
          </p>
        )}
        {result && !result.accepted && (
          <div className="text-[11px] text-red-400">
            <p>Rejected — {result.reason}</p>
            {result.issues && (
              <ul className="mt-0.5 list-disc pl-4">
                {result.issues.map((issue) => (
                  <li key={`${issue.field}:${issue.message}`}>
                    {issue.field ? `${issue.field}: ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
            {result.correctiveAction && (
              <p className="mt-0.5 text-neutral-400">{result.correctiveAction}</p>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
