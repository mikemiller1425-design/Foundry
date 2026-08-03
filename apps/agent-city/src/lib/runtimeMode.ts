/**
 * Which runtime the app serves, resolved at **request time** (AC-105).
 *
 * The defect this closes (PV1-028): `page.tsx` read
 * `process.env.NEXT_PUBLIC_FOUNDRY_API_URL` at module scope, and Next
 * inlines `NEXT_PUBLIC_*` into the bundle at build time. A built artifact
 * was therefore permanently one mode, and switching required a rebuild —
 * while `apps/agent-city/README.md` claimed, unqualified, that "the
 * runtime is selectable".
 *
 * `FOUNDRY_API_URL` is a **server-side** variable. It is read on the
 * server for each request and passed to the client provider as a prop, so
 * one build serves either mode depending only on how the process was
 * started. It deliberately has no `NEXT_PUBLIC_` prefix: that prefix is
 * exactly the mechanism that caused the problem.
 *
 * `NEXT_PUBLIC_FOUNDRY_API_URL` is still honoured, second, so existing
 * invocations and the FBL-026 browser spec keep working unchanged. It is
 * the legacy build-time path and is documented as such.
 */

export type RuntimeMode = "mock" | "backend";

export interface RuntimeSelection {
  mode: RuntimeMode;
  /** The API base URL in backend mode; `null` in mock mode. */
  backendUrl: string | null;
  /** Which variable decided it — surfaced for diagnostics, never for auth. */
  source: "FOUNDRY_API_URL" | "NEXT_PUBLIC_FOUNDRY_API_URL" | "default";
}

/** Blank and whitespace-only are "unset", not "a backend at the empty URL". */
function clean(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveRuntimeSelection(env: Record<string, string | undefined>): RuntimeSelection {
  const runtimeUrl = clean(env.FOUNDRY_API_URL);
  if (runtimeUrl) {
    return { mode: "backend", backendUrl: runtimeUrl, source: "FOUNDRY_API_URL" };
  }

  const legacyUrl = clean(env.NEXT_PUBLIC_FOUNDRY_API_URL);
  if (legacyUrl) {
    return { mode: "backend", backendUrl: legacyUrl, source: "NEXT_PUBLIC_FOUNDRY_API_URL" };
  }

  // The deterministic mock runtime stays the default (ADR-001): with no
  // configuration at all, the app runs with no backend required.
  return { mode: "mock", backendUrl: null, source: "default" };
}
