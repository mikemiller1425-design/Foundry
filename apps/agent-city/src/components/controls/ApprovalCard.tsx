"use client";

import { useRuntime } from "@/lib/mock-runtime";
import { useState } from "react";

const OPERATOR_ID = "operator-1";

// docs/02-specification/interface-model.md → "Approval interaction":
// evidence, risk class, recommended action; Approve / Reject / Request
// revision. Pending approval pauses protected progression (F-06) — the
// mock engine itself enforces the pause (runtime.ts), this card is what
// lets the operator resolve it.
export function ApprovalCard() {
  const { worldState, resolveApproval, mutationsEnabled } = useRuntime();
  const [note, setNote] = useState("");
  const pending = worldState.approvals.find((a) => a.status === "pending");

  if (!pending) return null;

  return (
    <div
      role="alertdialog"
      aria-label="Pending approval"
      data-testid="approval-card"
      className="w-80 rounded border border-amber-700 bg-neutral-900 p-3 text-xs shadow-lg"
    >
      <h3 className="font-medium text-amber-300">Approval requested</h3>
      <p className="mt-1 font-medium">{pending.title}</p>
      <dl className="mt-2 space-y-1 text-neutral-400">
        <div>
          <dt className="inline text-neutral-500">reason: </dt>
          <dd className="inline">{pending.reason}</dd>
        </div>
        <div>
          <dt className="inline text-neutral-500">risk class: </dt>
          <dd className="inline">{pending.riskClass}</dd>
        </div>
        <div>
          <dt className="inline text-neutral-500">recommended action: </dt>
          <dd className="inline">{pending.recommendedAction}</dd>
        </div>
        <div>
          <dt className="inline text-neutral-500">evidence: </dt>
          <dd className="inline">{pending.evidenceIds.join(", ") || "none"}</dd>
        </div>
      </dl>

      <label htmlFor="approval-note" className="mt-2 block text-neutral-500">
        Resolution note (optional)
      </label>
      <textarea
        id="approval-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 p-1 text-neutral-200"
      />

      {/* F-10: resolving an approval is a mutation, so it must be
          unavailable whenever the projection is not live backend truth. */}
      {!mutationsEnabled && (
        <p role="status" className="mt-3 rounded border border-amber-700 bg-amber-950 p-2 text-amber-200">
          Disconnected — approval actions are unavailable until the connection is restored.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!mutationsEnabled}
          onClick={() => resolveApproval("approved", OPERATOR_ID, note || undefined)}
          className="flex-1 rounded bg-emerald-700 px-2 py-1 font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={!mutationsEnabled}
          onClick={() => resolveApproval("rejected", OPERATOR_ID, note || undefined)}
          className="flex-1 rounded bg-red-800 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={!mutationsEnabled}
          onClick={() => resolveApproval("revision_requested", OPERATOR_ID, note || undefined)}
          className="flex-1 rounded border border-neutral-600 px-2 py-1 font-medium hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          Request revision
        </button>
      </div>
    </div>
  );
}
