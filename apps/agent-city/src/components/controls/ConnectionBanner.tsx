"use client";

import { useRuntime } from "@/lib/mock-runtime";

/**
 * FBL-026 (F-10): labels the whole projection as stale whenever the
 * client is not receiving live backend events. The last-known state stays
 * on screen — it is simply no longer claimed to be current — because
 * blanking it would lose the operator's context without making anything
 * more truthful.
 *
 * Lives inside the top system bar rather than as its own shell row, so
 * the mandatory region proportions established at FBL-005 (and asserted
 * across all three target viewports) are unaffected.
 */
export function ConnectionBanner() {
  const { connectionStatus } = useRuntime();

  if (connectionStatus === "connected") return null;

  return (
    <span
      role="status"
      aria-live="assertive"
      data-testid="connection-banner"
      data-connection-status={connectionStatus}
      className="flex items-center gap-1.5 rounded border border-amber-600 bg-amber-950 px-2 py-1 text-xs font-medium text-amber-200"
    >
      {/* Not a color-only signal (Principle: color is never the sole status
          carrier) — the icon shape and the text carry it independently. */}
      <span aria-hidden="true">⚠</span>
      Disconnected — showing last known state; mutation controls disabled.
    </span>
  );
}
