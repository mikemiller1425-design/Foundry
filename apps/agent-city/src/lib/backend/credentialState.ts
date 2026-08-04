/**
 * What the operator's credential situation actually is, and what to say
 * about it (AC-105 / F-104).
 *
 * Before this rung there was one boolean — "required" or not — so an
 * absent credential, a credential left over from a previous API session,
 * a credential the backend rejects, and a backend that is simply not
 * answering all produced the same prompt. Those are four different
 * problems with four different fixes, and telling an operator the wrong
 * one costs them the time it takes to rule it out.
 *
 * Pure and dependency-free so every state and every message is testable
 * without a DOM, a network, or a running backend.
 */

export type CredentialStateKind = "unreachable" | "absent" | "stale" | "invalid" | "ready";

export interface CredentialInputs {
  /** True only when the stream is live. */
  connected: boolean;
  /** The credential this browser holds, or null. */
  stored: string | null;
  /**
   * The credential this API session handed to the frontend server, if the
   * launch path performed a handoff. Null when there was none.
   */
  handoff: string | null;
  /** True once the backend has refused a request on authorization grounds. */
  rejected: boolean;
}

export interface CredentialState {
  kind: CredentialStateKind;
  /** Short label for a badge. */
  label: string;
  /** One sentence naming the situation. */
  explanation: string;
  /** What the operator should do. Empty when there is nothing to do. */
  action: string;
  /** True when the operator needs to supply or replace a credential. */
  needsCredential: boolean;
}

/**
 * Order matters, and each branch is exclusive.
 *
 * `unreachable` is tested first because a dead connection makes every
 * other diagnosis unknowable — a credential cannot be shown to be invalid
 * by a backend that is not answering, and saying "invalid" there would
 * send the operator to replace a token that is probably fine.
 *
 * `stale` is detected *before* any rejection, by comparing what this
 * browser holds against what the current API session handed over. The API
 * mints credentials per boot and never persists them, so a mismatch means
 * the browser is holding a token from an earlier process — which is the
 * single most likely reason an operator's actions stop working, and the
 * one that looks most like a bug if it is not named.
 */
export function deriveCredentialState(inputs: CredentialInputs): CredentialState {
  const { connected, stored, handoff, rejected } = inputs;

  if (!connected) {
    return {
      kind: "unreachable",
      label: "Backend unreachable",
      explanation:
        "The backend is not answering, so operator actions are unavailable and the credential cannot be checked.",
      action: "Wait for the connection to be restored, or confirm the API process is running.",
      needsCredential: false,
    };
  }

  if (!stored) {
    return {
      kind: "absent",
      label: "No credential",
      explanation:
        "This browser holds no operator credential, so actions that require an authenticated operator are unavailable.",
      action: handoff
        ? "Use the credential from this session, or paste one manually."
        : "Paste the operator credential the API printed at startup.",
      needsCredential: true,
    };
  }

  if (handoff && handoff !== stored) {
    return {
      kind: "stale",
      label: "Stale credential",
      explanation:
        "This browser is holding a credential from an earlier API session. Credentials are minted per boot and never persisted, so the old one no longer authenticates.",
      action: "Use the credential from this session to replace it.",
      needsCredential: true,
    };
  }

  if (rejected) {
    return {
      kind: "invalid",
      label: "Credential rejected",
      explanation:
        "The backend refused this credential. It is not the operator credential this API session issued.",
      action: handoff
        ? "Use the credential from this session, or paste the correct one."
        : "Clear it and paste the operator credential the API printed at startup.",
      needsCredential: true,
    };
  }

  return {
    kind: "ready",
    label: "Operator credential held",
    explanation: "This browser holds an operator credential and can perform operator actions.",
    action: "",
    needsCredential: false,
  };
}

/**
 * A credential rendered safe to show on screen.
 *
 * Enough to tell two tokens apart when deciding whether to replace one,
 * and not enough to be worth reading off a shoulder or a screen share.
 */
export function maskCredential(credential: string | null): string {
  if (!credential) return "—";
  const trimmed = credential.trim();
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

/**
 * True when a backend response was refused on authorization grounds.
 *
 * Two shapes count, because the backend legitimately produces both: the
 * transport answers `403` for an actor mismatch, while `CommandHandler`
 * answers `200` with `accepted: false` and a stated reason when a command
 * needs an authenticated operator it did not get.
 */
export function isAuthFailure(status: number, body: unknown): boolean {
  if (status === 401 || status === 403) return true;
  if (typeof body !== "object" || body === null) return false;
  const { reason, error } = body as { reason?: unknown; error?: unknown };
  if (error === "unauthorized" || error === "actor_mismatch") return true;
  return typeof reason === "string" && /authenticated operator/i.test(reason);
}

/**
 * True when a response was refused on authorization grounds **of any
 * kind** — deliberately broader than `isAuthFailure` (AC-106).
 *
 * The two must stay separate. `isAuthFailure` answers "was *my operator
 * credential* refused?", and drives the credential panel; the Inspector
 * guard (F-05) must not make it true, because the frontend holds an
 * operator credential and is not an agent — it can never satisfy that
 * guard, and marking the operator's credential "rejected" would send them
 * to replace a token that is entirely correct.
 *
 * This one answers "was this an authorization decision?", and drives how a
 * command failure is *categorised*. Both guards belong here: an operator
 * told "Blocked by current state" for an Inspector-only command would go
 * looking for a prerequisite that does not exist.
 */
export function isAuthorizationRefusal(status: number, body: unknown): boolean {
  if (isAuthFailure(status, body)) return true;
  if (typeof body !== "object" || body === null) return false;
  const { reason } = body as { reason?: unknown };
  // F-05's Inspector-only validation guard, whose refusal is a 200 with
  // `accepted: false` like every other `CommandHandler` denial.
  return typeof reason === "string" && /\bInspector-role agent\b/i.test(reason);
}
