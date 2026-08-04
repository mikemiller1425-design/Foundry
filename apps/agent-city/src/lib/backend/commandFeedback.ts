import { COMMAND_TYPES } from "@foundry/contracts";
import { isAuthorizationRefusal } from "./credentialState";

/**
 * Why a command did not succeed, in terms an operator can act on (AC-106).
 *
 * `AC-103P` fixed the silence: before it, `BackendRuntimeProvider` recorded
 * a rejection only when a response contained `accepted: false` — a key the
 * API's 400 body does not carry — so every command-bar control in backend
 * mode failed with no feedback at all.
 *
 * This rung fixes the *sameness*. One undifferentiated "Rejected: …" line
 * left five genuinely different situations looking identical, and they have
 * five different fixes:
 *
 * | Kind | What actually happened | Who fixes it, and how |
 * | --- | --- | --- |
 * | `unsupported` | The backend has no such command or capability | Nobody — the control should not have been offered |
 * | `validation` | The request was malformed or out of bounds | Correct the input |
 * | `unauthorized` | The credential is missing, wrong, or stale | Fix the credential |
 * | `blocked` | The request was well-formed and permitted, but the world is not in a state that allows it | Satisfy the prerequisite |
 * | `unreachable` | Nothing answered | Restore the backend |
 * | `server_error` | The backend failed unexpectedly | Read its log; this is a defect |
 *
 * Classification is deliberately structural — status codes and the closed
 * command vocabulary — rather than pattern-matching on prose. Reason text
 * is the backend's to word; deciding *what kind of problem this is* from
 * how that sentence happens to read would break the moment it is reworded.
 */

export type CommandFailureKind =
  "unsupported" | "validation" | "unauthorized" | "blocked" | "unreachable" | "server_error";

export interface CommandFailure {
  kind: CommandFailureKind;
  /** The command the operator's control tried to perform. */
  commandType: string;
  /** Short category heading. */
  title: string;
  /** What the backend said, or the closest true statement available. */
  reason: string;
  /** What to do next. Never empty — a failure with no next step is a dead end. */
  action: string;
}

const TITLES: Record<CommandFailureKind, string> = {
  unsupported: "Not supported",
  validation: "Invalid request",
  unauthorized: "Not authorized",
  blocked: "Blocked by current state",
  unreachable: "Backend unreachable",
  server_error: "Backend error",
};

const ACTIONS: Record<CommandFailureKind, string> = {
  unsupported:
    "This control has no backend equivalent. Nothing you can type or press will make it work here.",
  validation: "Correct the highlighted input and try again.",
  unauthorized: "Check the Operator credential panel — it states the exact credential problem.",
  blocked: "Satisfy the stated prerequisite, then retry.",
  unreachable: "Confirm the API process is running; the control re-enables when it reconnects.",
  server_error: "This is a backend defect. Check the API log before retrying.",
};

interface CommandResponseBody {
  accepted?: unknown;
  commandType?: unknown;
  reason?: unknown;
  message?: unknown;
  error?: unknown;
  correctiveAction?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

const KNOWN_COMMAND_TYPES: ReadonlySet<string> = new Set(COMMAND_TYPES);

/**
 * True when the backend's closed vocabulary contains no such command.
 *
 * Checked on the client, against the same `COMMAND_TYPES` the backend
 * validates with, so a control that can never work is identified *before*
 * a request is sent. Round-tripping to be told "invalid_request" would be
 * both slower and less honest: the answer is knowable here, and the
 * resulting message would say "invalid" when the truth is "unsupported".
 */
export function isKnownCommandType(commandType: string): boolean {
  return KNOWN_COMMAND_TYPES.has(commandType);
}

function build(
  kind: CommandFailureKind,
  commandType: string,
  reason: string,
  correctiveAction?: string,
): CommandFailure {
  return {
    kind,
    commandType,
    title: TITLES[kind],
    reason,
    // The backend's own corrective action wins when it supplies one: it
    // knows the specific prerequisite, this table only knows the category.
    action: correctiveAction ?? ACTIONS[kind],
  };
}

/** The command is not in the backend's vocabulary — no request is sent. */
export function unsupportedCommand(commandType: string): CommandFailure {
  return build(
    "unsupported",
    commandType,
    `The backend has no \`${commandType}\` command. Its command vocabulary is closed and does not include this control.`,
  );
}

/** Nothing answered — a thrown fetch, or a stream known to be down. */
export function unreachableBackend(commandType: string, detail?: string): CommandFailure {
  return build(
    "unreachable",
    commandType,
    detail ?? "The backend is not answering, so its current state is unknown.",
  );
}

/**
 * Classifies a response that came back.
 *
 * Returns `null` only for a genuine success — anything else produces a
 * failure an operator can read.
 */
export function interpretCommandResponse(
  status: number,
  body: unknown,
  requestedCommandType: string,
): CommandFailure | null {
  const shaped: CommandResponseBody =
    typeof body === "object" && body !== null ? (body as CommandResponseBody) : {};

  const ok = status >= 200 && status < 300;
  if (ok && shaped.accepted !== false) return null;

  // A 400 that names it does not echo the command type back, so the type
  // the operator's control actually sent is the one worth showing.
  const commandType = asString(shaped.commandType) ?? requestedCommandType;
  const correctiveAction = asString(shaped.correctiveAction);
  const stated =
    asString(shaped.reason) ??
    asString(shaped.message) ??
    asString(shaped.error) ??
    `The backend refused this command (HTTP ${status}) without stating a reason.`;

  /**
   * Authorization is checked first, and is the one place classification is
   * not purely structural — because the backend states the same fact two
   * different ways.
   *
   * The transport answers `403 actor_mismatch` when a request body's
   * `actor` contradicts the credential. But `CommandHandler`'s own
   * authorization guards — Inspector-only validation (F-05), operator-only
   * approval resolution and upgrade acts (principle 14) — answer `200`
   * with `accepted: false`, because from the handler's point of view the
   * command was evaluated and refused like any other. Verified live: an
   * `Approval.Approve` with no credential returns `200`, not `403`.
   *
   * A purely status-based rule therefore filed the single most important
   * credential failure under "Blocked by current state", sending the
   * operator to satisfy a prerequisite when the actual fix was to supply a
   * credential.
   *
   * `isAuthorizationRefusal` is the one definition of "this was an
   * authorization decision", kept deliberately distinct from the narrower
   * `isAuthFailure` that drives the credential panel — the Inspector guard
   * must categorise a command as unauthorized without implying the
   * operator's own credential is wrong. It does inspect the reason for the
   * guards' fixed phrasing; the trade-off is accepted deliberately and
   * confined to one function, so a rewording changes one place and every
   * consumer stays correct. Changing the backend to answer `403` from
   * those guards would be the structural fix; it is out of scope here, and
   * is recorded in the rung's decision record.
   */
  if (isAuthorizationRefusal(status, shaped)) {
    return build("unauthorized", commandType, stated, correctiveAction);
  }
  if (status === 404) {
    return build("unsupported", commandType, stated, correctiveAction);
  }
  if (status >= 500) {
    return build("server_error", commandType, stated, correctiveAction);
  }
  if (status >= 400) {
    // An unknown command type reaching here is a vocabulary problem, not a
    // shape problem, and saying "invalid input" would send the operator to
    // fix input that was never the issue.
    const kind = isKnownCommandType(commandType) ? "validation" : "unsupported";
    return build(kind, commandType, stated, correctiveAction);
  }

  // 2xx with `accepted: false` — the command handler evaluated it and a
  // guard or transition rule refused. Well-formed, permitted, not possible
  // right now.
  return build("blocked", commandType, stated, correctiveAction);
}

/** Best-effort read of the commandType from an outgoing request body. */
export function requestedCommandType(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) return "unknown";
  const { commandType } = raw as { commandType?: unknown };
  return asString(commandType) ?? "unknown";
}
