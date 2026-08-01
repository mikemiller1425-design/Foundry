/**
 * The operator's credential, as held by the browser (FBL-030).
 *
 * Resolving an approval requires an authenticated operator, so the
 * frontend needs a credential to present. Two deliberate choices:
 *
 * - It is **entered by the operator and stored locally**, not baked into
 *   the client bundle via a `NEXT_PUBLIC_*` build variable. A build-time
 *   variable would put a live credential into every artifact of the
 *   build — logs, caches, the deployed bundle — and make rotation a
 *   rebuild. Entry keeps the token with the person it authenticates.
 * - Its absence is a **visible, explained disabled state**, never a
 *   silent failure. An operator whose approval button quietly does
 *   nothing has no way to tell "not authorized" from "backend down".
 *
 * This is not a session system: there is no expiry, refresh, or logout.
 * V1 excludes authentication as a feature; this is the minimum needed to
 * make the operator-only guard real, and should not be mistaken for more.
 */

export const OPERATOR_CREDENTIAL_STORAGE_KEY = "foundry.operatorCredential";

/** Reads the stored credential, or null when none is present. */
export function readOperatorCredential(storage?: Storage): string | null {
  const store = storage ?? safeLocalStorage();
  if (!store) return null;
  try {
    const value = store.getItem(OPERATOR_CREDENTIAL_STORAGE_KEY);
    return value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    // Storage can throw (private mode, disabled cookies). A credential
    // we cannot read is simply absent.
    return null;
  }
}

/** Stores a credential, or clears it when given an empty value. */
export function writeOperatorCredential(value: string, storage?: Storage): void {
  const store = storage ?? safeLocalStorage();
  if (!store) return;
  try {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      store.removeItem(OPERATOR_CREDENTIAL_STORAGE_KEY);
      return;
    }
    store.setItem(OPERATOR_CREDENTIAL_STORAGE_KEY, trimmed);
  } catch {
    // Nothing useful to do; the caller's next read will report absence.
  }
}

/** Builds the request headers for a command, with the credential if present. */
export function commandHeaders(credential: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
  };
}

function safeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
