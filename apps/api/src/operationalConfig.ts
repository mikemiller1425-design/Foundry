import { join } from "node:path";
import type { DispatchConfig } from "./execution/executionDispatcher";

/**
 * The one definition of "the operational deployment" (AC-111).
 *
 * Both the running service and the real-run entrypoint import from here.
 * That is the point: `AC-111`'s requirement is that the entrypoint use the
 * **exact** database and configuration the `AC-110` gate runs against, and
 * two modules that each computed the same path independently would be
 * agreeing by coincidence — a coincidence that survives until someone
 * edits one of them.
 *
 * ## What is deliberately *not* configurable per invocation
 *
 * Everything below except the database path. The model, tool set,
 * timeouts, byte caps, and executable path are the **runtime policy**, and
 * a caller who could set them could widen containment without touching a
 * policy file — which is the shape of every containment bug worth caring
 * about. They live in committed source so changing one is a reviewable
 * diff, not a command-line argument.
 *
 * The budget is absent from this file entirely. It is **not** policy: it
 * is the operator's decision, carried on the persisted
 * `ExecutionAuthorization`, and read from there and nowhere else (H-3).
 */

/** The service's database. `FOUNDRY_DB_PATH` overrides, as it always has. */
export function operationalDatabasePath(): string {
  return process.env.FOUNDRY_DB_PATH ?? join(import.meta.dirname, "..", "data", "foundry.sqlite");
}

/**
 * The controlled executable's absolute path.
 *
 * Still environment-overridable, because the install location genuinely
 * varies by machine — but the **pin** is what makes that safe: whatever
 * path is configured, the file there must hash to the value the operator
 * deliberately pinned, or the dispatch is refused before anything is
 * created. A path without a pin is refused outright.
 */
export function controlledExecutablePath(): string {
  return (
    process.env.FOUNDRY_CLAUDE_PATH ??
    "/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe"
  );
}

/**
 * The invariant execution policy for a real controlled run.
 *
 * `expectedExecutableSha256` is deliberately absent: it is supplied per
 * invocation by the operator, and its absence is a refusal rather than a
 * default. A pin baked in here would be a pin nobody chose.
 */
export function executionDispatchConfig(): Omit<DispatchConfig, "expectedExecutableSha256"> {
  return {
    executablePath: controlledExecutablePath(),
    gitExecutablePath: process.env.FOUNDRY_GIT_PATH ?? "/usr/bin/git",
    nodeExecutablePath: process.execPath,
    model: "sonnet",
    timeoutMs: 10 * 60_000,
    validationTimeoutMs: 2 * 60_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 1024 * 1024,
    maxEvidenceBytes: 8 * 1024 * 1024,
  };
}
