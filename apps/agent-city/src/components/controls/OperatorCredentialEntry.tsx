"use client";

import { useRuntime } from "@/lib/mock-runtime";
import { useState } from "react";

/**
 * Where the operator gives this browser its credential.
 *
 * Extracted from `ApprovalCard` at AC-103 for a load-bearing reason: the
 * card returns `null` when no approval is pending, so the only credential
 * field in the application existed *only* during an approval. Objective
 * submission also requires an authenticated operator (principle 14) and
 * happens long before any approval exists — without this, the operator
 * would face a permanently disabled control and no way to enable it.
 *
 * The markup and behaviour are unchanged from `ApprovalCard`'s original;
 * only the ids and the explanatory sentence vary by caller, so two
 * instances can coexist on the page without colliding.
 *
 * This is not a session system. The credential is entered by the operator
 * and held locally rather than baked into the client bundle — see
 * `operatorCredential.ts` for why, and for what it deliberately is not.
 */
export function OperatorCredentialEntry({
  idPrefix = "operator-credential",
  explanation,
}: {
  /** Distinguishes multiple instances; also used for `data-testid`. */
  idPrefix?: string;
  explanation: string;
}) {
  const { setOperatorCredential } = useRuntime();
  const [draft, setDraft] = useState("");

  return (
    <div
      data-testid={`${idPrefix}-required`}
      className="mt-3 rounded border border-sky-800 bg-sky-950 p-2 text-sky-200"
    >
      <p role="status">{explanation}</p>
      <label htmlFor={idPrefix} className="mt-2 block text-sky-400">
        Operator credential
      </label>
      <input
        id={idPrefix}
        type="password"
        data-testid={`${idPrefix}-input`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="mt-1 w-full rounded border border-sky-800 bg-neutral-950 p-1 text-neutral-200"
      />
      <button
        type="button"
        data-testid={`${idPrefix}-save`}
        disabled={draft.trim().length === 0}
        onClick={() => {
          setOperatorCredential?.(draft);
          setDraft("");
        }}
        className="mt-2 rounded border border-sky-700 px-2 py-1 font-medium hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
      >
        Use credential
      </button>
    </div>
  );
}
