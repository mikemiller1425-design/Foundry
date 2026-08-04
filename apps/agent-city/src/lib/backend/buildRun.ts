/**
 * Starting an orchestrated run from the browser (AC-109).
 *
 * Kept out of the React provider for the reason `objectiveSubmission.ts`
 * gives: the interesting part is what the operator is told when something
 * goes wrong, and that should be testable without a DOM.
 *
 * Every outcome is a rendered outcome. The backend answers a refusal with
 * a stated reason and a corrective action — no plan, an unreviewed or
 * rejected plan, a plan that changed since review, a build already
 * running, a caller with no operator credential — and each of those is a
 * different problem with a different fix, so none of them may collapse
 * into "could not start".
 */

export interface BuildRunResult {
  accepted: boolean;
  /** Machine-readable refusal class, when the backend supplied one. */
  code?: string;
  reason?: string;
  correctiveAction?: string;
  planId?: string;
  /** Steps the backend will submit for this run. */
  stepCount?: number;
  /**
   * Always `true` for this route, and read from the response rather than
   * assumed. A client that hard-coded it would keep claiming "simulated"
   * even if the backend one day stopped being.
   */
  simulated?: boolean;
  /** The executor the backend named — `"mock"` for every AC-109 run. */
  executor?: string;
}

interface BuildRunResponseBody {
  accepted?: unknown;
  error?: unknown;
  reason?: unknown;
  message?: unknown;
  correctiveAction?: unknown;
  planId?: unknown;
  stepCount?: unknown;
  simulated?: unknown;
  executor?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Turns any response — shaped, unshaped, or absent — into something sayable. */
export function interpretBuildRunResponse(status: number, body: unknown): BuildRunResult {
  const shaped: BuildRunResponseBody =
    typeof body === "object" && body !== null ? (body as BuildRunResponseBody) : {};

  const simulated = shaped.simulated === true;
  const executor = asString(shaped.executor);

  if (status >= 200 && status < 300 && shaped.accepted === true) {
    return {
      accepted: true,
      planId: asString(shaped.planId),
      stepCount: typeof shaped.stepCount === "number" ? shaped.stepCount : undefined,
      simulated,
      executor,
    };
  }

  return {
    accepted: false,
    code: asString(shaped.error),
    // A backend that explains itself is preferred over anything invented
    // here; the status line is the last resort, never the first answer.
    reason:
      asString(shaped.reason) ??
      asString(shaped.message) ??
      `The backend refused to start the run (HTTP ${status}) without stating a reason.`,
    correctiveAction: asString(shaped.correctiveAction),
    simulated,
    executor,
  };
}

export async function postBuildRun(
  baseUrl: string,
  buildId: string,
  credential: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<BuildRunResult> {
  let res: Response;
  try {
    res = await fetchImpl(
      `${baseUrl.replace(/\/$/, "")}/builds/${encodeURIComponent(buildId)}/start`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
        },
      },
    );
  } catch (err) {
    return {
      accepted: false,
      code: "unreachable",
      reason: err instanceof Error ? err.message : "The request did not reach the backend.",
      correctiveAction: "Check that the API process is running, then try again.",
    };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // A response we cannot parse is still a response we must explain.
  }
  return interpretBuildRunResponse(res.status, body);
}
