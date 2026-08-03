import type { ObjectiveWorkspace, V1RiskClass } from "@foundry/contracts";

/**
 * Submitting an objective from the browser (AC-103).
 *
 * Kept out of the React provider so the interesting part — what the
 * operator is told when something goes wrong — is testable without a DOM.
 *
 * The whole point of this module is that **every** outcome is a rendered
 * outcome. `BackendRuntimeProvider` previously set a rejection only when a
 * response contained `accepted: false`, a key that the API's 400 body does
 * not carry, so every malformed command produced no feedback at all. That
 * failure mode is precisely what the operator asked to be closed here: a
 * refusal the operator cannot see is indistinguishable from a broken app.
 */

export interface ObjectiveInput {
  objective: string;
  workspace: ObjectiveWorkspace;
  riskClass: V1RiskClass;
}

export interface ObjectiveIssue {
  field: string;
  message: string;
}

export interface ObjectiveSubmissionResult {
  accepted: boolean;
  /** Present on every refusal. */
  reason?: string;
  correctiveAction?: string;
  /** Per-field detail when the envelope itself was rejected. */
  issues?: ObjectiveIssue[];
  projectId?: string;
  buildId?: string;
  objective?: string;
}

interface ObjectiveResponseBody {
  accepted?: unknown;
  reason?: unknown;
  message?: unknown;
  correctiveAction?: unknown;
  issues?: unknown;
  projectId?: unknown;
  buildId?: unknown;
  objective?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asIssues(value: unknown): ObjectiveIssue[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const issues = value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { field, message } = entry as { field?: unknown; message?: unknown };
    const text = asString(message);
    if (!text) return [];
    return [{ field: typeof field === "string" ? field : "", message: text }];
  });
  return issues.length > 0 ? issues : undefined;
}

/** Turns any response — shaped, unshaped, or absent — into something sayable. */
export function interpretObjectiveResponse(
  status: number,
  body: unknown,
): ObjectiveSubmissionResult {
  const shaped: ObjectiveResponseBody =
    typeof body === "object" && body !== null ? (body as ObjectiveResponseBody) : {};

  if (status >= 200 && status < 300 && shaped.accepted === true) {
    return {
      accepted: true,
      projectId: asString(shaped.projectId),
      buildId: asString(shaped.buildId),
      objective: asString(shaped.objective),
    };
  }

  return {
    accepted: false,
    // A backend that explains itself is preferred over anything invented
    // here; the status line is the last resort, never the first answer.
    reason:
      asString(shaped.reason) ??
      asString(shaped.message) ??
      `The backend refused the submission (HTTP ${status}) without stating a reason.`,
    correctiveAction: asString(shaped.correctiveAction),
    issues: asIssues(shaped.issues),
  };
}

export async function postObjective(
  baseUrl: string,
  input: ObjectiveInput,
  credential: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ObjectiveSubmissionResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/objectives`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      },
      body: JSON.stringify(input),
    });
  } catch (err) {
    return {
      accepted: false,
      reason: err instanceof Error ? err.message : "The submission did not reach the backend.",
      correctiveAction: "Check that the API process is running, then resubmit.",
    };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // A response we cannot parse is still a response we must explain.
  }
  return interpretObjectiveResponse(res.status, body);
}
