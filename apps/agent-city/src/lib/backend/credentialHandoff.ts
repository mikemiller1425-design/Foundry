/**
 * The local credential handoff (AC-105 / F-104), server side.
 *
 * The step this removes: the API mints per-boot credentials and prints
 * them once to stdout, so reaching an approval-capable state meant reading
 * a token out of a terminal and pasting it into a browser (PV1-036).
 *
 * How it works, and why this shape:
 *
 * - The launch script writes the operator token to a file it owns, mode
 *   `0600`, and tells the frontend server where it is. The token therefore
 *   travels between two processes on **one host**, through the filesystem,
 *   never through a build.
 * - The frontend **server** reads that file. It is never inlined into the
 *   client bundle — that is the property F-104 requires and the reason
 *   this is not another `NEXT_PUBLIC_*` variable.
 * - The browser asks for it over loopback, once, and stores it exactly
 *   where a manually-pasted credential goes. From that point nothing about
 *   the credential's handling differs between the two routes.
 *
 * What it deliberately is not: a session system. There is no login, no
 * expiry, no refresh, no logout, and no user. It is a file, copied once,
 * by the same person on the same machine — the smallest thing that removes
 * the copy-paste step without inventing authentication that `v1-scope.md`
 * excludes.
 */

export interface HandoffResult {
  available: boolean;
  credential?: string;
  /** Why nothing was handed over. Present only when `available` is false. */
  reason?: string;
}

export interface HandoffDeps {
  env: Record<string, string | undefined>;
  readFile: (path: string) => string;
  exists: (path: string) => boolean;
}

export const HANDOFF_PATH_VAR = "FOUNDRY_OPERATOR_CREDENTIAL_FILE";

/**
 * Reads the handoff file, if the launch path wrote one.
 *
 * Every "no" is a stated reason rather than a bare false: this endpoint is
 * the one the browser consults when the operator cannot act, so an
 * unexplained empty answer here is the silent failure the rung exists to
 * remove.
 */
export function readHandoffCredential(deps: HandoffDeps): HandoffResult {
  const path = deps.env[HANDOFF_PATH_VAR]?.trim();
  if (!path) {
    return {
      available: false,
      reason:
        "This server was not started with a credential handoff. Start Foundry with `pnpm dev`, or paste the credential manually.",
    };
  }

  if (!deps.exists(path)) {
    return {
      available: false,
      reason:
        "The launch path declared a credential handoff file, but it is not present. Paste the credential manually.",
    };
  }

  let contents: string;
  try {
    contents = deps.readFile(path);
  } catch {
    return {
      available: false,
      reason: "The credential handoff file could not be read. Paste the credential manually.",
    };
  }

  const credential = contents.trim();
  if (credential.length === 0) {
    return {
      available: false,
      reason: "The credential handoff file is empty. Paste the credential manually.",
    };
  }

  return { available: true, credential };
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0:0:0:0:0:0:0:1"]);

/**
 * True when a request's `Host` names this machine.
 *
 * Defence in depth, not the primary control: `pnpm dev` binds the frontend
 * to `127.0.0.1`, so a non-local caller cannot reach this route at all.
 * The check exists for the case where someone starts the server another
 * way — handing an operator credential to whoever asks over a LAN is not a
 * failure mode worth leaving open for the sake of one conditional.
 */
export function isLoopbackHost(host: string | null): boolean {
  if (!host) return false;
  const trimmed = host.trim().toLowerCase();
  // IPv6 literals are bracketed; a port may or may not be present.
  const hostname = trimmed.startsWith("[")
    ? trimmed.slice(0, trimmed.indexOf("]") + 1)
    : (trimmed.split(":")[0] ?? "");
  return LOOPBACK_HOSTNAMES.has(hostname);
}
