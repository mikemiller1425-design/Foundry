"use client";

import { useRuntime } from "@/lib/mock-runtime";
import { maskCredential, type CredentialStateKind } from "@/lib/backend/credentialState";
import { useState } from "react";

/**
 * The operator's credential, always visible in backend mode (AC-105).
 *
 * Two things this fixes.
 *
 * **A mistaken token was unrecoverable.** The only credential field lived
 * inside prompts that render *because* a credential is missing, so once a
 * wrong token was stored the prompt disappeared and the operator's actions
 * simply failed. There was no way back to a clean state. This panel is
 * present whether or not anything is wrong, and carries **Change** and
 * **Clear**.
 *
 * **Four different problems shared one message.** Absent, stale, invalid,
 * and backend-unreachable produced the same "credential required" prompt.
 * Each now states which situation it is and what to do — see
 * `credentialState.ts`, where the distinctions are derived and tested.
 *
 * Rendered only when the runtime supplies `credentialState`, which the
 * mock runtime does not: it is its own authority and needs no credential
 * (ADR-001), so an inert control there would be the silent no-op this
 * mission is removing.
 */

const BADGE: Record<CredentialStateKind, string> = {
  ready: "border-emerald-800 bg-emerald-950 text-emerald-200",
  absent: "border-sky-800 bg-sky-950 text-sky-200",
  stale: "border-amber-700 bg-amber-950 text-amber-200",
  invalid: "border-red-800 bg-red-950 text-red-200",
  unreachable: "border-neutral-700 bg-neutral-900 text-neutral-300",
};

/** A shape per state, so the state is never signalled by colour alone. */
const GLYPH: Record<CredentialStateKind, string> = {
  ready: "●",
  absent: "○",
  stale: "◐",
  invalid: "✖",
  unreachable: "⌀",
};

export function OperatorCredentialPanel() {
  const {
    credentialState,
    storedCredential,
    handoffAvailable,
    useHandoffCredential,
    clearOperatorCredential,
    setOperatorCredential,
  } = useRuntime();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!credentialState) return null;

  const { kind, label, explanation, action } = credentialState;
  const showEntry = editing || kind === "absent" || kind === "stale" || kind === "invalid";

  function save() {
    setOperatorCredential?.(draft);
    setDraft("");
    setEditing(false);
  }

  return (
    <section
      aria-label="Operator credential"
      data-testid="credential-panel"
      data-credential-state={kind}
      className={`rounded border p-2 ${BADGE[kind]}`}
    >
      <h3 className="flex items-center gap-1.5 font-medium">
        <span aria-hidden>{GLYPH[kind]}</span>
        <span data-testid="credential-label">{label}</span>
      </h3>

      <p role="status" data-testid="credential-explanation" className="mt-1">
        {explanation}
      </p>
      {action && (
        <p data-testid="credential-action" className="mt-1 opacity-80">
          {action}
        </p>
      )}

      {storedCredential && (
        <p className="mt-1 font-mono text-[11px] opacity-70" data-testid="credential-masked">
          held: {maskCredential(storedCredential)}
        </p>
      )}

      {handoffAvailable && kind !== "ready" && (
        <button
          type="button"
          data-testid="credential-use-handoff"
          onClick={() => useHandoffCredential?.()}
          className="mt-2 w-full rounded border border-current px-2 py-1 font-medium hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          Use this session&apos;s credential
        </button>
      )}

      {showEntry && (
        <div className="mt-2">
          <label htmlFor="credential-panel-input" className="block opacity-80">
            Operator credential
          </label>
          <input
            id="credential-panel-input"
            type="password"
            data-testid="credential-panel-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="mt-1 w-full rounded border border-current bg-neutral-950 p-1 text-neutral-200"
          />
          <button
            type="button"
            data-testid="credential-panel-save"
            disabled={draft.trim().length === 0}
            onClick={save}
            className="mt-1 rounded border border-current px-2 py-1 font-medium hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Use credential
          </button>
        </div>
      )}

      {/* Recovery controls. Present whenever a credential is held, including
          when everything is working — that is the point: a wrong token is
          only recoverable if the control exists before you know it is wrong. */}
      {storedCredential && (
        <div className="mt-2 flex gap-2">
          {!showEntry && (
            <button
              type="button"
              data-testid="credential-change"
              onClick={() => setEditing(true)}
              className="rounded border border-current px-2 py-1 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              Change
            </button>
          )}
          <button
            type="button"
            data-testid="credential-clear"
            onClick={() => {
              clearOperatorCredential?.();
              setDraft("");
              setEditing(false);
            }}
            className="rounded border border-current px-2 py-1 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Clear
          </button>
        </div>
      )}
    </section>
  );
}
