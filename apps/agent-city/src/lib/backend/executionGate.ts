import type { ExecutionAuthorization } from "@foundry/contracts";

/**
 * Reading the execution authorization gate from the browser (AC-110).
 *
 * The gate's verdict is backend truth like everything else: the frontend
 * asks, and renders what it is told. It never computes permission, and it
 * never computes the binding — `planContentHash` is produced by the
 * backend and is not reachable from this bundle at all (`F-113a`).
 *
 * Reading is a `GET` with no side effects. Asking whether execution would
 * be permitted must never be able to cause it.
 */

export interface ExecutionGateRefusal {
  code: string;
  reason: string;
  correctiveAction: string;
}

export interface ExecutionGateReport {
  buildId: string;
  stageName: string;
  permitted: boolean;
  /** Always false from this endpoint — it reports, it never dispatches. */
  executed: boolean;
  refusals: ExecutionGateRefusal[];
  authorization: ExecutionAuthorization | null;
  /** The binding, as recomputed by the backend on this request. */
  currentContentHash: string | null;
  spentRunIds: string[];
  note?: string;
  /** Set when the report itself could not be obtained. */
  unavailable?: string;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Turns any response — shaped, unshaped, or absent — into something sayable. */
export function interpretExecutionGateResponse(
  status: number,
  body: unknown,
  buildId: string,
  stageName: string,
): ExecutionGateReport {
  const shaped = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  const base: ExecutionGateReport = {
    buildId,
    stageName,
    permitted: false,
    executed: false,
    refusals: [],
    authorization: null,
    currentContentHash: null,
    spentRunIds: [],
  };

  if (status < 200 || status >= 300) {
    return {
      ...base,
      unavailable:
        asString(shaped.reason) ??
        asString(shaped.message) ??
        `The backend did not report the gate's state (HTTP ${status}).`,
    };
  }

  return {
    ...base,
    // `permitted` is read strictly: anything that is not literally `true`
    // is not permission. A missing or malformed field must never widen
    // into "allowed".
    permitted: shaped.permitted === true,
    executed: shaped.executed === true,
    refusals: Array.isArray(shaped.refusals)
      ? shaped.refusals.flatMap((entry) => {
          if (typeof entry !== "object" || entry === null) return [];
          const { code, reason, correctiveAction } = entry as Record<string, unknown>;
          return [
            {
              code: asString(code) ?? "unknown",
              reason: asString(reason) ?? "The backend refused without stating a reason.",
              correctiveAction: asString(correctiveAction) ?? "",
            },
          ];
        })
      : [],
    authorization: (shaped.authorization as ExecutionAuthorization | null) ?? null,
    currentContentHash: asString(shaped.currentContentHash) ?? null,
    spentRunIds: Array.isArray(shaped.spentRunIds) ? (shaped.spentRunIds as string[]) : [],
    note: asString(shaped.note),
  };
}

export async function fetchExecutionGate(
  baseUrl: string,
  buildId: string,
  stageName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExecutionGateReport> {
  const url = `${baseUrl.replace(/\/$/, "")}/builds/${encodeURIComponent(buildId)}/execution-authorization?stage=${encodeURIComponent(stageName)}`;

  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch (err) {
    return interpretExecutionGateResponse(
      0,
      { reason: err instanceof Error ? err.message : "The request did not reach the backend." },
      buildId,
      stageName,
    );
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // A response we cannot parse is still a response we must explain.
  }
  return interpretExecutionGateResponse(res.status, body, buildId, stageName);
}
