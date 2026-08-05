import type { NasRoot } from "@foundry/contracts";

/**
 * Configured NAS roots, and the gate that keeps them closed.
 *
 * ## Roots are named, not passed
 *
 * A caller selects a `rootId`. It cannot supply a path. That is the single
 * most important property in this module: with a path parameter, "scan the
 * NAS" and "traverse anywhere this process can read" would be the same
 * operation distinguished only by the caller's intentions.
 *
 * ## Scanning the operator's real NAS is disabled
 *
 * `Package 1a` builds the boundary and proves it against synthetic
 * fixtures. It does **not** read the operator's Synology. The registry
 * below ships **empty**, and `resolveNasRoot` refuses every id until an
 * operator gate at `Package 2` supplies real roots deliberately.
 *
 * An empty registry is not an oversight — it is the gate. A default root
 * pointing at a plausible mount would mean the first accidental call
 * scanned the operator's storage.
 */

/**
 * Configured roots. **Deliberately empty in Package 1a.**
 *
 * Package 2 populates this from operator-confirmed configuration, at
 * which point scanning becomes possible for exactly the named roots and
 * nothing else.
 */
export const CONFIGURED_NAS_ROOTS: readonly NasRoot[] = Object.freeze([]);

export type NasRootResolution =
  | { ok: true; root: NasRoot }
  | { ok: false; code: "scanning_not_enabled" | "unknown_root"; reason: string; correctiveAction: string };

/**
 * Resolves a configured root id, or refuses.
 *
 * Fail-closed twice over: an empty registry refuses everything with the
 * gate's own reason, and a populated registry still refuses any id it does
 * not contain.
 */
export function resolveNasRoot(
  rootId: string,
  roots: readonly NasRoot[] = CONFIGURED_NAS_ROOTS,
): NasRootResolution {
  if (roots.length === 0) {
    return {
      ok: false,
      code: "scanning_not_enabled",
      reason:
        "No NAS root is configured. Scanning the operator's storage is disabled until an operator gate enables it (Construction Package 2); Package 1a builds and proves the boundary against synthetic fixtures only.",
      correctiveAction:
        "Configure a root deliberately at Package 2, having decided which volume Foundry may index read-only.",
    };
  }

  const root = roots.find((candidate) => candidate.rootId === rootId);
  if (!root) {
    return {
      ok: false,
      code: "unknown_root",
      reason: `\`${rootId}\` is not a configured NAS root. Roots are named in configuration and selected by id; a path is never accepted from a caller.`,
      correctiveAction: `Use one of: ${roots.map((entry) => entry.rootId).join(", ")}.`,
    };
  }

  return { ok: true, root };
}
