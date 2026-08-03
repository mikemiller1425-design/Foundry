/**
 * What the operator is told when a command does not succeed (AC-103).
 *
 * `BackendRuntimeProvider` used to record a rejection only when the
 * response body contained `accepted: false`. The API's rejection body for a
 * command that fails envelope validation is `{error, message, issues}` and
 * contains no `accepted` key at all, so the provider read `undefined`,
 * cleared the rejection to `null`, and the command bar said nothing. Every
 * button in backend mode failed in complete silence.
 *
 * This makes the rule the opposite one: any response that is not a success
 * produces a sentence. The backend's own words are used when it supplies
 * them, because they are more specific than anything that can be guessed
 * from a status code.
 */

export interface CommandRejection {
  commandType: string;
  reason: string;
}

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

/**
 * Returns the rejection to display, or `null` when the command succeeded.
 *
 * `requestedCommandType` is the type the client sent: a 400 rejection does
 * not echo it back, and "Rejected: unknown" tells the operator nothing
 * about which control just failed.
 */
export function interpretCommandResponse(
  status: number,
  body: unknown,
  requestedCommandType: string,
): CommandRejection | null {
  const shaped: CommandResponseBody =
    typeof body === "object" && body !== null ? (body as CommandResponseBody) : {};

  const ok = status >= 200 && status < 300;
  if (ok && shaped.accepted !== false) return null;

  const reason =
    asString(shaped.reason) ??
    asString(shaped.message) ??
    asString(shaped.error) ??
    `The backend refused this command (HTTP ${status}) without stating a reason.`;
  const correctiveAction = asString(shaped.correctiveAction);

  return {
    commandType: asString(shaped.commandType) ?? requestedCommandType,
    reason: correctiveAction ? `${reason} ${correctiveAction}` : reason,
  };
}

/** Best-effort read of the commandType from an outgoing request body. */
export function requestedCommandType(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) return "unknown";
  const { commandType } = raw as { commandType?: unknown };
  return asString(commandType) ?? "unknown";
}
